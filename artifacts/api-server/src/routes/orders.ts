// =============================================================================
// Vitalé — D12 Orders / Invoices HTTP surface (customer-facing reads + cancel)
// -----------------------------------------------------------------------------
// Canonical pipeline (authedRoute → withUserContext): validate → user context → DB →
// map errors → respond. Authorization is owned by the D12 RLS policies + grants
// (post/0139_commerce_lifecycle.sql), NOT re-implemented here:
//
//   • shop_orders [C] — SELECT-only grant; shop_orders_select_customer scopes to
//     user_id = auth.uid(). Order writes go ONLY through the RPCs (state machine + audit).
//   • shop_order_items / shop_order_events / invoices [B, immutable] — SELECT via the
//     parent order; append-only/immutable enforced by DB triggers.
//   • cancel — rpc_cancel_order is the ONLY customer write: pending→cancelled with full
//     restock, in one transaction, auto-logging a shop_order_events row (no direct status
//     mutation). Illegal cancels raise business_rule (→422) via the state-machine guard.
//
// The customer identity is the RLS gate — handlers never filter by user_id by hand for
// authorization (only for read shaping). No service-role handle, no fake/hardcoded GSTIN:
// the invoice is rendered from its immutable seller/buyer snapshots.
// =============================================================================
import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { authedRoute } from "../lib/route";
import { ApiError } from "../lib/http";
import { buildTextPdf } from "../lib/pdf";

const router: IRouter = Router();

const IdParam = z.object({ id: z.string().uuid() });

// ── GET /orders ────────────────────────────────────────────────────────────────
const ListQuery = z.object({
  status: z
    .enum(["pending", "confirmed", "packed", "shipped", "delivered", "cancelled", "refunded"])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
router.get(
  "/orders",
  authedRoute({ query: ListQuery }, async ({ db, query }) => {
    const statusClause = query.status ? sql`AND status = ${query.status}::public.order_status` : sql``;
    const offset = (query.page - 1) * query.limit;
    const orders = await db.execute(sql`
      SELECT id, user_id, organization_id, address_id, status, subtotal_paise,
             discount_paise, shipping_paise, gst_paise, total_paise,
             gateway_provider, gateway_order_id, gateway_payment_id, coupon_code,
             notes, created_at, updated_at
        FROM public.shop_orders
       WHERE user_id = auth.uid()
         ${statusClause}
       ORDER BY created_at DESC
       LIMIT ${query.limit} OFFSET ${offset}
    `);
    const rows = orders.rows as Array<Record<string, any>>;
    if (rows.length === 0) return [];

    const ids = rows.map((o) => o.id as string);
    const items = await db.execute(sql`
      SELECT id, order_id, product_id, variant_id, name, variant_name, qty,
             price_paise, gst_rate
        FROM public.shop_order_items
       WHERE order_id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})
    `);
    const byOrder = new Map<string, any[]>();
    for (const it of items.rows as Array<Record<string, any>>) {
      const list = byOrder.get(it.order_id) ?? [];
      list.push(it);
      byOrder.set(it.order_id, list);
    }
    return rows.map((o) => ({ ...o, items: byOrder.get(o.id) ?? [] }));
  }),
);

// ── GET /orders/:id ──────────────────────────────────────────────────────────────
router.get(
  "/orders/:id",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const orders = await db.execute(sql`
      SELECT id, user_id, organization_id, address_id, status, subtotal_paise,
             discount_paise, shipping_paise, gst_paise, total_paise,
             gateway_provider, gateway_order_id, gateway_payment_id, coupon_code,
             notes, created_at, updated_at
        FROM public.shop_orders
       WHERE id = ${params.id}::uuid
    `);
    const order = orders.rows[0] as Record<string, any> | undefined;
    if (!order) throw new ApiError(404, "not_found", "Order not found.");

    const [items, events, inv] = await Promise.all([
      db.execute(sql`
        SELECT id, order_id, product_id, variant_id, name, variant_name, qty,
               price_paise, gst_rate
          FROM public.shop_order_items WHERE order_id = ${params.id}::uuid
      `),
      db.execute(sql`
        SELECT id, order_id, status, note, created_at
          FROM public.shop_order_events WHERE order_id = ${params.id}::uuid
         ORDER BY created_at ASC
      `),
      db.execute(sql`
        SELECT id, order_id, organization_id, invoice_number, seller_snapshot,
               buyer_snapshot, total_paise, pdf_url, issued_at
          FROM public.invoices WHERE order_id = ${params.id}::uuid
      `),
    ]);
    return { ...order, items: items.rows, events: events.rows, invoice: inv.rows[0] ?? null };
  }),
);

// ── GET /orders/:id/invoice.pdf ────────────────────────────────────────────────
// Rendered from the immutable seller/buyer snapshots stored on the invoice — the
// historical identity stays accurate even if the merchant later changes its details.
router.get(
  "/orders/:id/invoice.pdf",
  authedRoute({ params: IdParam }, async ({ db, params, res }) => {
    const orders = await db.execute(sql`
      SELECT id, subtotal_paise, gst_paise, total_paise, created_at
        FROM public.shop_orders WHERE id = ${params.id}::uuid
    `);
    const order = orders.rows[0] as Record<string, any> | undefined;
    if (!order) throw new ApiError(404, "not_found", "Order not found.");

    const invRows = await db.execute(sql`
      SELECT invoice_number, seller_snapshot, buyer_snapshot, total_paise, issued_at
        FROM public.invoices WHERE order_id = ${params.id}::uuid
    `);
    const inv = invRows.rows[0] as Record<string, any> | undefined;
    if (!inv) throw new ApiError(404, "not_found", "Invoice not yet issued for this order.");

    const items = await db.execute(sql`
      SELECT name, variant_name, qty, price_paise, gst_rate
        FROM public.shop_order_items WHERE order_id = ${params.id}::uuid
    `);

    const seller = (inv.seller_snapshot ?? {}) as Record<string, any>;
    const buyer = (inv.buyer_snapshot ?? {}) as Record<string, any>;
    const sellerAddr = (seller.business_address ?? {}) as Record<string, any>;
    const buyerAddr = (buyer.address ?? {}) as Record<string, any>;
    const sellerState = String(sellerAddr.state ?? "");
    const buyerState = String(buyerAddr.state ?? "");
    const isInterState = sellerState !== "" && buyerState !== "" && sellerState !== buyerState;

    const lines = (items.rows as Array<Record<string, any>>)
      .map(
        (i, idx) =>
          `  ${idx + 1}. ${i.name} (${i.variant_name}) x${i.qty}  ₹${(i.price_paise / 100).toFixed(2)}  GST ${i.gst_rate}%`,
      )
      .join("\n");

    const gst = Number(order.gst_paise);
    const invoiceLines = [
      String(seller.legal_name ?? seller.business_name ?? "Merchant"),
      `GSTIN: ${seller.gstin ?? "—"}`,
      `Address: ${[sellerAddr.city, sellerAddr.state].filter(Boolean).join(", ") || "—"}`,
      "",
      "TAX INVOICE",
      `Invoice No: ${inv.invoice_number}`,
      `Order ID: ${order.id}`,
      `Date: ${new Date(inv.issued_at).toLocaleDateString("en-IN")}`,
      `Bill To: ${buyer.name ?? "—"}`,
      "",
      "ITEMS:",
      lines,
      "",
      `Subtotal: ₹${(Number(order.subtotal_paise) / 100).toFixed(2)}`,
      isInterState
        ? `IGST: ₹${(gst / 100).toFixed(2)}`
        : `CGST: ₹${(gst / 2 / 100).toFixed(2)}\nSGST: ₹${(gst / 2 / 100).toFixed(2)}`,
      `TOTAL: ₹${(Number(inv.total_paise) / 100).toFixed(2)}`,
      "",
      "Thank you for shopping at Vitalé!",
      // Flatten any entry that carries an embedded newline (CGST/SGST) into
      // discrete lines so each becomes its own rendered text row.
    ].flatMap((l) => l.split("\n"));

    // Finding #3: emit a genuinely valid PDF (was UTF-8 text mislabelled as PDF).
    const pdf = buildTextPdf(invoiceLines);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", String(pdf.length));
    res.setHeader("Content-Disposition", `attachment; filename="invoice-${inv.invoice_number}.pdf"`);
    res.end(pdf);
    return undefined;
  }),
);

// ── POST /orders/:id/cancel ──────────────────────────────────────────────────────
// Customer cancel: rpc_cancel_order verifies ownership, enforces pending→cancelled via
// the state-machine guard, restocks every line, and auto-logs the event — atomically.
const CancelBody = z.object({ note: z.string().max(500).optional() });
router.post(
  "/orders/:id/cancel",
  authedRoute({ params: IdParam, body: CancelBody }, async ({ db, params, body }) => {
    const result = await db.execute(sql`
      SELECT public.rpc_cancel_order(${params.id}::uuid, ${body.note ?? null}) AS order
    `);
    return (result.rows[0] as { order: unknown }).order;
  }),
);

// ── POST /orders/:id/reorder ─────────────────────────────────────────────────────
// Returns the line items of a past order so the client can re-add them to the cart.
router.post(
  "/orders/:id/reorder",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const orders = await db.execute(sql`
      SELECT id FROM public.shop_orders WHERE id = ${params.id}::uuid
    `);
    if (orders.rows.length === 0) throw new ApiError(404, "not_found", "Order not found.");
    const items = await db.execute(sql`
      SELECT product_id, variant_id, name, variant_name, qty
        FROM public.shop_order_items WHERE order_id = ${params.id}::uuid
    `);
    return { items: items.rows, message: "Items ready to add to cart" };
  }),
);

// ── GET /invoices ────────────────────────────────────────────────────────────────
// The caller's invoices (RLS gates to invoices of the caller's own orders).
router.get(
  "/invoices",
  authedRoute({}, async ({ db }) => {
    const rows = await db.execute(sql`
      SELECT i.id, i.order_id, i.organization_id, i.invoice_number, i.seller_snapshot,
             i.buyer_snapshot, i.total_paise, i.pdf_url, i.issued_at,
             o.status AS order_status, o.created_at AS order_created_at
        FROM public.invoices i
        JOIN public.shop_orders o ON o.id = i.order_id
       WHERE o.user_id = auth.uid()
       ORDER BY i.issued_at DESC
    `);
    return rows.rows;
  }),
);

export default router;
