// =============================================================================
// Vitalé — D12 Merchant HTTP surface (org-scoped catalog + fulfilment)
// -----------------------------------------------------------------------------
// Canonical pipeline (authedRoute → withUserContext): validate → user context → DB →
// map errors → respond. Authorization is owned by the D12 RLS policies + grants
// (post/0139_commerce_lifecycle.sql) and is_org_member(org, cap), NOT re-implemented:
//
//   • Catalog CRUD (products / variants / banners / coach_product_recommendations) —
//     WITH CHECK / USING is_org_member(organization_id, 'manage_products'). A merchant
//     can only touch its OWN org's assets; the DB rejects cross-org writes (→ rls_denied/403).
//   • Order reads — shop_orders_select_merchant USING is_org_member(org, 'view_revenue').
//   • Fulfilment — rpc_advance_order_status (manage_products) drives the state machine
//     (confirmed→packed→shipped→delivered, refunds), auto-logging events; illegal edges
//     raise business_rule (→422).
//   • Payment confirmation — rpc_confirm_order_payment (manage_products) is gateway-neutral
//     (Cashfree/Razorpay/Stripe/COD/…), idempotent on replay, issues the GST invoice once.
//
// All ids are app-generated uuidv7(). No service-role handle; org membership + capability
// are the gate (never a client-supplied role flag).
// =============================================================================
import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { uuidv7 } from "@workspace/db";
import { authedRoute } from "../lib/route";
import { ApiError } from "../lib/http";

const router: IRouter = Router();

const OrderStatusEnum = z.enum([
  "pending", "confirmed", "packed", "shipped", "delivered", "cancelled", "refunded",
]);

// ── Merchant order views ─────────────────────────────────────────────────────────

// GET /merchant/orders — orders the caller can see by org membership (view_revenue).
// Optional ?organizationId / ?status narrow the set; RLS still gates the whole result.
const MerchantOrdersQuery = z.object({
  organizationId: z.string().uuid().optional(),
  status: OrderStatusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
router.get(
  "/orders",
  authedRoute({ query: MerchantOrdersQuery }, async ({ db, query }) => {
    const orgClause = query.organizationId
      ? sql`AND organization_id = ${query.organizationId}::uuid`
      : sql``;
    const statusClause = query.status
      ? sql`AND status = ${query.status}::public.order_status`
      : sql``;
    const offset = (query.page - 1) * query.limit;
    const rows = await db.execute(sql`
      SELECT id, user_id, organization_id, address_id, status, subtotal_paise,
             discount_paise, shipping_paise, gst_paise, total_paise,
             gateway_provider, gateway_order_id, gateway_payment_id, created_at, updated_at
        FROM public.shop_orders
       WHERE true
         ${orgClause}
         ${statusClause}
       ORDER BY created_at DESC
       LIMIT ${query.limit} OFFSET ${offset}
    `);
    return rows.rows;
  }),
);

// GET /merchant/orders/:id — full order (items + events) for a visible merchant order.
const IdParam = z.object({ id: z.string().uuid() });
router.get(
  "/orders/:id",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const orders = await db.execute(sql`
      SELECT id, user_id, organization_id, address_id, status, subtotal_paise,
             discount_paise, shipping_paise, gst_paise, total_paise,
             gateway_provider, gateway_order_id, gateway_payment_id, created_at, updated_at
        FROM public.shop_orders WHERE id = ${params.id}::uuid
    `);
    const order = orders.rows[0] as Record<string, any> | undefined;
    if (!order) throw new ApiError(404, "not_found", "Order not found.");
    const [items, events] = await Promise.all([
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
    ]);
    return { ...order, items: items.rows, events: events.rows };
  }),
);

// GET /merchant/revenue — realised revenue summary for an org.
// Revenue counts ONLY orders whose payment was confirmed and not reversed:
//   confirmed · packed · shipped · delivered.
// It excludes pending (never paid), cancelled (released before payment), and
// refunded (money returned) — so the headline `revenue` is never inflated by
// non-revenue orders (Finding #4). The full per-status `byStatus` breakdown is
// still returned for operational visibility, but it is informational, not revenue.
const REVENUE_STATUSES = ["confirmed", "packed", "shipped", "delivered"] as const;
const RevenueQuery = z.object({ organizationId: z.string().uuid() });
router.get(
  "/revenue",
  authedRoute({ query: RevenueQuery }, async ({ db, query }) => {
    const [summary, byStatus] = await Promise.all([
      db.execute(sql`
        SELECT
          COALESCE(sum(total_paise) FILTER (
            WHERE status IN ('confirmed','packed','shipped','delivered')), 0)::bigint AS revenue_paise,
          COALESCE(sum(gst_paise) FILTER (
            WHERE status IN ('confirmed','packed','shipped','delivered')), 0)::bigint AS gst_collected_paise,
          count(*) FILTER (
            WHERE status IN ('confirmed','packed','shipped','delivered'))::int        AS revenue_orders
          FROM public.shop_orders
         WHERE organization_id = ${query.organizationId}::uuid
      `),
      db.execute(sql`
        SELECT status::text AS status, count(*)::int AS orders,
               COALESCE(sum(total_paise), 0)::bigint AS total_paise,
               COALESCE(sum(gst_paise), 0)::bigint AS gst_paise
          FROM public.shop_orders
         WHERE organization_id = ${query.organizationId}::uuid
         GROUP BY status
         ORDER BY status
      `),
    ]);
    return {
      organizationId: query.organizationId,
      revenue: summary.rows[0],
      countedStatuses: REVENUE_STATUSES,
      byStatus: byStatus.rows,
    };
  }),
);

// ── Fulfilment / payment ─────────────────────────────────────────────────────────

// POST /merchant/orders/:id/confirm-payment — gateway-neutral payment confirmation.
// Idempotent on webhook replay (returns replayed:true, no duplicate invoice).
const ConfirmBody = z.object({
  gatewayProvider: z.string().min(1).max(40),
  gatewayOrderId: z.string().min(1).max(200),
  gatewayPaymentId: z.string().min(1).max(200),
});
router.post(
  "/orders/:id/confirm-payment",
  authedRoute({ params: IdParam, body: ConfirmBody }, async ({ db, params, body }) => {
    const result = await db.execute(sql`
      SELECT public.rpc_confirm_order_payment(
        ${params.id}::uuid, ${body.gatewayProvider}, ${body.gatewayOrderId}, ${body.gatewayPaymentId}
      ) AS order
    `);
    return (result.rows[0] as { order: unknown }).order;
  }),
);

// POST /merchant/orders/:id/advance — drive the fulfilment state machine.
const AdvanceBody = z.object({
  status: OrderStatusEnum,
  note: z.string().max(500).optional(),
});
router.post(
  "/orders/:id/advance",
  authedRoute({ params: IdParam, body: AdvanceBody }, async ({ db, params, body }) => {
    const result = await db.execute(sql`
      SELECT public.rpc_advance_order_status(
        ${params.id}::uuid, ${body.status}::public.order_status, ${body.note ?? null}
      ) AS order
    `);
    return (result.rows[0] as { order: unknown }).order;
  }),
);

// ── Product CRUD (org-scoped via manage_products) ────────────────────────────────

const ProductBody = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  description: z.string().default(""),
  shortDescription: z.string().default(""),
  categoryId: z.string().uuid(),
  brand: z.string().max(120).optional(),
  images: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  benefits: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isBestseller: z.boolean().default(false),
  isNewInStore: z.boolean().default(false),
  hsnCode: z.string().max(20).optional(),
  gstRate: z.number().int().min(0).max(28).default(18),
});
router.post(
  "/products",
  authedRoute({ body: ProductBody }, async ({ db, body, res }) => {
    const inserted = await db.execute(sql`
      INSERT INTO public.products
        (id, organization_id, name, slug, description, short_description, category_id,
         brand, images, tags, benefits, is_active, is_featured, is_bestseller,
         is_new_in_store, hsn_code, gst_rate)
      VALUES (${uuidv7()}::uuid, ${body.organizationId}::uuid, ${body.name}, ${body.slug},
              ${body.description}, ${body.shortDescription}, ${body.categoryId}::uuid,
              ${body.brand ?? null}, ${JSON.stringify(body.images)}::jsonb,
              ${JSON.stringify(body.tags)}::jsonb, ${JSON.stringify(body.benefits)}::jsonb,
              ${body.isActive}, ${body.isFeatured}, ${body.isBestseller}, ${body.isNewInStore},
              ${body.hsnCode ?? null}, ${body.gstRate})
      RETURNING id, organization_id, name, slug, category_id, gst_rate, is_active
    `);
    res.status(201);
    return inserted.rows[0];
  }),
);

const ProductPatch = ProductBody.partial().omit({ organizationId: true });
router.patch(
  "/products/:id",
  authedRoute({ params: IdParam, body: ProductPatch }, async ({ db, params, body }) => {
    const updated = await db.execute(sql`
      UPDATE public.products SET
        name              = COALESCE(${body.name ?? null}, name),
        slug              = COALESCE(${body.slug ?? null}, slug),
        description       = COALESCE(${body.description ?? null}, description),
        short_description = COALESCE(${body.shortDescription ?? null}, short_description),
        category_id       = COALESCE(${body.categoryId ?? null}::uuid, category_id),
        brand             = ${body.brand !== undefined ? sql`${body.brand}` : sql`brand`},
        images            = COALESCE(${body.images ? JSON.stringify(body.images) : null}::jsonb, images),
        tags              = COALESCE(${body.tags ? JSON.stringify(body.tags) : null}::jsonb, tags),
        benefits          = COALESCE(${body.benefits ? JSON.stringify(body.benefits) : null}::jsonb, benefits),
        is_active         = COALESCE(${body.isActive ?? null}, is_active),
        is_featured       = COALESCE(${body.isFeatured ?? null}, is_featured),
        is_bestseller     = COALESCE(${body.isBestseller ?? null}, is_bestseller),
        is_new_in_store   = COALESCE(${body.isNewInStore ?? null}, is_new_in_store),
        hsn_code          = ${body.hsnCode !== undefined ? sql`${body.hsnCode}` : sql`hsn_code`},
        gst_rate          = COALESCE(${body.gstRate ?? null}, gst_rate),
        updated_at        = now()
       WHERE id = ${params.id}::uuid
      RETURNING id, organization_id, name, slug, category_id, gst_rate, is_active
    `);
    if (updated.rows.length === 0) throw new ApiError(404, "not_found", "Product not found.");
    return updated.rows[0];
  }),
);

// DELETE /merchant/products/:id — soft delete (deactivate) to preserve order history.
router.delete(
  "/products/:id",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const updated = await db.execute(sql`
      UPDATE public.products SET is_active = false, updated_at = now()
       WHERE id = ${params.id}::uuid
      RETURNING id
    `);
    if (updated.rows.length === 0) throw new ApiError(404, "not_found", "Product not found.");
    return { deactivated: true };
  }),
);

// ── Variant CRUD ─────────────────────────────────────────────────────────────────
// RLS resolves the org via the parent product (variants_* policies EXISTS check).
const VariantBody = z.object({
  productId: z.string().uuid(),
  name: z.string().min(1).max(120),
  sku: z.string().min(1).max(120),
  pricePaise: z.number().int().min(0),
  mrpPaise: z.number().int().min(0),
  stockQty: z.number().int().min(0).default(0),
  weightG: z.number().int().min(0).optional(),
  attributes: z.record(z.string()).default({}),
  isActive: z.boolean().default(true),
});
router.post(
  "/variants",
  authedRoute({ body: VariantBody }, async ({ db, body, res }) => {
    const inserted = await db.execute(sql`
      INSERT INTO public.product_variants
        (id, product_id, name, sku, price_paise, mrp_paise, stock_qty, weight_g, attributes, is_active)
      VALUES (${uuidv7()}::uuid, ${body.productId}::uuid, ${body.name}, ${body.sku},
              ${body.pricePaise}, ${body.mrpPaise}, ${body.stockQty}, ${body.weightG ?? null},
              ${JSON.stringify(body.attributes)}::jsonb, ${body.isActive})
      RETURNING id, product_id, name, sku, price_paise, mrp_paise, stock_qty, is_active
    `);
    res.status(201);
    return inserted.rows[0];
  }),
);

const VariantPatch = VariantBody.partial().omit({ productId: true });
router.patch(
  "/variants/:id",
  authedRoute({ params: IdParam, body: VariantPatch }, async ({ db, params, body }) => {
    const updated = await db.execute(sql`
      UPDATE public.product_variants SET
        name        = COALESCE(${body.name ?? null}, name),
        sku         = COALESCE(${body.sku ?? null}, sku),
        price_paise = COALESCE(${body.pricePaise ?? null}, price_paise),
        mrp_paise   = COALESCE(${body.mrpPaise ?? null}, mrp_paise),
        stock_qty   = COALESCE(${body.stockQty ?? null}, stock_qty),
        weight_g    = ${body.weightG !== undefined ? sql`${body.weightG}` : sql`weight_g`},
        attributes  = COALESCE(${body.attributes ? JSON.stringify(body.attributes) : null}::jsonb, attributes),
        is_active   = COALESCE(${body.isActive ?? null}, is_active)
       WHERE id = ${params.id}::uuid
      RETURNING id, product_id, name, sku, price_paise, mrp_paise, stock_qty, is_active
    `);
    if (updated.rows.length === 0) throw new ApiError(404, "not_found", "Variant not found.");
    return updated.rows[0];
  }),
);

// ── Banner CRUD ──────────────────────────────────────────────────────────────────
const BannerBody = z.object({
  organizationId: z.string().uuid(),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300).optional(),
  imageUrl: z.string().min(1),
  bgColor: z.string().max(20).default("#16A34A"),
  link: z.string().max(500).optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});
router.post(
  "/banners",
  authedRoute({ body: BannerBody }, async ({ db, body, res }) => {
    const inserted = await db.execute(sql`
      INSERT INTO public.shop_banners
        (id, organization_id, title, subtitle, image_url, bg_color, link, sort_order, is_active)
      VALUES (${uuidv7()}::uuid, ${body.organizationId}::uuid, ${body.title}, ${body.subtitle ?? null},
              ${body.imageUrl}, ${body.bgColor}, ${body.link ?? null}, ${body.sortOrder}, ${body.isActive})
      RETURNING id, organization_id, title, image_url, sort_order, is_active
    `);
    res.status(201);
    return inserted.rows[0];
  }),
);

router.delete(
  "/banners/:id",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const del = await db.execute(sql`
      DELETE FROM public.shop_banners WHERE id = ${params.id}::uuid RETURNING id
    `);
    if (del.rows.length === 0) throw new ApiError(404, "not_found", "Banner not found.");
    return { deleted: true };
  }),
);

// ── Coach product recommendations CRUD ───────────────────────────────────────────
// recommended_by_user_id is the authoring coach (provenance, survives transfer/removal);
// coach_name / coach_avatar_url are denormalized snapshots that survive coach removal.
const RecBody = z.object({
  organizationId: z.string().uuid(),
  coachId: z.string().uuid(),
  coachName: z.string().min(1).max(200),
  coachAvatarUrl: z.string().optional(),
  productId: z.string().uuid(),
  clinicalNote: z.string().max(1000).optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});
router.post(
  "/recommendations",
  authedRoute({ body: RecBody }, async ({ db, body, res }) => {
    const inserted = await db.execute(sql`
      INSERT INTO public.coach_product_recommendations
        (id, organization_id, recommended_by_user_id, coach_id, coach_name, coach_avatar_url,
         product_id, clinical_note, sort_order, is_active)
      VALUES (${uuidv7()}::uuid, ${body.organizationId}::uuid, auth.uid(), ${body.coachId}::uuid,
              ${body.coachName}, ${body.coachAvatarUrl ?? null}, ${body.productId}::uuid,
              ${body.clinicalNote ?? null}, ${body.sortOrder}, ${body.isActive})
      RETURNING id, organization_id, recommended_by_user_id, coach_id, product_id, is_active
    `);
    res.status(201);
    return inserted.rows[0];
  }),
);

router.delete(
  "/recommendations/:id",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const del = await db.execute(sql`
      DELETE FROM public.coach_product_recommendations WHERE id = ${params.id}::uuid RETURNING id
    `);
    if (del.rows.length === 0) throw new ApiError(404, "not_found", "Recommendation not found.");
    return { deleted: true };
  }),
);

export default router;
