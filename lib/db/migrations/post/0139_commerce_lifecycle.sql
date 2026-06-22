-- =============================================================================
-- Vitalé — Post-companion 0139: D12 Commerce lifecycle (CANONICAL, production-grade)
-- Ground truth: VITALE_DB_ARCHITECTURE §D12 (org-owned marketplace; bigint paise + currency;
-- enum order_status; gateway-neutral payment seam; GST invoices with immutable seller snapshot).
--
-- WHAT THIS FILE OWNS (and why it supersedes 0123):
--   0123_shop_commerce_rls.sql was authored for the OLD single-merchant "Vitalé store" shape
--   (no organization_id on products/orders, free-text status, owner-reads-only orders, service-role
--   writes). It was NEVER applied to the live cluster (0 policies live, RLS disabled). The frozen
--   architecture is an ORG-OWNED MARKETPLACE: every commerce asset belongs to an organization,
--   orders are per-merchant, fulfilment is an enum state-machine, and merchant operations are
--   org-scoped through existing capabilities (manage_products / view_revenue). The schema was
--   aligned in 0138_commerce_schema_alignment.sql; THIS file authors the complete lifecycle:
--   RLS (customer-ownership + merchant-org-scope + public-catalog), server-authoritative checkout
--   (multi-merchant split, FOR UPDATE stock locking, hard oversell rejection, GST server-side,
--   client totals/discounts structurally ignored), the order state-machine with DB-enforced legal
--   transitions + auto-logged audit events, gateway-neutral payment confirmation with webhook-replay
--   idempotency, and GST invoice issuance with an immutable seller/buyer snapshot.
--   0123 is neutralized to a no-op stub in the same change set (it is lexically earlier; this file
--   is authoritative on any full `db:raw:post` re-run).
--
-- ORG-OWNERSHIP / SELLER-IDENTITY CONTRACT (design decisions, enforced below):
--   • Every product / variant / banner / recommendation / order / invoice is stamped
--     organization_id (NOT NULL, FK → coach_organizations). Merchant reach is decided ONLY by
--     active org membership holding the relevant capability — never by an individual coach id.
--   • Coach transfer / removal — orders, invoices and recommendations bind to the ORG, so replacing
--     a coach has zero effect on visibility; a new member with the capability inherits it. The
--     recommendation's denormalized coach_name / coach_avatar_url + recommended_by_user_id preserve
--     the original endorser as a display snapshot that survives the coach leaving (0138).
--   • Historical seller identity — a GST invoice snapshots the seller (business_name / legal_name /
--     gstin / business_address) AND buyer at issue time into immutable jsonb, so the invoice stays
--     accurate even if the merchant later edits its profile. Invoices are append-only [B].
--
-- CAPABILITY GATING (no new enum — arch directive):
--   • view_revenue   → read orders / order items / events / invoices for the merchant org.
--   • manage_products→ catalog CRUD (products/variants/banners/recommendations) AND order fulfilment
--     (advance status, refund) and payment confirmation for the merchant org.
--
-- DEFERRALS (clean single flip-points; no rework when they land):
--   • D8 Payments — rpc_confirm_order_payment is the gateway-neutral seam (provider-agnostic). Real
--     gateway webhooks (Cashfree/Razorpay/Stripe) call it; until then it is an authed merchant action.
--     Coupons/discounts are NOT modelled (discount_paise stays 0, server-authoritative).
--   • D15 Assets — invoices.pdf_url stays text/NULL (PDF rendering is an asset-domain concern).
--
-- Idempotent: CREATE OR REPLACE; DROP … IF EXISTS; DROP POLICY IF EXISTS/CREATE POLICY; guarded seq.
-- Apply order: after migrate + after 0138 (lexical). Owner = migration role `v` (BYPASSRLS) → all
-- SECURITY DEFINER bodies below run with RLS bypass on the tables they touch.
-- =============================================================================

-- =============================================================================
-- SECTION 1 — enable + FORCE RLS on all D12 tables.
--   FORCE so the table owner is also subject to policies (defense-in-depth). The app connects as
--   `authenticated` (non-bypassrls) and is always subject; the SECURITY DEFINER RPCs/triggers run
--   as `v` (BYPASSRLS) which overrides FORCE — the intended privileged write path.
-- =============================================================================
ALTER TABLE public.product_categories            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories            FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.products                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products                      FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.product_variants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants              FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews               FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.shop_banners                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_banners                  FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.coach_product_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_product_recommendations FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.addresses                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses                     FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.carts                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts                         FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.cart_items                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items                    FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.shop_orders                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_orders                   FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_items              FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_events             FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.invoices                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices                      FORCE  ROW LEVEL SECURITY;

-- =============================================================================
-- SECTION 2 — table privileges.
--   Orders / items / events / invoices have NO INSERT/UPDATE/DELETE to authenticated: they are
--   written ONLY by the SECURITY DEFINER RPCs (checkout / confirm / advance / cancel) and triggers.
--   Catalog has merchant write (policy-gated). Personal data (addresses/carts) is full owner CRUD.
-- =============================================================================

-- Catalog: public read + merchant write (write rows are policy-gated to the owning org).
REVOKE ALL ON public.product_categories            FROM anon, authenticated;
REVOKE ALL ON public.products                      FROM anon, authenticated;
REVOKE ALL ON public.product_variants              FROM anon, authenticated;
REVOKE ALL ON public.shop_banners                  FROM anon, authenticated;
REVOKE ALL ON public.coach_product_recommendations FROM anon, authenticated;
GRANT  SELECT ON public.product_categories TO anon, authenticated;            -- platform-global, admin-managed
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.products                      TO authenticated;
GRANT  SELECT ON public.products                      TO anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.product_variants              TO authenticated;
GRANT  SELECT ON public.product_variants              TO anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.shop_banners                  TO authenticated;
GRANT  SELECT ON public.shop_banners                  TO anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.coach_product_recommendations TO authenticated;
GRANT  SELECT ON public.coach_product_recommendations TO anon;

-- Reviews: public read; authenticated insert own.
REVOKE ALL    ON public.product_reviews FROM anon, authenticated;
GRANT  SELECT ON public.product_reviews TO anon, authenticated;
GRANT  INSERT ON public.product_reviews TO authenticated;

-- Personal data: owner CRUD.
REVOKE ALL ON public.addresses  FROM anon, authenticated;
REVOKE ALL ON public.carts      FROM anon, authenticated;
REVOKE ALL ON public.cart_items FROM anon, authenticated;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.addresses  TO authenticated;
GRANT  SELECT, INSERT, UPDATE         ON public.carts      TO authenticated;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;

-- Orders & friends: SELECT only (all writes go through SECURITY DEFINER RPCs).
REVOKE ALL    ON public.shop_orders       FROM anon, authenticated;
REVOKE ALL    ON public.shop_order_items  FROM anon, authenticated;
REVOKE ALL    ON public.shop_order_events FROM anon, authenticated;
REVOKE ALL    ON public.invoices          FROM anon, authenticated;
GRANT  SELECT ON public.shop_orders       TO authenticated;
GRANT  SELECT ON public.shop_order_items  TO authenticated;
GRANT  SELECT ON public.shop_order_events TO authenticated;
GRANT  SELECT ON public.invoices          TO authenticated;

-- =============================================================================
-- SECTION 3 — catalog / review / personal-data policies.
--   Public sees only ACTIVE catalog rows; a merchant additionally sees ALL of its OWN org's rows
--   (incl. inactive/draft) for dashboards. Merchant writes are gated to the owning org with
--   manage_products. product_categories is platform-global (admin via service_role) — read-only here.
-- =============================================================================

-- product_categories — public read of active (platform-global).
DROP POLICY IF EXISTS product_categories_select ON public.product_categories;
CREATE POLICY product_categories_select ON public.product_categories FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- products — public reads active; merchant reads/writes own org.
DROP POLICY IF EXISTS products_select_public ON public.products;
CREATE POLICY products_select_public ON public.products FOR SELECT TO anon, authenticated
  USING (is_active = true);
DROP POLICY IF EXISTS products_select_merchant ON public.products;
CREATE POLICY products_select_merchant ON public.products FOR SELECT TO authenticated
  USING (is_org_member(organization_id, 'manage_products'));
DROP POLICY IF EXISTS products_insert_merchant ON public.products;
CREATE POLICY products_insert_merchant ON public.products FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id, 'manage_products'));
DROP POLICY IF EXISTS products_update_merchant ON public.products;
CREATE POLICY products_update_merchant ON public.products FOR UPDATE TO authenticated
  USING (is_org_member(organization_id, 'manage_products'))
  WITH CHECK (is_org_member(organization_id, 'manage_products'));
DROP POLICY IF EXISTS products_delete_merchant ON public.products;
CREATE POLICY products_delete_merchant ON public.products FOR DELETE TO authenticated
  USING (is_org_member(organization_id, 'manage_products'));

-- product_variants — org resolved via parent product.
DROP POLICY IF EXISTS product_variants_select_public ON public.product_variants;
CREATE POLICY product_variants_select_public ON public.product_variants FOR SELECT TO anon, authenticated
  USING (is_active = true
         AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.is_active = true));
DROP POLICY IF EXISTS product_variants_select_merchant ON public.product_variants;
CREATE POLICY product_variants_select_merchant ON public.product_variants FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p
                  WHERE p.id = product_id AND is_org_member(p.organization_id, 'manage_products')));
DROP POLICY IF EXISTS product_variants_insert_merchant ON public.product_variants;
CREATE POLICY product_variants_insert_merchant ON public.product_variants FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p
                       WHERE p.id = product_id AND is_org_member(p.organization_id, 'manage_products')));
DROP POLICY IF EXISTS product_variants_update_merchant ON public.product_variants;
CREATE POLICY product_variants_update_merchant ON public.product_variants FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p
                  WHERE p.id = product_id AND is_org_member(p.organization_id, 'manage_products')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p
                       WHERE p.id = product_id AND is_org_member(p.organization_id, 'manage_products')));
DROP POLICY IF EXISTS product_variants_delete_merchant ON public.product_variants;
CREATE POLICY product_variants_delete_merchant ON public.product_variants FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p
                  WHERE p.id = product_id AND is_org_member(p.organization_id, 'manage_products')));

-- shop_banners — public reads active; merchant manages own org.
DROP POLICY IF EXISTS shop_banners_select_public ON public.shop_banners;
CREATE POLICY shop_banners_select_public ON public.shop_banners FOR SELECT TO anon, authenticated
  USING (is_active = true);
DROP POLICY IF EXISTS shop_banners_select_merchant ON public.shop_banners;
CREATE POLICY shop_banners_select_merchant ON public.shop_banners FOR SELECT TO authenticated
  USING (is_org_member(organization_id, 'manage_products'));
DROP POLICY IF EXISTS shop_banners_insert_merchant ON public.shop_banners;
CREATE POLICY shop_banners_insert_merchant ON public.shop_banners FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id, 'manage_products'));
DROP POLICY IF EXISTS shop_banners_update_merchant ON public.shop_banners;
CREATE POLICY shop_banners_update_merchant ON public.shop_banners FOR UPDATE TO authenticated
  USING (is_org_member(organization_id, 'manage_products'))
  WITH CHECK (is_org_member(organization_id, 'manage_products'));
DROP POLICY IF EXISTS shop_banners_delete_merchant ON public.shop_banners;
CREATE POLICY shop_banners_delete_merchant ON public.shop_banners FOR DELETE TO authenticated
  USING (is_org_member(organization_id, 'manage_products'));

-- coach_product_recommendations — public reads active; merchant manages own org.
DROP POLICY IF EXISTS cpr_select_public ON public.coach_product_recommendations;
CREATE POLICY cpr_select_public ON public.coach_product_recommendations FOR SELECT TO anon, authenticated
  USING (is_active = true);
DROP POLICY IF EXISTS cpr_select_merchant ON public.coach_product_recommendations;
CREATE POLICY cpr_select_merchant ON public.coach_product_recommendations FOR SELECT TO authenticated
  USING (is_org_member(organization_id, 'manage_products'));
DROP POLICY IF EXISTS cpr_insert_merchant ON public.coach_product_recommendations;
CREATE POLICY cpr_insert_merchant ON public.coach_product_recommendations FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id, 'manage_products'));
DROP POLICY IF EXISTS cpr_update_merchant ON public.coach_product_recommendations;
CREATE POLICY cpr_update_merchant ON public.coach_product_recommendations FOR UPDATE TO authenticated
  USING (is_org_member(organization_id, 'manage_products'))
  WITH CHECK (is_org_member(organization_id, 'manage_products'));
DROP POLICY IF EXISTS cpr_delete_merchant ON public.coach_product_recommendations;
CREATE POLICY cpr_delete_merchant ON public.coach_product_recommendations FOR DELETE TO authenticated
  USING (is_org_member(organization_id, 'manage_products'));

-- product_reviews — public read; owner inserts own.
DROP POLICY IF EXISTS reviews_select ON public.product_reviews;
CREATE POLICY reviews_select ON public.product_reviews FOR SELECT TO anon, authenticated
  USING (true);
DROP POLICY IF EXISTS reviews_insert ON public.product_reviews;
CREATE POLICY reviews_insert ON public.product_reviews FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- addresses — owner only.
DROP POLICY IF EXISTS addresses_select ON public.addresses;
CREATE POLICY addresses_select ON public.addresses FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS addresses_insert ON public.addresses;
CREATE POLICY addresses_insert ON public.addresses FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS addresses_update ON public.addresses;
CREATE POLICY addresses_update ON public.addresses FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS addresses_delete ON public.addresses;
CREATE POLICY addresses_delete ON public.addresses FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- carts — one per user.
DROP POLICY IF EXISTS carts_select ON public.carts;
CREATE POLICY carts_select ON public.carts FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS carts_insert ON public.carts;
CREATE POLICY carts_insert ON public.carts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS carts_update ON public.carts;
CREATE POLICY carts_update ON public.carts FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- cart_items — items in the caller's own cart.
DROP POLICY IF EXISTS cart_items_select ON public.cart_items;
CREATE POLICY cart_items_select ON public.cart_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id AND c.user_id = auth.uid()));
DROP POLICY IF EXISTS cart_items_insert ON public.cart_items;
CREATE POLICY cart_items_insert ON public.cart_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id AND c.user_id = auth.uid()));
DROP POLICY IF EXISTS cart_items_update ON public.cart_items;
CREATE POLICY cart_items_update ON public.cart_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id AND c.user_id = auth.uid()));
DROP POLICY IF EXISTS cart_items_delete ON public.cart_items;
CREATE POLICY cart_items_delete ON public.cart_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id AND c.user_id = auth.uid()));

-- =============================================================================
-- SECTION 4 — order / item / event / invoice read policies (customer OR merchant org).
--   No INSERT/UPDATE/DELETE policies: those tables are written only by SECURITY DEFINER paths.
-- =============================================================================

-- shop_orders — customer reads own; merchant reads own org's orders (view_revenue).
DROP POLICY IF EXISTS shop_orders_select_customer ON public.shop_orders;
CREATE POLICY shop_orders_select_customer ON public.shop_orders FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS shop_orders_select_merchant ON public.shop_orders;
CREATE POLICY shop_orders_select_merchant ON public.shop_orders FOR SELECT TO authenticated
  USING (is_org_member(organization_id, 'view_revenue'));

-- shop_order_items — via parent order (customer owner OR merchant org).
DROP POLICY IF EXISTS shop_order_items_select ON public.shop_order_items;
CREATE POLICY shop_order_items_select ON public.shop_order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shop_orders o
                  WHERE o.id = order_id
                    AND (o.user_id = auth.uid() OR is_org_member(o.organization_id, 'view_revenue'))));

-- shop_order_events — via parent order (customer owner OR merchant org).
DROP POLICY IF EXISTS shop_order_events_select ON public.shop_order_events;
CREATE POLICY shop_order_events_select ON public.shop_order_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shop_orders o
                  WHERE o.id = order_id
                    AND (o.user_id = auth.uid() OR is_org_member(o.organization_id, 'view_revenue'))));

-- invoices — via parent order (customer owner OR merchant org).
DROP POLICY IF EXISTS invoices_select ON public.invoices;
CREATE POLICY invoices_select ON public.invoices FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shop_orders o
                  WHERE o.id = order_id
                    AND (o.user_id = auth.uid() OR is_org_member(o.organization_id, 'view_revenue'))));

-- =============================================================================
-- SECTION 5 — order state-machine guard + auto-logged audit events.
--   Two triggers on shop_orders:
--     (a) tg_order_status_guard  BEFORE UPDATE OF status — rejects illegal transitions (business_rule).
--     (b) tg_order_status_event  AFTER INSERT OR UPDATE OF status — auto-inserts a shop_order_events
--         row for EVERY status (creation + each transition). This guarantees the invariant
--         "no status mutation without an event"; the note (when present) is carried via a txn-local
--         GUC the RPCs set, falling back to NULL.
--   shop_order_events / shop_order_items / invoices are append-only [B] (immutability triggers below).
-- =============================================================================

-- (a) legal-transition guard. The full legal graph (others → business_rule 422):
--     pending   → confirmed | cancelled
--     confirmed → packed
--     packed    → shipped
--     shipped   → delivered | refunded
--     delivered → refunded
CREATE OR REPLACE FUNCTION public.tg_order_status_guard()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;  -- no status change (some other column updated)
  END IF;

  IF NOT (
       (OLD.status = 'pending'   AND NEW.status IN ('confirmed', 'cancelled'))
    OR (OLD.status = 'confirmed' AND NEW.status =  'packed')
    OR (OLD.status = 'packed'    AND NEW.status =  'shipped')
    OR (OLD.status = 'shipped'   AND NEW.status IN ('delivered', 'refunded'))
    OR (OLD.status = 'delivered' AND NEW.status =  'refunded')
  ) THEN
    RAISE EXCEPTION 'illegal order transition % → % for order %', OLD.status, NEW.status, NEW.id;
    -- (no ERRCODE → default P0001 → mapped to business_rule / 422 with this message surfaced)
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shop_orders_status_guard ON public.shop_orders;
CREATE TRIGGER shop_orders_status_guard
  BEFORE UPDATE OF status ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_order_status_guard();

-- (b) auto-event logger.
CREATE OR REPLACE FUNCTION public.tg_order_status_event()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_note text := NULLIF(current_setting('vitale.order_note', true), '');
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NULL;  -- only log on actual status changes
  END IF;
  INSERT INTO public.shop_order_events (id, order_id, status, note, created_at)
  VALUES (uuidv7(), NEW.id, NEW.status::text, v_note, now());
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS shop_orders_status_event_ins ON public.shop_orders;
CREATE TRIGGER shop_orders_status_event_ins
  AFTER INSERT ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_order_status_event();

DROP TRIGGER IF EXISTS shop_orders_status_event_upd ON public.shop_orders;
CREATE TRIGGER shop_orders_status_event_upd
  AFTER UPDATE OF status ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_order_status_event();

-- Append-only [B] immutability (reuse the shared block helper from 0004_fn_library).
DROP TRIGGER IF EXISTS shop_order_items_immutable ON public.shop_order_items;
CREATE TRIGGER shop_order_items_immutable
  BEFORE UPDATE OR DELETE ON public.shop_order_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_update_delete();

DROP TRIGGER IF EXISTS shop_order_events_immutable ON public.shop_order_events;
CREATE TRIGGER shop_order_events_immutable
  BEFORE UPDATE OR DELETE ON public.shop_order_events
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_update_delete();

DROP TRIGGER IF EXISTS invoices_immutable ON public.invoices;
CREATE TRIGGER invoices_immutable
  BEFORE UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_update_delete();

-- =============================================================================
-- SECTION 6 — invoice issuance (immutable seller/buyer snapshot) on pending → confirmed.
--   Numbering is a per-org financial-year series: INV/<org8>/<FY>/<seq>. Per-org sequencing is
--   serialized with a txn advisory lock so concurrent confirmations cannot collide; the global
--   unique index (invoices_number_key) is the hard backstop.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.issue_order_invoice(p_order_id uuid)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_org    uuid;
  v_total  bigint;
  v_seller jsonb;
  v_buyer  jsonb;
  v_fy     text;
  v_seq    integer;
  v_num    text;
BEGIN
  -- Already issued? (idempotent — never a second invoice for an order.)
  IF EXISTS (SELECT 1 FROM public.invoices WHERE order_id = p_order_id) THEN
    RETURN;
  END IF;

  SELECT o.organization_id, o.total_paise INTO v_org, v_total
    FROM public.shop_orders o WHERE o.id = p_order_id;
  IF v_org IS NULL THEN
    RETURN;  -- order vanished; nothing to invoice
  END IF;

  -- Seller identity snapshot (immutable historical accuracy).
  SELECT jsonb_strip_nulls(jsonb_build_object(
           'organization_id', co.id,
           'business_name',   co.business_name,
           'legal_name',      op.legal_name,
           'gstin',           op.gstin,
           'business_address',op.business_address))
    INTO v_seller
    FROM public.coach_organizations co
    LEFT JOIN public.organization_profiles op ON op.organization_id = co.id
   WHERE co.id = v_org;

  -- Buyer snapshot from the order's delivery address (+ user id).
  SELECT jsonb_strip_nulls(jsonb_build_object(
           'user_id', o.user_id,
           'name',    a.name,
           'phone',   a.phone,
           'address', CASE WHEN a.id IS NULL THEN NULL ELSE jsonb_build_object(
                        'line1', a.line1, 'line2', a.line2, 'city', a.city,
                        'state', a.state, 'pincode', a.pincode) END))
    INTO v_buyer
    FROM public.shop_orders o
    LEFT JOIN public.addresses a ON a.id = o.address_id
   WHERE o.id = p_order_id;

  -- Indian financial year (Apr–Mar) in IST.
  v_fy := CASE WHEN EXTRACT(MONTH FROM (now() AT TIME ZONE 'Asia/Kolkata')) >= 4
               THEN to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYYY') || '-' ||
                    to_char((now() AT TIME ZONE 'Asia/Kolkata') + interval '1 year', 'YY')
               ELSE to_char((now() AT TIME ZONE 'Asia/Kolkata') - interval '1 year', 'YYYY') || '-' ||
                    to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YY')
          END;

  -- Per-org numbering serialized by advisory lock (released at txn end).
  PERFORM pg_advisory_xact_lock(hashtext('invoice_seq:' || v_org::text));
  SELECT count(*) + 1 INTO v_seq
    FROM public.invoices WHERE organization_id = v_org;
  v_num := 'INV/' || left(replace(v_org::text, '-', ''), 8) || '/' || v_fy || '/' || lpad(v_seq::text, 5, '0');

  INSERT INTO public.invoices
    (id, order_id, organization_id, invoice_number, seller_snapshot, buyer_snapshot,
     total_paise, issued_at, created_at)
  VALUES
    (uuidv7(), p_order_id, v_org, v_num, v_seller, v_buyer, v_total, now(), now());
END;
$$;

-- =============================================================================
-- SECTION 7 — rpc_checkout: server-authoritative, multi-merchant, atomic.
--   Signature carries NO price/total/discount inputs → client pricing is structurally ignored.
--   For each (organization) group it creates one shop_order, locks each variant FOR UPDATE, rejects
--   oversell (hard), computes line price + GST server-side, decrements stock (CHECK >= 0 backstop),
--   and clears the cart. All-or-nothing in the single calling transaction.
--   Returns: jsonb array of { order_id, organization_id, item_count, subtotal_paise, gst_paise,
--                             total_paise, status }.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.rpc_checkout(p_address_id uuid)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_caller   uuid := auth.uid();
  v_cart     uuid;
  v_grp      record;
  v_it       record;
  v_order    uuid;
  v_sub      bigint;
  v_gst      bigint;
  v_line     bigint;
  v_results  jsonb := '[]'::jsonb;
  v_count    integer;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'rpc_checkout: no caller identity' USING ERRCODE = '42501';
  END IF;

  -- Address must belong to the caller (when provided).
  IF p_address_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.addresses WHERE id = p_address_id AND user_id = v_caller) THEN
    RAISE EXCEPTION 'address % does not belong to caller', p_address_id USING ERRCODE = 'P0002';
  END IF;

  SELECT id INTO v_cart FROM public.carts WHERE user_id = v_caller FOR UPDATE;
  IF v_cart IS NULL OR NOT EXISTS (SELECT 1 FROM public.cart_items WHERE cart_id = v_cart) THEN
    RAISE EXCEPTION 'cart is empty';  -- business_rule / 422
  END IF;

  -- One order per merchant organization present in the cart.
  FOR v_grp IN
    SELECT p.organization_id AS org_id
      FROM public.cart_items ci
      JOIN public.products p ON p.id = ci.product_id
     WHERE ci.cart_id = v_cart
     GROUP BY p.organization_id
     ORDER BY p.organization_id
  LOOP
    v_order := uuidv7();
    v_sub := 0; v_gst := 0; v_count := 0;

    INSERT INTO public.shop_orders
      (id, user_id, organization_id, address_id, status,
       subtotal_paise, discount_paise, shipping_paise, gst_paise, total_paise)
    VALUES
      (v_order, v_caller, v_grp.org_id, p_address_id, 'pending', 0, 0, 0, 0, 0);

    -- Lock variants and build line items for THIS org's products.
    FOR v_it IN
      SELECT ci.qty,
             pv.id   AS variant_id, pv.name AS variant_name, pv.price_paise, pv.stock_qty, pv.is_active AS v_active,
             p.id    AS product_id, p.name AS product_name, p.gst_rate, p.is_active AS p_active
        FROM public.cart_items ci
        JOIN public.products p          ON p.id  = ci.product_id
        JOIN public.product_variants pv ON pv.id = ci.variant_id
       WHERE ci.cart_id = v_cart AND p.organization_id = v_grp.org_id
       ORDER BY pv.id          -- deterministic lock acquisition order (LockRows sits above Sort):
                               -- every concurrent checkout locks shared variant rows in ascending
                               -- pv.id order, so two buyers with overlapping carts can never form a
                               -- lock cycle. Eliminates the deadlock window (Finding #6). Variants
                               -- are org-partitioned and orgs are already iterated in id order, so
                               -- the global lock order is fully stable.
       FOR UPDATE OF pv
    LOOP
      IF NOT v_it.p_active OR NOT v_it.v_active THEN
        RAISE EXCEPTION 'product % / variant % is not purchasable', v_it.product_id, v_it.variant_id;
      END IF;
      IF v_it.qty <= 0 THEN
        RAISE EXCEPTION 'invalid quantity % for variant %', v_it.qty, v_it.variant_id USING ERRCODE = '23514';
      END IF;
      IF v_it.stock_qty < v_it.qty THEN
        RAISE EXCEPTION 'insufficient stock for variant % (have %, need %)',
          v_it.variant_id, v_it.stock_qty, v_it.qty;  -- hard oversell rejection / business_rule
      END IF;

      v_line := v_it.price_paise * v_it.qty;
      v_sub  := v_sub + v_line;
      v_gst  := v_gst + round(v_line * v_it.gst_rate / 100.0)::bigint;
      v_count := v_count + 1;

      INSERT INTO public.shop_order_items
        (id, order_id, product_id, variant_id, name, variant_name, qty, price_paise, gst_rate)
      VALUES
        (uuidv7(), v_order, v_it.product_id, v_it.variant_id, v_it.product_name,
         v_it.variant_name, v_it.qty, v_it.price_paise, v_it.gst_rate);

      UPDATE public.product_variants
         SET stock_qty = stock_qty - v_it.qty
       WHERE id = v_it.variant_id;  -- CHECK (stock_qty >= 0) is the DB backstop
    END LOOP;

    UPDATE public.shop_orders
       SET subtotal_paise = v_sub,
           gst_paise      = v_gst,
           total_paise    = v_sub + v_gst   -- discount 0 (no coupon engine), shipping 0
     WHERE id = v_order;

    v_results := v_results || jsonb_build_object(
      'order_id', v_order, 'organization_id', v_grp.org_id, 'item_count', v_count,
      'subtotal_paise', v_sub, 'gst_paise', v_gst, 'total_paise', v_sub + v_gst, 'status', 'pending');
  END LOOP;

  -- Empty the cart (all items consumed into orders).
  DELETE FROM public.cart_items WHERE cart_id = v_cart;

  RETURN v_results;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_checkout(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rpc_checkout(uuid) TO authenticated;

-- =============================================================================
-- SECTION 8 — rpc_confirm_order_payment: gateway-neutral, webhook-replay idempotent.
--   Drives pending → confirmed, stamps the gateway-neutral payment seam, and issues the invoice.
--   Idempotent: a replay (order already past pending) is a no-op that returns current state with
--   replayed=true — so a duplicate gateway webhook never double-confirms or double-invoices.
--   Gate: a member of the order's merchant org with manage_products (stands in for the gateway
--   webhook until D8 wires a real provider callback).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.rpc_confirm_order_payment(
    p_order_id         uuid,
    p_gateway_provider text,
    p_gateway_order_id text,
    p_gateway_payment_id text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_org    uuid;
  v_status public.order_status;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'rpc_confirm_order_payment: no caller identity' USING ERRCODE = '42501';
  END IF;

  SELECT organization_id, status INTO v_org, v_status
    FROM public.shop_orders WHERE id = p_order_id FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'order % not found', p_order_id USING ERRCODE = 'P0002';
  END IF;
  IF NOT is_org_member(v_org, 'manage_products') THEN
    RAISE EXCEPTION 'caller is not a merchant of org %', v_org USING ERRCODE = '42501';
  END IF;

  -- Replay / idempotency: only the pending → confirmed edge does real work.
  IF v_status <> 'pending' THEN
    RETURN (SELECT to_jsonb(o) || jsonb_build_object('replayed', true)
              FROM public.shop_orders o WHERE o.id = p_order_id);
  END IF;

  UPDATE public.shop_orders
     SET status            = 'confirmed',
         gateway_provider  = p_gateway_provider,
         gateway_order_id  = p_gateway_order_id,
         gateway_payment_id= p_gateway_payment_id
   WHERE id = p_order_id;   -- fires guard + auto-event

  PERFORM public.issue_order_invoice(p_order_id);

  RETURN (SELECT to_jsonb(o) || jsonb_build_object('replayed', false)
            FROM public.shop_orders o WHERE o.id = p_order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_confirm_order_payment(uuid, text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rpc_confirm_order_payment(uuid, text, text, text) TO authenticated;

-- =============================================================================
-- SECTION 9 — order state-machine RPCs (who may drive which edge).
--   rpc_cancel_order        — CUSTOMER cancels OWN pending order (pending → cancelled) + restock.
--   rpc_advance_order_status— MERCHANT (manage_products) drives fulfilment / refund edges.
--   The DB guard (Section 5) enforces the transition GRAPH for both; these enforce the ACTOR.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_cancel_order(p_order_id uuid, p_note text DEFAULT NULL)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_status public.order_status;
  v_owner  uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'rpc_cancel_order: no caller identity' USING ERRCODE = '42501';
  END IF;

  SELECT status, user_id INTO v_status, v_owner
    FROM public.shop_orders WHERE id = p_order_id FOR UPDATE;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'order % not found', p_order_id USING ERRCODE = 'P0002';
  END IF;
  IF v_owner <> v_caller THEN
    RAISE EXCEPTION 'order % does not belong to caller', p_order_id USING ERRCODE = '42501';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'order % can only be cancelled while pending (is %)', p_order_id, v_status;
  END IF;

  -- Restore stock for every line (the order never shipped).
  UPDATE public.product_variants pv
     SET stock_qty = pv.stock_qty + oi.qty
    FROM public.shop_order_items oi
   WHERE oi.order_id = p_order_id AND oi.variant_id = pv.id;

  PERFORM set_config('vitale.order_note', COALESCE(p_note, 'cancelled by customer'), true);
  UPDATE public.shop_orders SET status = 'cancelled' WHERE id = p_order_id;

  RETURN (SELECT to_jsonb(o) FROM public.shop_orders o WHERE o.id = p_order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_cancel_order(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rpc_cancel_order(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_advance_order_status(
    p_order_id uuid, p_new_status public.order_status, p_note text DEFAULT NULL)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_org    uuid;
  v_status public.order_status;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'rpc_advance_order_status: no caller identity' USING ERRCODE = '42501';
  END IF;

  SELECT organization_id, status INTO v_org, v_status
    FROM public.shop_orders WHERE id = p_order_id FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'order % not found', p_order_id USING ERRCODE = 'P0002';
  END IF;
  IF NOT is_org_member(v_org, 'manage_products') THEN
    RAISE EXCEPTION 'caller is not a merchant of org %', v_org USING ERRCODE = '42501';
  END IF;

  -- Customer-only edges are not reachable here (guard also rejects illegal graph moves).
  IF p_new_status = 'cancelled' THEN
    RAISE EXCEPTION 'merchants cannot cancel orders via this path';  -- business_rule
  END IF;

  PERFORM set_config('vitale.order_note', COALESCE(p_note, ''), true);
  UPDATE public.shop_orders SET status = p_new_status WHERE id = p_order_id;  -- guard validates edge

  RETURN (SELECT to_jsonb(o) FROM public.shop_orders o WHERE o.id = p_order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_advance_order_status(uuid, public.order_status, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rpc_advance_order_status(uuid, public.order_status, text) TO authenticated;

-- =============================================================================
-- SECTION 10 — cart upsert helper (one active cart per user; merge same variant).
--   Convenience SECURITY INVOKER path is unnecessary — the cart_items policies already gate the
--   customer. We expose a small DEFINER helper only to guarantee the singleton cart row exists.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.rpc_get_or_create_cart()
  RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_cart   uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'rpc_get_or_create_cart: no caller identity' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_cart FROM public.carts WHERE user_id = v_caller;
  IF v_cart IS NULL THEN
    INSERT INTO public.carts (id, user_id) VALUES (uuidv7(), v_caller)
      ON CONFLICT (user_id) DO NOTHING
      RETURNING id INTO v_cart;
    IF v_cart IS NULL THEN
      SELECT id INTO v_cart FROM public.carts WHERE user_id = v_caller;
    END IF;
  END IF;
  RETURN v_cart;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_or_create_cart() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rpc_get_or_create_cart() TO authenticated;

DO $$ BEGIN
  RAISE NOTICE '0139 commerce lifecycle applied — RLS forced, org-scoped policies, checkout/confirm/advance/cancel RPCs, state-machine guard + auto-events, GST invoice issuance with immutable seller snapshot.';
END $$;
