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
import { orderStatus } from "./enums";
import { users } from "./identity";
import { coachOrganizations } from "./organizations";
import { products, productVariants } from "./shop";

// Immutable-create helper
const createdAtOnly = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
};

// =============================================================================
// D12 — Commerce Domain (new conventions: UUID PKs, users FK, RLS-ready)
// =============================================================================

// addresses — user delivery addresses [C]
export const addresses = pgTable(
  "addresses",
  {
    id: pkV7(),
    userId: uuid("user_id").notNull().references(() => users.id),
    label: text("label").notNull().default("Home"),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    line1: text("line1").notNull(),
    line2: text("line2"),
    city: text("city").notNull(),
    state: text("state").notNull(),
    pincode: text("pincode").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    ...createdAtOnly,
  },
  (t) => [index("addresses_user_idx").on(t.userId)],
);

// carts — one active cart per user [C]
export const carts = pgTable(
  "carts",
  {
    id: pkV7(),
    userId: uuid("user_id").notNull().references(() => users.id),
    ...timestamps,
  },
  (t) => [uniqueIndex("carts_user_key").on(t.userId)],
);

// cart_items — line items in a cart [C]
export const cartItems = pgTable(
  "cart_items",
  {
    id: pkV7(),
    cartId: uuid("cart_id").notNull().references(() => carts.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id),
    variantId: uuid("variant_id").notNull().references(() => productVariants.id),
    qty: integer("qty").notNull().default(1),
    ...createdAtOnly,
  },
  (t) => [index("cart_items_cart_idx").on(t.cartId)],
);

// shop_orders — placed order, org-owned (per-merchant; carts split per organization) [C]
export const shopOrders = pgTable(
  "shop_orders",
  {
    id: pkV7(),
    userId: uuid("user_id").notNull().references(() => users.id),
    // the merchant org this order belongs to (arch §D12: per-merchant orders). NOT NULL.
    organizationId: uuid("organization_id").notNull().references(() => coachOrganizations.id),
    addressId: uuid("address_id").references(() => addresses.id),
    status: orderStatus("status").notNull().default("pending"),
    subtotalPaise: bigint("subtotal_paise", { mode: "number" }).notNull(), // arch §2: money = bigint paise
    discountPaise: bigint("discount_paise", { mode: "number" }).notNull().default(0),
    shippingPaise: bigint("shipping_paise", { mode: "number" }).notNull().default(0),
    gstPaise: bigint("gst_paise", { mode: "number" }).notNull().default(0),
    totalPaise: bigint("total_paise", { mode: "number" }).notNull(),
    // gateway-neutral payment seam (Cashfree / Razorpay / Stripe / COD / future).
    gatewayProvider: text("gateway_provider"),
    gatewayOrderId: text("gateway_order_id"),
    gatewayPaymentId: text("gateway_payment_id"),
    couponCode: text("coupon_code"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    index("orders_user_idx").on(t.userId),
    index("shop_orders_org_idx").on(t.organizationId),
    index("shop_orders_org_status_idx").on(t.organizationId, t.status),
  ],
);

// shop_order_items — line items in a placed order [B immutable after placement]
export const shopOrderItems = pgTable(
  "shop_order_items",
  {
    id: pkV7(),
    orderId: uuid("order_id").notNull().references(() => shopOrders.id),
    productId: uuid("product_id").notNull().references(() => products.id),
    variantId: uuid("variant_id").notNull().references(() => productVariants.id),
    name: text("name").notNull(),
    variantName: text("variant_name").notNull(),
    qty: integer("qty").notNull(),
    pricePaise: bigint("price_paise", { mode: "number" }).notNull(), // arch §2: money = bigint paise
    gstRate: integer("gst_rate").notNull().default(18),
    ...createdAtOnly,
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

// shop_order_events — lifecycle events for an order (append-only log) [B]
export const shopOrderEvents = pgTable(
  "shop_order_events",
  {
    id: pkV7(),
    orderId: uuid("order_id").notNull().references(() => shopOrders.id),
    status: text("status").notNull(),
    note: text("note"),
    ...createdAtOnly,
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

// invoices — B2C GST invoices for shop orders [B immutable after issue]
//   Seller (and buyer) identity is SNAPSHOTTED at issue time so a historical invoice stays
//   accurate even if the merchant later changes legal_name / gstin / business_address.
export const invoices = pgTable(
  "invoices",
  {
    id: pkV7(),
    orderId: uuid("order_id").notNull().references(() => shopOrders.id),
    // the merchant org that issued this invoice (arch §D12). NOT NULL.
    organizationId: uuid("organization_id").notNull().references(() => coachOrganizations.id),
    invoiceNumber: text("invoice_number").notNull(),
    // immutable identity snapshots (legal_name, gstin, business_address, etc.) at issue time.
    sellerSnapshot: jsonb("seller_snapshot").$type<Record<string, unknown>>().notNull(),
    buyerSnapshot: jsonb("buyer_snapshot").$type<Record<string, unknown>>(),
    totalPaise: bigint("total_paise", { mode: "number" }).notNull(),
    pdfUrl: text("pdf_url"),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    ...createdAtOnly,
  },
  (t) => [
    uniqueIndex("invoices_number_key").on(t.invoiceNumber),
    index("invoices_org_idx").on(t.organizationId),
  ],
);

// =============================================================================
// Validators
// =============================================================================
export const insertAddressSchema       = createInsertSchema(addresses);
export const selectAddressSchema       = createSelectSchema(addresses);
export const insertCartSchema          = createInsertSchema(carts);
export const selectCartSchema          = createSelectSchema(carts);
export const insertCartItemSchema      = createInsertSchema(cartItems);
export const selectCartItemSchema      = createSelectSchema(cartItems);
export const insertShopOrderSchema     = createInsertSchema(shopOrders);
export const selectShopOrderSchema     = createSelectSchema(shopOrders);
export const insertShopOrderItemSchema = createInsertSchema(shopOrderItems);
export const selectShopOrderItemSchema = createSelectSchema(shopOrderItems);
export const insertShopOrderEventSchema = createInsertSchema(shopOrderEvents);
export const selectShopOrderEventSchema = createSelectSchema(shopOrderEvents);
export const insertInvoiceSchema       = createInsertSchema(invoices);
export const selectInvoiceSchema       = createSelectSchema(invoices);
