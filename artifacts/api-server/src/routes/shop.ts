// =============================================================================
// Vitalé — D12 Shop HTTP surface (public storefront / catalog reads)
// -----------------------------------------------------------------------------
// Canonical pipeline (authedRoute → withUserContext): validate → user context → DB →
// map errors → respond. Authorization is owned by the D12 RLS policies + grants
// (post/0139_commerce_lifecycle.sql), NOT re-implemented here:
//
//   • products / product_variants / shop_banners / coach_product_recommendations —
//     org-owned [C]. Public catalog reads are governed by *_select_public policies
//     (USING is_active = true); merchant CRUD is gated by is_org_member(org,'manage_products').
//   • product_categories [lookup] — platform-global controlled vocabulary; read-only.
//   • product_reviews [B] — public read, owner insert (handled in cart/merchant surfaces).
//
// These are storefront reads, so we only ever SELECT here. Every active product/variant
// is visible to any caller by policy — the RLS-live `db` returns exactly the public set.
// No service-role handle, no Drizzle query-builder business logic, no client-trusted state.
// =============================================================================
import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { authedRoute } from "../lib/route";
import { ApiError } from "../lib/http";

const router: IRouter = Router();

// =============================================================================
// GET /shop/home — storefront landing payload: active banners, categories, and
// product cards (each with its active variants), plus derived bestseller/offer/new
// rails and the coach-curated recommendations. All reads are RLS-public (is_active).
// =============================================================================
router.get(
  "/home",
  authedRoute({}, async ({ db }) => {
    const [banners, categories, productRows, recs] = await Promise.all([
      db.execute(sql`
        SELECT id, organization_id, title, subtitle, image_url, bg_color, link, sort_order
          FROM public.shop_banners
         WHERE is_active = true
         ORDER BY sort_order ASC
      `),
      db.execute(sql`
        SELECT id, name, slug, description, image_url, parent_id, sort_order
          FROM public.product_categories
         WHERE is_active = true
         ORDER BY sort_order ASC
      `),
      // Product cards with their active variants folded in as a JSON array,
      // cheapest-first (so variants[0] is the headline price).
      db.execute(sql`
        SELECT p.id, p.organization_id, p.name, p.slug, p.short_description,
               p.images, p.avg_rating, p.review_count, p.is_bestseller,
               p.is_new_in_store, p.is_featured, p.gst_rate, p.benefits, p.created_at,
               COALESCE(
                 (SELECT jsonb_agg(v ORDER BY v.price_paise ASC)
                    FROM (
                      SELECT id, product_id, name, sku, price_paise, mrp_paise, stock_qty, attributes
                        FROM public.product_variants
                       WHERE product_id = p.id AND is_active = true
                    ) v),
                 '[]'::jsonb
               ) AS variants
          FROM public.products p
         WHERE p.is_active = true
      `),
      db.execute(sql`
        SELECT id, organization_id, recommended_by_user_id, coach_id, coach_name,
               coach_avatar_url, product_id, clinical_note, sort_order
          FROM public.coach_product_recommendations
         WHERE is_active = true
         ORDER BY sort_order ASC
      `),
    ]);

    const products = productRows.rows as Array<Record<string, any>>;
    const byId = new Map(products.map((p) => [p.id, p]));

    const bestsellers = products.filter((p) => p.is_bestseller).slice(0, 8);
    const newInStore = products
      .filter((p) => p.is_new_in_store)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 6);
    const offers = products
      .filter((p) => {
        const v = p.variants?.[0];
        if (!v || !v.mrp_paise) return false;
        return ((v.mrp_paise - v.price_paise) / v.mrp_paise) * 100 >= 15;
      })
      .slice(0, 6);
    const featured = products.find((p) => p.is_featured) ?? products[0] ?? null;
    const coachCurated = (recs.rows as Array<Record<string, any>>).map((rec) => ({
      ...rec,
      product: byId.get(rec.product_id) ?? null,
    }));

    return {
      banners: banners.rows,
      categories: categories.rows,
      bestsellers,
      offers,
      newInStore,
      coachCurated,
      featured,
      stats: { users: "12K+", rating: "4.7", coaches: "200+", avgStreak: "9 days" },
    };
  }),
);

// =============================================================================
// GET /shop/categories/:slug/products — paginated, filterable catalog browse.
// slug = "all" browses across categories. Price/discount/sort are applied server-side
// against the cheapest active variant. RLS limits the set to active public products.
// =============================================================================
const SlugParam = z.object({ slug: z.string().min(1).max(200) });
const BrowseQuery = z.object({
  sort: z.enum(["default", "price_asc", "price_desc", "rating", "newest"]).default("default"),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  minDiscount: z.coerce.number().int().min(0).max(100).optional(),
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
router.get(
  "/categories/:slug/products",
  authedRoute({ params: SlugParam, query: BrowseQuery }, async ({ db, params, query }) => {
    let category: Record<string, any> | null = null;
    if (params.slug !== "all") {
      const cat = await db.execute(sql`
        SELECT id, name, slug, description, image_url, parent_id, sort_order
          FROM public.product_categories
         WHERE slug = ${params.slug} AND is_active = true
      `);
      category = (cat.rows[0] as Record<string, any>) ?? null;
      if (!category) throw new ApiError(404, "not_found", "Category not found.");
    }

    const categoryClause = category ? sql`AND p.category_id = ${category.id}::uuid` : sql``;
    const searchClause = query.q
      ? sql`AND (p.name ILIKE ${"%" + query.q + "%"} OR p.short_description ILIKE ${"%" + query.q + "%"})`
      : sql``;

    const rows = await db.execute(sql`
      SELECT p.id, p.organization_id, p.name, p.slug, p.short_description,
             p.images, p.avg_rating, p.review_count, p.is_bestseller,
             p.is_new_in_store, p.is_featured, p.gst_rate, p.benefits, p.created_at,
             COALESCE(
               (SELECT jsonb_agg(v ORDER BY v.price_paise ASC)
                  FROM (
                    SELECT id, product_id, name, sku, price_paise, mrp_paise, stock_qty, attributes
                      FROM public.product_variants
                     WHERE product_id = p.id AND is_active = true
                  ) v),
               '[]'::jsonb
             ) AS variants
        FROM public.products p
       WHERE p.is_active = true
         ${categoryClause}
         ${searchClause}
    `);

    let products = rows.rows as Array<Record<string, any>>;

    // Filters against the cheapest active variant.
    if (query.minPrice !== undefined)
      products = products.filter((p) => (p.variants?.[0]?.price_paise ?? Infinity) >= query.minPrice!);
    if (query.maxPrice !== undefined)
      products = products.filter((p) => (p.variants?.[0]?.price_paise ?? -1) <= query.maxPrice!);
    if (query.minDiscount !== undefined)
      products = products.filter((p) => {
        const v = p.variants?.[0];
        if (!v || !v.mrp_paise) return false;
        return ((v.mrp_paise - v.price_paise) / v.mrp_paise) * 100 >= query.minDiscount!;
      });

    if (query.sort === "price_asc")
      products.sort((a, b) => (a.variants?.[0]?.price_paise ?? 0) - (b.variants?.[0]?.price_paise ?? 0));
    else if (query.sort === "price_desc")
      products.sort((a, b) => (b.variants?.[0]?.price_paise ?? 0) - (a.variants?.[0]?.price_paise ?? 0));
    else if (query.sort === "rating")
      products.sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0));
    else if (query.sort === "newest")
      products.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

    const total = products.length;
    const offset = (query.page - 1) * query.limit;
    return {
      category,
      products: products.slice(offset, offset + query.limit),
      total,
      page: query.page,
      limit: query.limit,
    };
  }),
);

// =============================================================================
// GET /shop/products/:id — product detail: the product, its active variants
// (cheapest-first), and the latest reviews. RLS gates visibility to active products.
// =============================================================================
const IdParam = z.object({ id: z.string().uuid() });
router.get(
  "/products/:id",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const prod = await db.execute(sql`
      SELECT id, organization_id, name, slug, description, short_description,
             category_id, brand, images, tags, benefits, is_featured, is_bestseller,
             is_new_in_store, hsn_code, gst_rate, avg_rating, review_count, created_at
        FROM public.products
       WHERE id = ${params.id}::uuid AND is_active = true
    `);
    const product = prod.rows[0] as Record<string, any> | undefined;
    if (!product) throw new ApiError(404, "not_found", "Product not found.");

    const [variants, reviews] = await Promise.all([
      db.execute(sql`
        SELECT id, product_id, name, sku, price_paise, mrp_paise, stock_qty,
               weight_g, attributes
          FROM public.product_variants
         WHERE product_id = ${params.id}::uuid AND is_active = true
         ORDER BY price_paise ASC
      `),
      db.execute(sql`
        SELECT id, product_id, user_id, rating, title, body, is_verified, created_at
          FROM public.product_reviews
         WHERE product_id = ${params.id}::uuid
         ORDER BY created_at DESC
         LIMIT 10
      `),
    ]);

    return { ...product, variants: variants.rows, reviews: reviews.rows };
  }),
);

export default router;
