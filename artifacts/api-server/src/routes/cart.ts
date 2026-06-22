// =============================================================================
// Vitalé — D12 Cart / Address / Checkout HTTP surface (customer-owned)
// -----------------------------------------------------------------------------
// Canonical pipeline (authedRoute → withUserContext): validate → user context → DB →
// map errors → respond. Authorization is owned by the D12 RLS policies + grants
// (post/0139_commerce_lifecycle.sql), NOT re-implemented here:
//
//   • carts / cart_items / addresses [C] — owner CRUD via policies USING user_id = auth.uid()
//     (cart_items resolve ownership through the parent cart). The RLS-live `db` makes a
//     cross-user read or write structurally impossible; handlers never filter by user.
//   • checkout — NO direct order writes. rpc_checkout(address) is the ONLY path: it is
//     server-authoritative (client totals/discounts/items are structurally ignored), splits
//     the cart per merchant org, locks stock FOR UPDATE, rejects oversell, prices + GST
//     server-side, and is all-or-nothing. Gateway is neutral (confirmed later by the merchant).
//
// All ids are app-generated uuidv7() (pkV7 columns carry no default). No service-role
// handle, no Razorpay/gateway logic, no client-trusted pricing.
// =============================================================================
import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { uuidv7 } from "@workspace/db";
import { authedRoute } from "../lib/route";
import { ApiError } from "../lib/http";

const router: IRouter = Router();

// ── Cart ─────────────────────────────────────────────────────────────────────

// GET /cart — the caller's cart (singleton, created on first read) with hydrated
// line items. rpc_get_or_create_cart() is idempotent (ON CONFLICT DO NOTHING).
router.get(
  "/cart",
  authedRoute({}, async ({ db }) => {
    const cartRow = await db.execute(sql`SELECT public.rpc_get_or_create_cart() AS id`);
    const cartId = (cartRow.rows[0] as { id: string }).id;

    const items = await db.execute(sql`
      SELECT ci.id, ci.qty, ci.product_id, ci.variant_id,
             p.name AS product_name, p.images AS product_images, p.gst_rate AS product_gst_rate,
             p.organization_id,
             v.name AS variant_name, v.price_paise, v.mrp_paise, v.stock_qty
        FROM public.cart_items ci
        JOIN public.products p ON p.id = ci.product_id
        JOIN public.product_variants v ON v.id = ci.variant_id
       WHERE ci.cart_id = ${cartId}::uuid
       ORDER BY ci.created_at ASC
    `);
    return { cartId, items: items.rows };
  }),
);

// POST /cart — add a line item (or bump qty if the variant is already in the cart).
const AddItemBody = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid(),
  qty: z.number().int().min(1).default(1),
});
router.post(
  "/cart",
  authedRoute({ body: AddItemBody }, async ({ db, body, res }) => {
    const cartRow = await db.execute(sql`SELECT public.rpc_get_or_create_cart() AS id`);
    const cartId = (cartRow.rows[0] as { id: string }).id;

    const existing = await db.execute(sql`
      SELECT id, qty FROM public.cart_items
       WHERE cart_id = ${cartId}::uuid AND variant_id = ${body.variantId}::uuid
    `);

    if (existing.rows[0]) {
      const row = existing.rows[0] as { id: string; qty: number };
      const updated = await db.execute(sql`
        UPDATE public.cart_items SET qty = ${row.qty + body.qty}
         WHERE id = ${row.id}::uuid
        RETURNING id, cart_id, product_id, variant_id, qty
      `);
      return updated.rows[0];
    }

    const inserted = await db.execute(sql`
      INSERT INTO public.cart_items (id, cart_id, product_id, variant_id, qty)
      VALUES (${uuidv7()}::uuid, ${cartId}::uuid, ${body.productId}::uuid, ${body.variantId}::uuid, ${body.qty})
      RETURNING id, cart_id, product_id, variant_id, qty
    `);
    res.status(201);
    return inserted.rows[0];
  }),
);

// PATCH /cart/:itemId — set qty (qty<=0 removes the line). RLS scopes to the owner.
const ItemParam = z.object({ itemId: z.string().uuid() });
const QtyBody = z.object({ qty: z.number().int() });
router.patch(
  "/cart/:itemId",
  authedRoute({ params: ItemParam, body: QtyBody }, async ({ db, params, body }) => {
    if (body.qty <= 0) {
      const del = await db.execute(sql`
        DELETE FROM public.cart_items WHERE id = ${params.itemId}::uuid RETURNING id
      `);
      if (del.rows.length === 0) throw new ApiError(404, "not_found", "Cart item not found.");
      return { deleted: true };
    }
    const updated = await db.execute(sql`
      UPDATE public.cart_items SET qty = ${body.qty}
       WHERE id = ${params.itemId}::uuid
      RETURNING id, cart_id, product_id, variant_id, qty
    `);
    if (updated.rows.length === 0) throw new ApiError(404, "not_found", "Cart item not found.");
    return updated.rows[0];
  }),
);

// DELETE /cart/:itemId — remove a line item.
router.delete(
  "/cart/:itemId",
  authedRoute({ params: ItemParam }, async ({ db, params }) => {
    const del = await db.execute(sql`
      DELETE FROM public.cart_items WHERE id = ${params.itemId}::uuid RETURNING id
    `);
    if (del.rows.length === 0) throw new ApiError(404, "not_found", "Cart item not found.");
    return { deleted: true };
  }),
);

// ── Addresses ──────────────────────────────────────────────────────────────────

// GET /addresses — the caller's delivery addresses.
router.get(
  "/addresses",
  authedRoute({}, async ({ db }) => {
    const rows = await db.execute(sql`
      SELECT id, user_id, label, name, phone, line1, line2, city, state, pincode,
             is_default, created_at
        FROM public.addresses
       WHERE user_id = auth.uid()
       ORDER BY is_default DESC, created_at DESC
    `);
    return rows.rows;
  }),
);

// POST /addresses — create a delivery address (owned by the caller via RLS).
const AddressBody = z.object({
  label: z.string().max(80).default("Home"),
  name: z.string().min(1).max(120),
  phone: z.string().min(1).max(20),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  pincode: z.string().min(1).max(12),
  isDefault: z.boolean().default(false),
});
router.post(
  "/addresses",
  authedRoute({ body: AddressBody }, async ({ db, body, res }) => {
    const inserted = await db.execute(sql`
      INSERT INTO public.addresses
        (id, user_id, label, name, phone, line1, line2, city, state, pincode, is_default)
      VALUES (${uuidv7()}::uuid, auth.uid(), ${body.label}, ${body.name}, ${body.phone},
              ${body.line1}, ${body.line2 ?? null}, ${body.city}, ${body.state},
              ${body.pincode}, ${body.isDefault})
      RETURNING id, user_id, label, name, phone, line1, line2, city, state, pincode, is_default, created_at
    `);
    res.status(201);
    return inserted.rows[0];
  }),
);

// PATCH /addresses/:id — update mutable fields of an owned address.
const AddrIdParam = z.object({ id: z.string().uuid() });
const AddressPatch = AddressBody.partial();
router.patch(
  "/addresses/:id",
  authedRoute({ params: AddrIdParam, body: AddressPatch }, async ({ db, params, body }) => {
    const updated = await db.execute(sql`
      UPDATE public.addresses SET
        label      = COALESCE(${body.label ?? null}, label),
        name       = COALESCE(${body.name ?? null}, name),
        phone      = COALESCE(${body.phone ?? null}, phone),
        line1      = COALESCE(${body.line1 ?? null}, line1),
        line2      = ${body.line2 !== undefined ? sql`${body.line2}` : sql`line2`},
        city       = COALESCE(${body.city ?? null}, city),
        state      = COALESCE(${body.state ?? null}, state),
        pincode    = COALESCE(${body.pincode ?? null}, pincode),
        is_default = COALESCE(${body.isDefault ?? null}, is_default)
       WHERE id = ${params.id}::uuid
      RETURNING id, user_id, label, name, phone, line1, line2, city, state, pincode, is_default, created_at
    `);
    if (updated.rows.length === 0) throw new ApiError(404, "not_found", "Address not found.");
    return updated.rows[0];
  }),
);

// DELETE /addresses/:id — remove an owned address.
router.delete(
  "/addresses/:id",
  authedRoute({ params: AddrIdParam }, async ({ db, params }) => {
    const del = await db.execute(sql`
      DELETE FROM public.addresses WHERE id = ${params.id}::uuid RETURNING id
    `);
    if (del.rows.length === 0) throw new ApiError(404, "not_found", "Address not found.");
    return { deleted: true };
  }),
);

// ── Checkout ───────────────────────────────────────────────────────────────────

// POST /orders/checkout — place order(s) from the caller's cart. The ONLY input is
// the delivery address; rpc_checkout is server-authoritative (prices, GST, totals,
// per-merchant split, stock locking, oversell rejection, cart emptying — all in one
// transaction). Returns the array of created per-merchant orders. The DB raises
// business_rule (→422) on oversell / inactive items, mapped by the terminal handler.
const CheckoutBody = z.object({ addressId: z.string().uuid().nullable().optional() });
router.post(
  "/orders/checkout",
  authedRoute({ body: CheckoutBody }, async ({ db, body }) => {
    const result = await db.execute(sql`
      SELECT public.rpc_checkout(${body.addressId ?? null}::uuid) AS orders
    `);
    return { orders: (result.rows[0] as { orders: unknown }).orders };
  }),
);

export default router;
