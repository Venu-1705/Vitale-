-- =============================================================================
-- Vitalé — Post-companion 0138: D12 Commerce SCHEMA ALIGNMENT (frozen-arch compliance)
-- Ground truth: VITALE_DB_ARCHITECTURE §D12 ("products and all shop assets belong to the
-- organization (organization_id NOT NULL); … All uuidv7 PK, bigint paise + currency,
-- timestamptz, enum statuses").
--
-- WHY THIS FILE EXISTS:
--   The deployed Drizzle schema (shop.ts / commerce.ts) implements an OLD single-merchant
--   "Vitalé store" shape that DIVERGES from the frozen architecture:
--     • products / shop_banners / coach_product_recommendations had NO organization_id
--       (platform-global) — the arch mandates org-OWNED commerce assets.
--     • money columns were `integer` paise — the arch mandates `bigint`.
--     • shop_orders.status was free-text — the arch mandates an enum status.
--     • payment columns were razorpay-specific — the platform is gateway-neutral
--       (Cashfree / Razorpay / Stripe / COD / future) per the accepted decision.
--   This migration brings the LIVE tables into compliance. The matching change is mirrored
--   into the Drizzle DDL (src/schema/enums.ts, shop.ts, commerce.ts) so a fresh provision
--   produces the aligned shape directly; this file is the in-place ALTER for the existing
--   cluster and is fully IDEMPOTENT (guarded ADD/SET/RENAME/TYPE), so it is a safe no-op on
--   a fresh cluster where Drizzle already created the aligned columns.
--
-- SAFETY: all D12 tables are empty at alignment time (verified: 0 rows in
--   products/product_variants/shop_banners/coach_product_recommendations/shop_orders), so the
--   NOT NULL / FK adds and TYPE narrowings need no data backfill.
--
-- LEXICAL ORDER: must run BEFORE 0139_commerce_lifecycle.sql (which assumes the aligned shape).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECTION 0 — order_status enum (replaces free-text shop_orders.status).
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE public.order_status AS ENUM
      ('pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- SECTION 1 — products → org-owned.
-- -----------------------------------------------------------------------------
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS organization_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_organization_id_fk') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_organization_id_fk
      FOREIGN KEY (organization_id) REFERENCES public.coach_organizations(id);
  END IF;
END $$;
ALTER TABLE public.products ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS products_org_idx ON public.products(organization_id);

-- -----------------------------------------------------------------------------
-- SECTION 2 — shop_banners → org-owned.
-- -----------------------------------------------------------------------------
ALTER TABLE public.shop_banners ADD COLUMN IF NOT EXISTS organization_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_banners_organization_id_fk') THEN
    ALTER TABLE public.shop_banners
      ADD CONSTRAINT shop_banners_organization_id_fk
      FOREIGN KEY (organization_id) REFERENCES public.coach_organizations(id);
  END IF;
END $$;
ALTER TABLE public.shop_banners ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS shop_banners_org_idx ON public.shop_banners(organization_id);

-- -----------------------------------------------------------------------------
-- SECTION 3 — coach_product_recommendations → org-owned + authoring-coach provenance.
--   Arch: organization_id + recommended_by_user_id. The denormalized coach_name /
--   coach_avatar_url are PRESERVED (display snapshot; survive coach transfer/removal).
-- -----------------------------------------------------------------------------
ALTER TABLE public.coach_product_recommendations ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE public.coach_product_recommendations ADD COLUMN IF NOT EXISTS recommended_by_user_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cpr_organization_id_fk') THEN
    ALTER TABLE public.coach_product_recommendations
      ADD CONSTRAINT cpr_organization_id_fk
      FOREIGN KEY (organization_id) REFERENCES public.coach_organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cpr_recommended_by_user_id_fk') THEN
    ALTER TABLE public.coach_product_recommendations
      ADD CONSTRAINT cpr_recommended_by_user_id_fk
      FOREIGN KEY (recommended_by_user_id) REFERENCES public.users(id);
  END IF;
END $$;
-- recommended_by_user_id backfills from the existing coach_id (same person) before NOT NULL.
UPDATE public.coach_product_recommendations
   SET recommended_by_user_id = coach_id
 WHERE recommended_by_user_id IS NULL;
ALTER TABLE public.coach_product_recommendations ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.coach_product_recommendations ALTER COLUMN recommended_by_user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS cpr_org_idx ON public.coach_product_recommendations(organization_id);

-- -----------------------------------------------------------------------------
-- SECTION 4 — money columns integer → bigint paise (arch §D12).
-- -----------------------------------------------------------------------------
ALTER TABLE public.product_variants ALTER COLUMN price_paise TYPE bigint;
ALTER TABLE public.product_variants ALTER COLUMN mrp_paise   TYPE bigint;
ALTER TABLE public.shop_order_items ALTER COLUMN price_paise TYPE bigint;
ALTER TABLE public.shop_orders ALTER COLUMN subtotal_paise TYPE bigint;
ALTER TABLE public.shop_orders ALTER COLUMN discount_paise TYPE bigint;
ALTER TABLE public.shop_orders ALTER COLUMN shipping_paise TYPE bigint;
ALTER TABLE public.shop_orders ALTER COLUMN gst_paise      TYPE bigint;
ALTER TABLE public.shop_orders ALTER COLUMN total_paise    TYPE bigint;

-- Stock can never go negative (DB-enforced invariant; rpc_checkout also locks + rejects).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_stock_nonneg') THEN
    ALTER TABLE public.product_variants
      ADD CONSTRAINT product_variants_stock_nonneg CHECK (stock_qty >= 0);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- SECTION 5 — shop_orders → org-owned (per-merchant orders), enum status,
--             gateway-neutral payment seam.
-- -----------------------------------------------------------------------------

-- 5a. organization_id (the merchant org this order belongs to; cart is split per-merchant).
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS organization_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_orders_organization_id_fk') THEN
    ALTER TABLE public.shop_orders
      ADD CONSTRAINT shop_orders_organization_id_fk
      FOREIGN KEY (organization_id) REFERENCES public.coach_organizations(id);
  END IF;
END $$;
ALTER TABLE public.shop_orders ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS shop_orders_org_idx ON public.shop_orders(organization_id);

-- 5b. gateway-neutral payment columns (rename razorpay_* → gateway_*; add provider).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name='shop_orders' AND column_name='razorpay_order_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name='shop_orders' AND column_name='gateway_order_id') THEN
    ALTER TABLE public.shop_orders RENAME COLUMN razorpay_order_id TO gateway_order_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name='shop_orders' AND column_name='razorpay_payment_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name='shop_orders' AND column_name='gateway_payment_id') THEN
    ALTER TABLE public.shop_orders RENAME COLUMN razorpay_payment_id TO gateway_payment_id;
  END IF;
END $$;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS gateway_order_id   text;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS gateway_payment_id text;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS gateway_provider   text;

-- 5c. status text → order_status enum.
DO $$ BEGIN
  IF (SELECT data_type FROM information_schema.columns
        WHERE table_name='shop_orders' AND column_name='status') = 'text' THEN
    ALTER TABLE public.shop_orders ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE public.shop_orders ALTER COLUMN status TYPE public.order_status
      USING (CASE lower(status)
               WHEN 'paid'      THEN 'confirmed'
               WHEN 'confirmed' THEN 'confirmed'
               WHEN 'packed'    THEN 'packed'
               WHEN 'shipped'   THEN 'shipped'
               WHEN 'delivered' THEN 'delivered'
               WHEN 'cancelled' THEN 'cancelled'
               WHEN 'refunded'  THEN 'refunded'
               ELSE 'pending'
             END::public.order_status);
    ALTER TABLE public.shop_orders ALTER COLUMN status SET DEFAULT 'pending';
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS shop_orders_org_status_idx ON public.shop_orders(organization_id, status);

-- -----------------------------------------------------------------------------
-- SECTION 6 — invoices → seller-identity snapshot (immutable historical accuracy).
--   A GST invoice must remain accurate even if the merchant later changes legal_name /
--   gstin / business_address — so we snapshot the seller (and buyer) at issue time.
-- -----------------------------------------------------------------------------
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS seller_snapshot jsonb;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS buyer_snapshot  jsonb;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS total_paise     bigint;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS issued_at       timestamptz NOT NULL DEFAULT now();
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_organization_id_fk') THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_organization_id_fk
      FOREIGN KEY (organization_id) REFERENCES public.coach_organizations(id);
  END IF;
END $$;
ALTER TABLE public.invoices ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN seller_snapshot SET NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN total_paise     SET NOT NULL;
CREATE INDEX IF NOT EXISTS invoices_org_idx ON public.invoices(organization_id);

DO $$ BEGIN
  RAISE NOTICE '0138 commerce schema alignment applied — D12 tables now org-owned, bigint paise, enum status, gateway-neutral.';
END $$;
