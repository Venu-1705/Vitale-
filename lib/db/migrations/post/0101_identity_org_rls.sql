-- =============================================================================
-- Vitalé — Post-table migration 0101: D0/D1 RLS, grants & domain triggers (Phase 2)
-- Implements VITALE_IMPLEMENTATION_SPEC Part 2 (D0 Organizations & Membership, D1 Identity)
-- RLS/trigger clauses + VITALE_DB_ARCHITECTURE §7.
--
-- ORDERING: this is a POST-TABLE companion. Apply order is:
--   1. `pnpm db:raw`        → foundation 0001–0006 (extensions, enums, fn library, helpers)
--   2. `pnpm generate && pnpm migrate` → Drizzle creates the D0/D1 tables (identity.ts,
--      organizations.ts) — columns/FKs/indexes
--   3. `pnpm db:raw:post`   → THIS file: RLS enable/force, grants, policies, domain triggers
-- It references helper functions from 0005 (is_admin, is_org_member, has_capability) and the
-- trigger library from 0004 (tg_touch_updated_at), plus the D0/D1 tables created in step 2.
--
-- DEFERRED to Phase 8 (with the labs.ts refactor + new-shape access_grants): the
-- "grant-bearing org member can read a shared customer's users/user_profiles" SELECT clauses,
-- and tg_audit_permission_change / tg_member_removal_cascade (they touch access_grants +
-- care_team_members, which don't exist until Phases 8 / care-domain). Marked TODO below.
--
-- Idempotent: CREATE OR REPLACE; DROP ... IF EXISTS before CREATE TRIGGER/POLICY.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Plain active-membership predicate (any capability). The §3.2 helpers gate by capability;
-- "SELECT = org members + admins" needs a capability-agnostic membership test. SECURITY
-- DEFINER (owned by the migration role, which has BYPASSRLS) so the read isn't itself
-- filtered by organization_members' RLS, and to avoid policy self-reference ambiguity.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_org_member(p_org uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = p_org AND m.user_id = auth.uid() AND m.status = 'active');
$$;
GRANT EXECUTE ON FUNCTION public.is_active_org_member(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- Phase-2 D0/D1 domain triggers (defined here; attached below).
-- ----------------------------------------------------------------------------

-- NOTE: user provisioning is NO LONGER trigger-based. Supabase is the auth provider
-- only (it issues JWTs incl. Google) and does not host this database, so there is no
-- `auth.users` table to fire an INSERT trigger on. Users are created Just-In-Time in
-- public.users on their first authenticated request via public.rpc_provision_user
-- (migration post/0140), called by the API before withUserContext. The former
-- public.tg_provision_user() function + `vitale_provision_user` trigger were removed.

-- tg_sync_owner_member: the owner_coach membership row's user_id must equal the org's
-- owner_coach_id (keeps coach_organizations.owner_coach_id and the owner member row in sync).
CREATE OR REPLACE FUNCTION public.tg_sync_owner_member() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_owner uuid;
BEGIN
  IF NEW.member_role = 'owner_coach' THEN
    SELECT owner_coach_id INTO v_owner FROM public.coach_organizations WHERE id = NEW.organization_id;
    IF v_owner IS DISTINCT FROM NEW.user_id THEN
      RAISE EXCEPTION 'owner_coach member.user_id (%) must equal coach_organizations.owner_coach_id (%)',
        NEW.user_id, v_owner USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- tg_guard_razorpay_account: razorpay_linked_account_id may be set non-null ONLY when
-- kyc_status='verified' (financial-onboarding gate; never expose a linked account pre-KYC).
CREATE OR REPLACE FUNCTION public.tg_guard_razorpay_account() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.razorpay_linked_account_id IS NOT NULL AND NEW.kyc_status <> 'verified' THEN
    RAISE EXCEPTION 'razorpay_linked_account_id may be set only when kyc_status=verified'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

-- ----------------------------------------------------------------------------
-- Trigger attachments. (No auth.users trigger — provisioning is JIT; see 0140.)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS organization_members_sync_owner ON public.organization_members;
CREATE TRIGGER organization_members_sync_owner BEFORE INSERT OR UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_owner_member();

DROP TRIGGER IF EXISTS organization_profiles_guard_razorpay ON public.organization_profiles;
CREATE TRIGGER organization_profiles_guard_razorpay BEFORE INSERT OR UPDATE ON public.organization_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_guard_razorpay_account();

-- touch updated_at (tg_touch_updated_at from 0004) on every D0/D1 table that has updated_at.
DROP TRIGGER IF EXISTS users_touch ON public.users;
CREATE TRIGGER users_touch BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS user_profiles_touch ON public.user_profiles;
CREATE TRIGGER user_profiles_touch BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS professional_profiles_touch ON public.professional_profiles;
CREATE TRIGGER professional_profiles_touch BEFORE UPDATE ON public.professional_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS coach_organizations_touch ON public.coach_organizations;
CREATE TRIGGER coach_organizations_touch BEFORE UPDATE ON public.coach_organizations
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS organization_members_touch ON public.organization_members;
CREATE TRIGGER organization_members_touch BEFORE UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS organization_profiles_touch ON public.organization_profiles;
CREATE TRIGGER organization_profiles_touch BEFORE UPDATE ON public.organization_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS invitations_touch ON public.invitations;
CREATE TRIGGER invitations_touch BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- RESOLVED: tg_audit_permission_change on organization_member_permissions is now
-- implemented in post/0127_member_permission_audit.sql (writes a coach_data_access_audit
-- row on INSERT='grant'/DELETE='revoke', using the hardening-added enum values from 0100).
-- It is intentionally owned by the BYPASSRLS migration role, not rls_owner (it INSERTs
-- into the REVOKE-API audit table). It is wired here-last in the post series because both
-- the new-shape audit table (0113) and the enum values (0100) must exist first.
-- TODO(care/Phase 8): tg_member_removal_cascade on organization_members (revokes grants +
-- deactivates care-team rows — access_grants/care_team_members not yet created).

-- ----------------------------------------------------------------------------
-- RLS: enable (+ FORCE on PHI-adjacent / financial-identity tables) and grant DML so
-- PostgREST (authenticated) can reach the tables; policies below do the row filtering.
-- ----------------------------------------------------------------------------
ALTER TABLE public.users                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                          FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles                  FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.professional_profiles          ENABLE ROW LEVEL SECURITY;   -- public discovery: ON, not FORCE
ALTER TABLE public.coach_organizations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_member_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_member_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organization_profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_profiles          FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.invitations                    ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE                 ON public.users                           TO authenticated; -- no INSERT (provisioned by trigger), no DELETE (anonymize)
GRANT SELECT, INSERT, UPDATE         ON public.user_profiles                   TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.professional_profiles           TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.coach_organizations             TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.organization_members            TO authenticated;
GRANT SELECT, INSERT, DELETE         ON public.organization_member_permissions TO authenticated; -- insert/delete only (no UPDATE)
GRANT SELECT, INSERT, UPDATE         ON public.organization_profiles           TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.invitations                     TO authenticated;

-- ----------------------------------------------------------------------------
-- Policies (TO authenticated). DROP IF EXISTS first for idempotency.
-- ----------------------------------------------------------------------------

-- users: self + admins. (TODO Phase 8: + grant-bearing org members of a shared customer.)
DROP POLICY IF EXISTS users_select ON public.users;
CREATE POLICY users_select ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS users_update_self ON public.users;
CREATE POLICY users_update_self ON public.users FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- user_profiles: self + admins. (TODO Phase 8: + grant-bearing org members.)
DROP POLICY IF EXISTS user_profiles_select ON public.user_profiles;
CREATE POLICY user_profiles_select ON public.user_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS user_profiles_insert_self ON public.user_profiles;
CREATE POLICY user_profiles_insert_self ON public.user_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS user_profiles_update_self ON public.user_profiles;
CREATE POLICY user_profiles_update_self ON public.user_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- professional_profiles: public discovery read; self-write.
DROP POLICY IF EXISTS professional_profiles_select_public ON public.professional_profiles;
CREATE POLICY professional_profiles_select_public ON public.professional_profiles FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS professional_profiles_insert_self ON public.professional_profiles;
CREATE POLICY professional_profiles_insert_self ON public.professional_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS professional_profiles_update_self ON public.professional_profiles;
CREATE POLICY professional_profiles_update_self ON public.professional_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- coach_organizations: members + admins read; owner writes; a coach creates their own org.
DROP POLICY IF EXISTS coach_organizations_select ON public.coach_organizations;
CREATE POLICY coach_organizations_select ON public.coach_organizations FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_active_org_member(id));
DROP POLICY IF EXISTS coach_organizations_insert_owner ON public.coach_organizations;
CREATE POLICY coach_organizations_insert_owner ON public.coach_organizations FOR INSERT TO authenticated
  WITH CHECK (owner_coach_id = auth.uid());
DROP POLICY IF EXISTS coach_organizations_update_owner ON public.coach_organizations;
CREATE POLICY coach_organizations_update_owner ON public.coach_organizations FOR UPDATE TO authenticated
  USING (owner_coach_id = auth.uid()) WITH CHECK (owner_coach_id = auth.uid());

-- organization_members: same-org members + admins read; owner / manage_staff write.
-- (Self member_role escalation is additionally blocked by a guard trigger — TODO Phase 2.5.)
DROP POLICY IF EXISTS organization_members_select ON public.organization_members;
CREATE POLICY organization_members_select ON public.organization_members FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_active_org_member(organization_id));
DROP POLICY IF EXISTS organization_members_write ON public.organization_members;
CREATE POLICY organization_members_write ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, 'manage_staff'));
DROP POLICY IF EXISTS organization_members_update ON public.organization_members;
CREATE POLICY organization_members_update ON public.organization_members FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, 'manage_staff'))
  WITH CHECK (public.is_org_member(organization_id, 'manage_staff'));

-- organization_member_permissions: org members + admins read; owner/manage_staff insert/delete,
-- but NEVER on one's own membership rows (no self-escalation). No UPDATE path.
DROP POLICY IF EXISTS omp_select ON public.organization_member_permissions;
CREATE POLICY omp_select ON public.organization_member_permissions FOR SELECT TO authenticated
  USING (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.organization_members tgt
    WHERE tgt.id = organization_member_permissions.member_id
      AND public.is_active_org_member(tgt.organization_id)));
DROP POLICY IF EXISTS omp_insert ON public.organization_member_permissions;
CREATE POLICY omp_insert ON public.organization_member_permissions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members tgt
    WHERE tgt.id = organization_member_permissions.member_id
      AND public.is_org_member(tgt.organization_id, 'manage_staff')
      AND tgt.user_id <> auth.uid()));                       -- no self-grant
DROP POLICY IF EXISTS omp_delete ON public.organization_member_permissions;
CREATE POLICY omp_delete ON public.organization_member_permissions FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members tgt
    WHERE tgt.id = organization_member_permissions.member_id
      AND public.is_org_member(tgt.organization_id, 'manage_staff')
      AND tgt.user_id <> auth.uid()));                       -- no self-revoke

-- organization_profiles: org members + admins read; owner-only write (KYC/banking).
DROP POLICY IF EXISTS organization_profiles_select ON public.organization_profiles;
CREATE POLICY organization_profiles_select ON public.organization_profiles FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_active_org_member(organization_id));
DROP POLICY IF EXISTS organization_profiles_insert_owner ON public.organization_profiles;
CREATE POLICY organization_profiles_insert_owner ON public.organization_profiles FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.coach_organizations o
                      WHERE o.id = organization_profiles.organization_id AND o.owner_coach_id = auth.uid()));
DROP POLICY IF EXISTS organization_profiles_update_owner ON public.organization_profiles;
CREATE POLICY organization_profiles_update_owner ON public.organization_profiles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.coach_organizations o
                 WHERE o.id = organization_profiles.organization_id AND o.owner_coach_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.coach_organizations o
                      WHERE o.id = organization_profiles.organization_id AND o.owner_coach_id = auth.uid()));

-- invitations: owner / manage_staff manage (is_org_member treats owner as all-caps).
-- Acceptance (token lookup, pre-auth) happens via a service-role RPC, which bypasses RLS.
DROP POLICY IF EXISTS invitations_select ON public.invitations;
CREATE POLICY invitations_select ON public.invitations FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_org_member(organization_id, 'manage_staff'));
DROP POLICY IF EXISTS invitations_insert ON public.invitations;
CREATE POLICY invitations_insert ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, 'manage_staff'));
DROP POLICY IF EXISTS invitations_update ON public.invitations;
CREATE POLICY invitations_update ON public.invitations FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, 'manage_staff'))
  WITH CHECK (public.is_org_member(organization_id, 'manage_staff'));
