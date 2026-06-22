-- =============================================================================
-- Vitalé — Post-companion 0128: rls_owner runtime grants + permissive policies
-- Ground truth: VITALE_IMPLEMENTATION_SPEC Part 3 §RLS helpers (lines 605-608) +
-- Phase 10 SECURITY DEFINER audit. Completes the defense-in-depth model 0119
-- *declared* but left non-functional.
--
-- WHY THIS EXISTS (architecture-hardening correction, not a model change):
-- 0119 transferred ownership of the SECURITY DEFINER RLS-helper layer and two
-- read-only trigger functions to the low-privilege `rls_owner` role. That is the
-- correct defense-in-depth posture — but the matching runtime grants were never
-- issued, so every transferred function FAILED at runtime:
--
--   • auth side  — rls_owner has neither USAGE on schema auth nor EXECUTE on
--                  auth.uid(); 0000 granted those only to anon/authenticated/
--                  service_role. Any helper that calls auth.uid() (is_admin,
--                  is_org_member, admin_has_support_access, can_read_health,
--                  on_care_team, is_community_member, member_is_self_in_org)
--                  raised "permission denied for schema auth".  [Finding A]
--   • table side — rls_owner is not the owner of the tables these functions read
--                  and holds no BYPASSRLS, so RLS applies to it; with no base
--                  SELECT grant and no policy admitting it, reads raised
--                  "permission denied for table ..." or (worse) silently returned
--                  zero rows, collapsing the helper to a false negative.
--   • tg_sync_owner_member reads public.coach_organizations under the same
--                  regime → the owner-member sync validation mis-fired.  [Finding B]
--   (Historical: tg_provision_user once INSERTed into public.users here. It has been
--    removed — provisioning is now JIT via rpc_provision_user, run as service_role.)
--
-- REMEDIATION CHOSEN BY THE OWNER: "Grants + policies (keep model)" — preserve
-- the 0119 rls_owner ownership (no function reverts to a BYPASSRLS owner, no role
-- gains BYPASSRLS) and instead give rls_owner exactly the minimum it needs:
--   1. USAGE on schema auth + EXECUTE on auth.uid().
--   2. Base SELECT on the specific tables the transferred functions touch —
--      nothing wider. (No INSERT: provisioning moved to service_role JIT.)
--   3. A permissive, rls_owner-scoped RLS policy per table so the FORCE/ENABLE
--      RLS regime admits rls_owner's own reads/writes. These policies are
--      `TO rls_owner` only, so they are inert for every other role (anon /
--      authenticated sessions never match them) and do not widen tenant access.
--
-- This mirrors the precedent already in 0122 (lab_reports_rpc_owner /
-- lab_reports_insert: FOR SELECT/INSERT TO rls_owner USING/ WITH CHECK (true)).
--
-- SAFETY: none of these tables carry a RESTRICTIVE policy, so the added
-- permissive policies are not ANDed against a deny — they grant exactly the
-- visibility intended. The actual access logic still lives inside each SECURITY
-- DEFINER function body (it filters by auth.uid(), status='active', grants, etc.);
-- rls_owner's blanket row visibility is only the substrate those functions run on,
-- exactly as a BYPASSRLS definer would have had — but scoped to ten named tables
-- instead of the whole cluster.
--
-- Apply order: after 0127 (last in series); after 0119 (ownership transfer) and
-- after every table + its RLS are created (0101-0114). Idempotent: GRANTs are
-- repeatable; policies use DROP POLICY IF EXISTS before CREATE.
-- =============================================================================

-- ============================================================================
-- SECTION 1 — auth schema access for rls_owner
-- The helpers resolve the current actor via auth.uid() (itself SECURITY INVOKER,
-- so it executes in the rls_owner definer context). rls_owner therefore needs
-- USAGE on schema auth and EXECUTE on auth.uid(). auth.uid() only reads GUCs
-- (current_setting) — no table access — so no further auth grants are required.
-- (current_user_id() is NOT transferred to rls_owner by 0119, so it is unaffected.)
-- ============================================================================
GRANT USAGE ON SCHEMA auth TO rls_owner;
GRANT EXECUTE ON FUNCTION auth.uid() TO rls_owner;

-- Schema public USAGE is normally inherited from the PUBLIC pseudo-role default,
-- but make it explicit so the model does not depend on that default surviving a
-- future REVOKE ... FROM PUBLIC. (No CREATE — rls_owner never builds objects.)
GRANT USAGE ON SCHEMA public TO rls_owner;

-- ============================================================================
-- SECTION 2 — base table privileges for rls_owner (minimum surface)
-- One row per table actually read by a transferred SECURITY DEFINER function:
--   is_admin                                → users        (SELECT)
--   is_org_member / member_is_self_in_org /
--     can_read_health / tg_sync_owner_member→ organization_members,
--                                              organization_member_permissions,
--                                              coach_organizations
--   org_has_active_grant / can_read_health  → access_grants
--   admin_has_support_access                → admin_support_access
--   on_care_team / can_read_health          → care_plans, care_team_members
--   shares_active_context / is_community_member → community_memberships,
--                                              program_enrollments
-- ============================================================================
GRANT SELECT         ON public.users                          TO rls_owner;  -- is_admin reads; INSERT for JIT provisioning is granted in 0140 (rpc_provision_user)
GRANT SELECT         ON public.organization_members           TO rls_owner;
GRANT SELECT         ON public.organization_member_permissions TO rls_owner;
GRANT SELECT         ON public.coach_organizations            TO rls_owner;
GRANT SELECT         ON public.access_grants                  TO rls_owner;
GRANT SELECT         ON public.admin_support_access           TO rls_owner;
GRANT SELECT         ON public.care_plans                     TO rls_owner;
GRANT SELECT         ON public.care_team_members              TO rls_owner;
GRANT SELECT         ON public.community_memberships          TO rls_owner;
GRANT SELECT         ON public.program_enrollments            TO rls_owner;

-- ============================================================================
-- SECTION 3 — permissive, rls_owner-scoped RLS policies
-- Each is FOR SELECT TO rls_owner USING (true): it admits rls_owner's own reads
-- under ENABLE/FORCE RLS and is invisible to every other role.
-- ============================================================================

-- users — read (is_admin). The INSERT path for JIT provisioning (rpc_provision_user,
-- a SECURITY DEFINER owned by rls_owner) gets its INSERT grant + permissive INSERT
-- policy in 0140, co-located with the function.
DROP POLICY IF EXISTS users_rls_owner_select ON public.users;
CREATE POLICY users_rls_owner_select ON public.users
  FOR SELECT TO rls_owner USING (true);

-- organization_members — is_org_member, member_is_self_in_org, can_read_health
DROP POLICY IF EXISTS organization_members_rls_owner_select ON public.organization_members;
CREATE POLICY organization_members_rls_owner_select ON public.organization_members
  FOR SELECT TO rls_owner USING (true);

-- organization_member_permissions — is_org_member, can_read_health (capability check)
DROP POLICY IF EXISTS omp_rls_owner_select ON public.organization_member_permissions;
CREATE POLICY omp_rls_owner_select ON public.organization_member_permissions
  FOR SELECT TO rls_owner USING (true);

-- coach_organizations — tg_sync_owner_member (owner_coach_id liveness validation)
DROP POLICY IF EXISTS coach_organizations_rls_owner_select ON public.coach_organizations;
CREATE POLICY coach_organizations_rls_owner_select ON public.coach_organizations
  FOR SELECT TO rls_owner USING (true);

-- access_grants — org_has_active_grant, can_read_health
DROP POLICY IF EXISTS access_grants_rls_owner_select ON public.access_grants;
CREATE POLICY access_grants_rls_owner_select ON public.access_grants
  FOR SELECT TO rls_owner USING (true);

-- admin_support_access — admin_has_support_access (break-glass liveness)
DROP POLICY IF EXISTS admin_support_access_rls_owner_select ON public.admin_support_access;
CREATE POLICY admin_support_access_rls_owner_select ON public.admin_support_access
  FOR SELECT TO rls_owner USING (true);

-- care_plans — on_care_team, can_read_health (care-plan-exists gate)
DROP POLICY IF EXISTS care_plans_rls_owner_select ON public.care_plans;
CREATE POLICY care_plans_rls_owner_select ON public.care_plans
  FOR SELECT TO rls_owner USING (true);

-- care_team_members — on_care_team
DROP POLICY IF EXISTS care_team_members_rls_owner_select ON public.care_team_members;
CREATE POLICY care_team_members_rls_owner_select ON public.care_team_members
  FOR SELECT TO rls_owner USING (true);

-- community_memberships — shares_active_context, is_community_member
DROP POLICY IF EXISTS community_memberships_rls_owner_select ON public.community_memberships;
CREATE POLICY community_memberships_rls_owner_select ON public.community_memberships
  FOR SELECT TO rls_owner USING (true);

-- program_enrollments — shares_active_context
DROP POLICY IF EXISTS program_enrollments_rls_owner_select ON public.program_enrollments;
CREATE POLICY program_enrollments_rls_owner_select ON public.program_enrollments
  FOR SELECT TO rls_owner USING (true);

-- ============================================================================
-- NOTES
-- • "No role gains BYPASSRLS": rls_owner remains NOLOGIN, NO BYPASSRLS. Its reach
--   is bounded to the ten tables above via explicit GRANTs + role-scoped policies.
--   An attacker who pivots through a SECURITY DEFINER helper lands in rls_owner —
--   which can read those ten tables (read-only) and nothing else — not a
--   superuser/BYPASSRLS context.
-- • User provisioning is JIT (rpc_provision_user, post/0140): a SECURITY DEFINER
--   owned by rls_owner, following this same pattern. Its users INSERT grant +
--   permissive INSERT policy live in 0140, co-located with the function. The API
--   calls it as service_role (EXECUTE only); the body runs as rls_owner.
-- • tg_harden_new_partition (also "transferred" by 0119) is an EVENT trigger and is
--   NOT SECURITY DEFINER; event triggers run with the privileges of the role that
--   issued the DDL (the migration superuser / service_role), so its ALTER/REVOKE
--   statements are unaffected by rls_owner ownership. No grant is needed for it.
-- • tg_guard_razorpay_account is SECURITY INVOKER and touches no table (validates
--   NEW only); its 0119 ownership line is cosmetic. No grant needed.
-- • Verify with:
--     SET ROLE rls_owner;
--     SELECT public.is_admin();                 -- must not error
--     SELECT public.can_read_health(<subject>); -- must not error
--     RESET ROLE;
-- =============================================================================
