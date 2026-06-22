-- =============================================================================
-- Vitalé — Post-companion 0119: SECURITY DEFINER ownership transfer
-- Ground truth: VITALE_IMPLEMENTATION_SPEC Part 3 §RLS helpers (lines 605-608);
-- Phase 10 "SECURITY DEFINER audit" checklist item.
--
-- All SECURITY DEFINER functions (RLS helpers + RPCs) must be owned by the
-- dedicated low-privilege `rls_owner` role — not by a superuser or the
-- service_role. This is defense-in-depth: if an attacker escalates through a
-- SECURITY DEFINER function, they land in a role with only the SELECT grants
-- that function actually needs, not a superuser context.
--
-- rls_owner role is created in 0005_rls_helpers with only the minimum GRANTs
-- required by each helper. This companion transfers ownership.
--
-- Apply order: after 0118 (lexical). Idempotent: ALTER FUNCTION … OWNER TO is
-- safe to re-run.
-- =============================================================================

-- ============================================================================
-- SECTION 1 — RLS helper functions (0005_rls_helpers)
-- ============================================================================
ALTER FUNCTION public.is_admin()                                              OWNER TO rls_owner;
ALTER FUNCTION public.is_org_member(uuid, public.coach_capability)            OWNER TO rls_owner;
ALTER FUNCTION public.org_has_active_grant(uuid, uuid, public.grant_data_category) OWNER TO rls_owner;
ALTER FUNCTION public.admin_has_support_access(uuid)                          OWNER TO rls_owner;
ALTER FUNCTION public.can_read_health(uuid)                                   OWNER TO rls_owner;
ALTER FUNCTION public.on_care_team(uuid, public.coach_capability)                                OWNER TO rls_owner;
ALTER FUNCTION public.shares_active_context(uuid, uuid)                       OWNER TO rls_owner;
ALTER FUNCTION public.is_community_member(uuid)                               OWNER TO rls_owner;
ALTER FUNCTION public.member_is_self_in_org(uuid, uuid)                             OWNER TO rls_owner;

-- ============================================================================
-- SECTION 2 — trigger functions that are SECURITY DEFINER (from spec §triggers)
-- ============================================================================
ALTER FUNCTION public.tg_harden_new_partition()      OWNER TO rls_owner;
-- tg_provision_user removed (provisioning is JIT via rpc_provision_user, post/0140).
ALTER FUNCTION public.tg_sync_owner_member()         OWNER TO rls_owner;
ALTER FUNCTION public.tg_guard_razorpay_account()    OWNER TO rls_owner;
-- NOTE: tg_audit_permission_change is implemented later, in post/0127, and is
-- intentionally NOT transferred to rls_owner: it INSERTs into coach_data_access_audit
-- (REVOKE-API, FORCE RLS, no INSERT policy), which the low-privilege rls_owner can
-- neither bypass nor be granted without weakening the model, so it stays owned by the
-- BYPASSRLS migration role (same audit-write pattern as 0120's RPCs and 0126's
-- tg_audit_grant_change). It is also not yet defined at this point in the series, so
-- referencing it here would fail ("function does not exist"). No action in this file.

-- ============================================================================
-- SECTION 3 — ensure EXECUTE is granted to authenticated on all helpers
-- (defense-in-depth: REVOKE from PUBLIC first, then grant only authenticated)
-- ============================================================================
REVOKE ALL ON FUNCTION public.is_admin()                                              FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_org_member(uuid, public.coach_capability)            FROM PUBLIC;
REVOKE ALL ON FUNCTION public.org_has_active_grant(uuid, uuid, public.grant_data_category) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_has_support_access(uuid)                          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_health(uuid)                                   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.on_care_team(uuid, public.coach_capability)                                FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shares_active_context(uuid, uuid)                       FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_community_member(uuid)                               FROM PUBLIC;
REVOKE ALL ON FUNCTION public.member_is_self_in_org(uuid, uuid)                             FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_admin()                                              TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, public.coach_capability)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_has_active_grant(uuid, uuid, public.grant_data_category) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_has_support_access(uuid)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_health(uuid)                                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.on_care_team(uuid, public.coach_capability)                                TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_active_context(uuid, uuid)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_community_member(uuid)                               TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_is_self_in_org(uuid, uuid)                             TO authenticated;

-- ============================================================================
-- SECTION 4 — pg_stat_statements (enable for performance monitoring)
-- Must be enabled at the cluster level (postgresql.conf shared_preload_libraries).
-- The SQL below is a no-op if already loaded; safe to apply.
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ============================================================================
-- NOTES
-- • rls_owner must exist before this migration runs (created in 0005_rls_helpers).
-- • service_role is used only by the Express API server for direct Postgres
--   connection (bypasses RLS). It must NEVER appear in client-side JWT claims
--   or be returned in any API response.
-- • Trigger functions that are NOT SECURITY DEFINER (tg_touch_updated_at,
--   tg_block_update_delete, etc.) are not listed here — they run as the
--   invoking session's role and need no special ownership.
-- • After running this migration, verify with:
--     SELECT proname, prosecdef, proowner::regrole
--     FROM pg_proc
--     WHERE pronamespace = 'public'::regnamespace
--       AND prosecdef = true;
--   All SECURITY DEFINER functions should show proowner = rls_owner.
-- =============================================================================
