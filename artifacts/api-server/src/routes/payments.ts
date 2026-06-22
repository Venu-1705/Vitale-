// =============================================================================
// Vitalé — Cashfree payment surface (mounted under /api/shop)
// -----------------------------------------------------------------------------
// The platform's order pipeline is gateway-NEUTRAL: rpc_checkout creates a
// `pending` shop_order, and payment confirmation stamps the gateway-neutral seam
// (gateway_provider / gateway_order_id / gateway_payment_id) + issues the GST
// invoice. This router wires Cashfree into that seam:
//
//   POST /shop/cashfree/order           (authed)  — create a Cashfree order for one of
//                                                    the caller's pending shop orders →
//                                                    { orderId, paymentSessionId }.
//   POST /shop/cashfree/webhook         (public)  — verify the Cashfree signature over the
//                                                    RAW body; on payment success confirm the
//                                                    order (pending → confirmed) + invoice.
//   GET  /shop/orders/:orderId/status   (authed)  — authoritative payment status from Cashfree.
//
// The webhook runs OUTSIDE any user (it is Cashfree calling us), so it confirms
// payment via withServiceContext (the sanctioned trusted/webhook path) using the
// SAME state transition the merchant RPC uses (pending → confirmed + issue_order_invoice),
// minus the merchant-membership gate — exactly the "real provider callback" the
// commerce schema anticipates. Idempotent: a replayed webhook is a no-op.
// =============================================================================
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { isUuid, withServiceContext } from "@workspace/db";
import { authedRoute } from "../lib/route";
import { ApiError } from "../lib/http";
import {
  createCashfreeOrder,
  fetchCashfreeOrder,
  isCashfreeConfigured,
  verifyWebhookSignature,
} from "../lib/cashfree";

const router: IRouter = Router();

// =============================================================================
// POST /shop/cashfree/order — create a Cashfree order for a pending shop order.
// The order is read under the caller's RLS scope (so it must be the caller's own
// order), the amount + customer identity are taken from the DB (never the client),
// and Cashfree's order_id is set to our shop_orders.id so the webhook maps back 1:1.
// =============================================================================
const CreateOrderBody = z.object({
  orderId: z.string().uuid(),
  /** Optional deep-link the hosted checkout returns to (mobile WebView sentinel). */
  returnUrl: z.string().max(500).optional(),
});

router.post(
  "/cashfree/order",
  authedRoute({ body: CreateOrderBody }, async ({ db, body, userId }) => {
    if (!isCashfreeConfigured()) {
      throw new ApiError(503, "gateway_unavailable", "Payment gateway is not configured.");
    }

    // RLS scopes shop_orders to the caller — a foreign order simply isn't visible.
    const orderRows = await db.execute(sql`
      SELECT o.id, o.status::text AS status, o.total_paise,
             a.name AS address_name, a.phone AS address_phone
        FROM public.shop_orders o
        LEFT JOIN public.addresses a ON a.id = o.address_id
       WHERE o.id = ${body.orderId}::uuid
    `);
    const order = orderRows.rows[0] as
      | { id: string; status: string; total_paise: string | number; address_name: string | null; address_phone: string | null }
      | undefined;
    if (!order) throw new ApiError(404, "not_found", "Order not found.");
    if (order.status !== "pending") {
      throw new ApiError(409, "conflict", `Order is already ${order.status}; it cannot be paid again.`);
    }

    // Customer email/phone from the caller's profile (RLS-scoped to self).
    const me = await db.execute(sql`
      SELECT email, phone, full_name FROM public.users WHERE id = ${userId}::uuid
    `);
    const profile = me.rows[0] as { email: string | null; phone: string | null; full_name: string | null } | undefined;

    const result = await createCashfreeOrder({
      orderId: order.id,
      amountPaise: Number(order.total_paise),
      customerId: userId,
      customerPhone: order.address_phone ?? profile?.phone ?? "",
      customerEmail: profile?.email ?? null,
      customerName: order.address_name ?? profile?.full_name ?? null,
      returnUrl: body.returnUrl,
    });

    return result; // { orderId, paymentSessionId }
  }),
);

// =============================================================================
// GET /shop/orders/:orderId/status — authoritative Cashfree payment status.
// Authed + RLS: the order must belong to the caller before we query the gateway.
// Returns both the gateway status and our local order status.
// =============================================================================
const StatusParam = z.object({ orderId: z.string().uuid() });

router.get(
  "/orders/:orderId/status",
  authedRoute({ params: StatusParam }, async ({ db, params }) => {
    const local = await db.execute(sql`
      SELECT id, status::text AS status, gateway_provider, gateway_payment_id
        FROM public.shop_orders WHERE id = ${params.orderId}::uuid
    `);
    const row = local.rows[0] as
      | { id: string; status: string; gateway_provider: string | null; gateway_payment_id: string | null }
      | undefined;
    if (!row) throw new ApiError(404, "not_found", "Order not found.");

    if (!isCashfreeConfigured()) {
      // No gateway configured → return the local truth only.
      return { orderId: row.id, localStatus: row.status, gatewayStatus: null };
    }

    let gatewayStatus: string | null = null;
    try {
      const cf = await fetchCashfreeOrder(params.orderId);
      gatewayStatus = cf.orderStatus;
    } catch {
      // Gateway lookup failed (e.g. order not yet created at Cashfree) — surface local truth.
      gatewayStatus = null;
    }
    return { orderId: row.id, localStatus: row.status, gatewayStatus };
  }),
);

// =============================================================================
// POST /shop/cashfree/webhook — Cashfree → us. Public (signed), not authedRoute.
// 1) Verify the HMAC signature over the RAW body (x-webhook-signature/timestamp).
// 2) On a payment-success event, confirm the order (pending → confirmed) + invoice,
//    idempotently, via the trusted service context. Always 200 once the signature
//    is valid (so Cashfree stops retrying); 401 only on a bad/absent signature.
// =============================================================================
router.post(
  "/cashfree/webhook",
  (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      const rawBody = (req as Request & { rawBody?: Buffer }).rawBody?.toString("utf8") ?? "";
      const signature = req.header("x-webhook-signature");
      const timestamp = req.header("x-webhook-timestamp");

      if (!verifyWebhookSignature(signature, rawBody, timestamp)) {
        return res.status(401).json({ error: { code: "invalid_signature", message: "Webhook signature verification failed." } });
      }

      // Parse defensively — never trust the shape beyond what we read.
      let payload: any = {};
      try {
        payload = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        return res.status(400).json({ error: { code: "invalid_payload", message: "Webhook body is not valid JSON." } });
      }

      const type = String(payload?.type ?? "");
      const orderId = String(payload?.data?.order?.order_id ?? "");
      const paymentStatus = String(payload?.data?.payment?.payment_status ?? "");
      const paymentId = String(
        payload?.data?.payment?.cf_payment_id ?? payload?.data?.payment?.payment_id ?? "",
      );

      const isSuccess =
        type === "PAYMENT_SUCCESS_WEBHOOK" || paymentStatus.toUpperCase() === "SUCCESS";

      // Non-success events (failed/dropped/user-dropped) are acknowledged but not acted on.
      if (!isSuccess || !isUuid(orderId)) {
        return res.status(200).json({ received: true, applied: false });
      }

      // Confirm payment in the trusted service context (BYPASSRLS). This mirrors
      // rpc_confirm_order_payment's effect (pending → confirmed + invoice) without the
      // merchant-membership gate, since the gateway — not a merchant — is the authority.
      // The status-machine guard + auto audit-event triggers still fire on the UPDATE.
      const applied = await withServiceContext(async (db) => {
        const locked = await db.execute(sql`
          SELECT status::text AS status FROM public.shop_orders
           WHERE id = ${orderId}::uuid FOR UPDATE
        `);
        const current = (locked.rows[0] as { status: string } | undefined)?.status;
        if (current === undefined) return false; // unknown order — ack and drop
        if (current !== "pending") return false; // idempotent: already confirmed/cancelled/etc.

        await db.execute(sql`
          UPDATE public.shop_orders
             SET status             = 'confirmed',
                 gateway_provider   = 'cashfree',
                 gateway_order_id   = ${orderId},
                 gateway_payment_id = ${paymentId || orderId}
           WHERE id = ${orderId}::uuid
        `);
        await db.execute(sql`SELECT public.issue_order_invoice(${orderId}::uuid)`);
        return true;
      });

      return res.status(200).json({ received: true, applied });
    })().catch(next);
  },
);

export default router;
