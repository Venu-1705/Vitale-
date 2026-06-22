-- =============================================================================
-- Vitalé — Post-companion 0123: NEUTRALIZED (no-op stub)
-- -----------------------------------------------------------------------------
-- This file ORIGINALLY held the D12 shop/commerce RLS for the OLD single-merchant
-- "Vitalé store" shape (no organization_id on products/orders, free-text order status,
-- owner-reads-only orders, service-role writes). It was NEVER applied to the live
-- cluster (0 D12 policies live, RLS disabled at the time) and was never accepted.
--
-- The frozen architecture (VITALE_DB_ARCHITECTURE §D12) is an ORG-OWNED MARKETPLACE:
-- commerce assets belong to an organization, orders are per-merchant, fulfilment is an
-- enum state-machine, money is bigint paise, and merchant operations are org-scoped
-- through existing capabilities (manage_products / view_revenue). That shape was
-- delivered in two accepted companions:
--   • 0138_commerce_schema_alignment.sql — schema alignment (org_id, bigint, enum, gateway seam).
--   • 0139_commerce_lifecycle.sql        — CANONICAL D12 lifecycle (RLS enable+FORCE, customer +
--                                          merchant policies, rpc_checkout, state-machine guard +
--                                          auto audit events, gateway-neutral payment confirmation,
--                                          GST invoice issuance with immutable seller snapshot).
--
-- 0123 is deliberately neutralized to a no-op so a full `db:raw:post` re-run does NOT
-- re-apply the superseded single-merchant policies over the canonical 0139 layer.
-- Kept as a numbered placeholder to preserve the migration sequence and document the
-- supersession.
-- =============================================================================

DO $$ BEGIN
  RAISE NOTICE '0123 neutralized — D12 RLS/lifecycle now owned by 0138_commerce_schema_alignment.sql + 0139_commerce_lifecycle.sql.';
END $$;
