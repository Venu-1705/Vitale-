import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { pkV7, timestamps } from "./_shared";
import { users } from "./identity";
import { coachOrganizations } from "./organizations";

// Immutable-create helper
const createdAtOnly = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
};

// =============================================================================
// D12 — Shop Domain (new conventions: UUID PKs, users FK, RLS-ready)
// =============================================================================

// product_categories — hierarchical catalog categories [C]
export const productCategories = pgTable(
  "product_categories",
  {
    id: pkV7(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    parentId: uuid("parent_id"), // self-referential; no FK constraint to avoid cycle issues
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...createdAtOnly,
  },
  (t) => [uniqueIndex("product_categories_slug_key").on(t.slug)],
);

// products — product catalog [C]
export const products = pgTable(
  "products",
  {
    id: pkV7(),
    // org-owned (arch §D12: products belong to the organization). NOT NULL.
    organizationId: uuid("organization_id").notNull().references(() => coachOrganizations.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    shortDescription: text("short_description").notNull().default(""),
    categoryId: uuid("category_id").notNull().references(() => productCategories.id),
    brand: text("brand"),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    benefits: jsonb("benefits").$type<string[]>().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    isBestseller: boolean("is_bestseller").notNull().default(false),
    isNewInStore: boolean("is_new_in_store").notNull().default(false),
    hsnCode: text("hsn_code"),
    gstRate: integer("gst_rate").notNull().default(18),
    avgRating: integer("avg_rating").notNull().default(0),
    reviewCount: integer("review_count").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("products_slug_key").on(t.slug),
    index("products_category_idx").on(t.categoryId),
    index("products_org_idx").on(t.organizationId),
  ],
);

// product_variants — SKU-level variant (size, flavour, etc.) [C]
export const productVariants = pgTable(
  "product_variants",
  {
    id: pkV7(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    pricePaise: bigint("price_paise", { mode: "number" }).notNull(), // arch §2: money = bigint paise
    mrpPaise: bigint("mrp_paise", { mode: "number" }).notNull(),
    stockQty: integer("stock_qty").notNull().default(0), // CHECK (stock_qty >= 0) in 0138
    weightG: integer("weight_g"),
    attributes: jsonb("attributes").$type<Record<string, string>>().notNull().default({}),
    isActive: boolean("is_active").notNull().default(true),
    ...createdAtOnly,
  },
  (t) => [
    uniqueIndex("product_variants_sku_key").on(t.sku),
    index("variants_product_idx").on(t.productId),
  ],
);

// product_reviews — user review of a product [B immutable after submission]
export const productReviews = pgTable(
  "product_reviews",
  {
    id: pkV7(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id),
    rating: integer("rating").notNull(),
    title: text("title"),
    body: text("body"),
    isVerified: boolean("is_verified").notNull().default(false),
    ...createdAtOnly,
  },
  (t) => [index("reviews_product_idx").on(t.productId)],
);

// shop_banners — marketing banners for the shop home [C]
export const shopBanners = pgTable(
  "shop_banners",
  {
    id: pkV7(),
    // org-owned (arch §D12: shop assets belong to the organization). NOT NULL.
    organizationId: uuid("organization_id").notNull().references(() => coachOrganizations.id),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    imageUrl: text("image_url").notNull(),
    bgColor: text("bg_color").notNull().default("#16A34A"),
    link: text("link"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...createdAtOnly,
  },
  (t) => [index("shop_banners_org_idx").on(t.organizationId)],
);

// coach_product_recommendations — coach endorses a product for patients [C]
export const coachProductRecommendations = pgTable(
  "coach_product_recommendations",
  {
    id: pkV7(),
    // org-owned (arch §D12). NOT NULL. Endorsement belongs to the organization, not the individual.
    organizationId: uuid("organization_id").notNull().references(() => coachOrganizations.id),
    // authoring-coach provenance (survives transfer/removal alongside the denormalized snapshot).
    recommendedByUserId: uuid("recommended_by_user_id").notNull().references(() => users.id),
    coachId: uuid("coach_id").notNull().references(() => users.id),
    coachName: text("coach_name").notNull(),  // denormalized display snapshot (survives coach removal)
    coachAvatarUrl: text("coach_avatar_url"),
    productId: uuid("product_id").notNull().references(() => products.id),
    clinicalNote: text("clinical_note"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...createdAtOnly,
  },
  (t) => [index("cpr_org_idx").on(t.organizationId)],
);

// =============================================================================
// Validators
// =============================================================================
export const insertProductCategorySchema         = createInsertSchema(productCategories);
export const selectProductCategorySchema         = createSelectSchema(productCategories);
export const insertProductSchema                 = createInsertSchema(products);
export const selectProductSchema                 = createSelectSchema(products);
export const insertProductVariantSchema          = createInsertSchema(productVariants);
export const selectProductVariantSchema          = createSelectSchema(productVariants);
export const insertProductReviewSchema           = createInsertSchema(productReviews);
export const selectProductReviewSchema           = createSelectSchema(productReviews);
export const insertShopBannerSchema              = createInsertSchema(shopBanners);
export const selectShopBannerSchema              = createSelectSchema(shopBanners);
export const insertCoachProductRecSchema         = createInsertSchema(coachProductRecommendations);
export const selectCoachProductRecSchema         = createSelectSchema(coachProductRecommendations);
