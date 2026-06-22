-- =============================================================================
-- Vitalé — Post-companion 0110: D9 Collaboration & Care (RLS, grants, triggers)
-- Ground truth: VITALE_DB_ARCHITECTURE §4 D9 (lines 463-491) + VITALE_IMPLEMENTATION_SPEC
-- Part 2 D9 (lines 446-464) and Part 4 §4.5 (tg_validate_care_team_capabilities, lines 945-998).
--
-- Tables (Drizzle-owned DDL in lib/db/src/schema/care.ts):
--   collaboration_requests / collaboration_meetings / collaboration_agreements  → RLS-ON (org-scoped)
--   care_plans / care_team_members / care_plan_versions                         → RLS-FORCE (clinical boundary)
--
-- This companion adds only what Drizzle cannot express: the RLS helpers, the four D9 trigger
-- functions, RLS enable/force, REVOKE/GRANT, and the policies. Apply order: after the Drizzle
-- migrate step (all pgTables exist) and after 0101 (is_active_org_member) / 0005 (capability,
-- grant, care-team, admin-support helpers); lexical order places it after 0109.
--
-- FORWARD REFERENCE: tg_agreement_end_cascade revokes the collaborating org's grant in the
-- NEW-shape access_grants (organization_id/status/end_date) introduced in Phase 8 — the same
-- shape foundation org_has_active_grant() (0005) already assumes. We therefore author it under
-- check_function_bodies=off (identical to 0005); the body is only reached at runtime when an
-- agreement is ended, by which point Phase 8 has built the table.
--
-- Idempotent: CREATE OR REPLACE functions; DROP ... IF EXISTS before every trigger/policy.
-- =============================================================================

SET check_function_bodies = off;   -- tg_agreement_end_cascade forward-refs Phase-8 access_grants

-- ============================================================================
-- SECTION 1 — D9 RLS helper functions (SECURITY DEFINER → bypass the FORCE'd care_* tables and
-- avoid policy self-reference / cross-table RLS recursion; cf. 0101/0109 helpers).
-- ============================================================================

-- caller is an active member of EITHER org party to a collaboration request (NULL → false)
CREATE OR REPLACE FUNCTION public.can_access_collab_request(p_request uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.collaboration_requests r
    WHERE r.id = p_request
      AND ( public.is_active_org_member(r.from_organization_id)
            OR public.is_active_org_member(r.to_organization_id)));
$$;

-- the primary (owning) org of a care plan — resolves the plan's org for care_team_members writes
CREATE OR REPLACE FUNCTION public.care_plan_org(p_care_plan uuid)
  RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT cp.organization_id FROM public.care_plans cp WHERE cp.id = p_care_plan;
$$;

-- caller is an ACTIVE care-team member of the plan
CREATE OR REPLACE FUNCTION public.on_care_plan_team(p_care_plan uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.care_team_members ctm
    WHERE ctm.care_plan_id = p_care_plan
      AND ctm.member_user_id = auth.uid()
      AND ctm.status = 'active');
$$;

-- the full care_plan SELECT predicate (active care-team OR owning org OR admin-with-support);
-- reused verbatim by care_plans and care_plan_versions ("same readers as parent").
CREATE OR REPLACE FUNCTION public.can_read_care_plan(p_care_plan uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.care_plans cp
    WHERE cp.id = p_care_plan
      AND ( public.on_care_plan_team(cp.id)
            OR public.is_org_member(cp.organization_id, 'manage_care_plans')
            OR public.admin_has_support_access(cp.user_id)));
$$;

GRANT EXECUTE ON FUNCTION
  public.can_access_collab_request(uuid),
  public.care_plan_org(uuid),
  public.on_care_plan_team(uuid),
  public.can_read_care_plan(uuid)
TO authenticated;

-- ============================================================================
-- SECTION 2 — D9 trigger functions.
-- ============================================================================

-- (Blocker 4) capability-subset invariant — VERBATIM from spec Part 4 §4.5 (lines 950-993):
-- care_team_members.capabilities ⊆ the member's org organization_member_permissions
-- (owner_coach holds all caps implicitly).
CREATE OR REPLACE FUNCTION public.tg_validate_care_team_capabilities()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_member_id uuid;
  v_is_owner  boolean;
  v_missing   public.coach_capability;
BEGIN
  -- (a) resolve the member's ACTIVE org membership for this care plan's org
  SELECT m.id, (m.member_role = 'owner_coach')
    INTO v_member_id, v_is_owner
    FROM public.organization_members m
   WHERE m.organization_id = NEW.organization_id
     AND m.user_id         = NEW.member_user_id
     AND m.status          = 'active';

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'care-team member % is not an active member of org %',
      NEW.member_user_id, NEW.organization_id USING ERRCODE = 'restrict_violation';
  END IF;

  -- owner_coach holds all capabilities implicitly → any subset is valid
  IF v_is_owner THEN
    RETURN NEW;
  END IF;

  -- (b)+(c) every requested capability must exist in the member's org permission set
  SELECT cap INTO v_missing
    FROM unnest(NEW.capabilities) AS cap
   WHERE NOT EXISTS (
           SELECT 1 FROM public.organization_member_permissions p
            WHERE p.member_id  = v_member_id
              AND p.capability = cap)
   LIMIT 1;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION
      'care-team capability % exceeds member''s org permissions (member_user_id=%, org=%)',
      v_missing, NEW.member_user_id, NEW.organization_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END $$;

-- (arch §4 D9 constraint) a cross-org specialist — one whose org differs from the plan's primary
-- org — MUST carry a collaboration_agreement_id. Needs a cross-row lookup (the plan's org), so it
-- is a trigger, not a table CHECK. Kept separate from the verbatim Blocker-4 function above.
CREATE OR REPLACE FUNCTION public.tg_require_cross_org_agreement()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_plan_org uuid;
BEGIN
  SELECT cp.organization_id INTO v_plan_org
    FROM public.care_plans cp WHERE cp.id = NEW.care_plan_id;

  IF v_plan_org IS DISTINCT FROM NEW.organization_id
     AND NEW.collaboration_agreement_id IS NULL THEN
    RAISE EXCEPTION
      'cross-org care-team member (org=%, plan org=%) requires a collaboration_agreement_id',
      NEW.organization_id, v_plan_org USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END $$;

-- maintain care_plans.current_version as snapshots land in care_plan_versions (monotonic;
-- GREATEST guards out-of-order inserts). SECURITY DEFINER so the bump succeeds for any author
-- who passed the version INSERT policy (it writes the FORCE'd care_plans).
CREATE OR REPLACE FUNCTION public.tg_bump_careplan_version()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.care_plans
     SET current_version = GREATEST(current_version, NEW.version_number)
   WHERE id = NEW.care_plan_id;
  RETURN NULL;
END $$;

-- on agreement end (status → 'ended'): remove the collaborating org's care-team rows established
-- under this agreement, and revoke that org's active grant(s) on the shared customer.
CREATE OR REPLACE FUNCTION public.tg_agreement_end_cascade()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  -- (a) deactivate the external org's care-team rows tied to THIS agreement (pure D9)
  UPDATE public.care_team_members
     SET status = 'removed', removed_at = now()
   WHERE collaboration_agreement_id = NEW.id
     AND status = 'active';

  -- (b) revoke the collaborating org's active grant(s) on the customer. Forward-reference to the
  --     Phase-8 new-shape access_grants (organization_id/status/end_date), per 0005; guarded by
  --     check_function_bodies=off above.
  UPDATE public.access_grants
     SET status = 'revoked'
   WHERE organization_id = NEW.collaborating_organization_id
     AND user_id = NEW.user_id
     AND status = 'active';

  RETURN NULL;
END $$;

-- ============================================================================
-- SECTION 3 — enable RLS. collaboration_* = RLS-ON; care_* = RLS-FORCE (owner cannot bypass).
-- ============================================================================
ALTER TABLE public.collaboration_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboration_meetings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboration_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_plans               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_plans               FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.care_team_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_team_members        FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.care_plan_versions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_plan_versions       FORCE  ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 4 — triggers.
-- ============================================================================
-- touch updated_at on the five mutable tables (care_plan_versions is immutable, created_at-only)
DROP TRIGGER IF EXISTS collaboration_requests_touch ON public.collaboration_requests;
CREATE TRIGGER collaboration_requests_touch BEFORE UPDATE ON public.collaboration_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS collaboration_meetings_touch ON public.collaboration_meetings;
CREATE TRIGGER collaboration_meetings_touch BEFORE UPDATE ON public.collaboration_meetings
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS collaboration_agreements_touch ON public.collaboration_agreements;
CREATE TRIGGER collaboration_agreements_touch BEFORE UPDATE ON public.collaboration_agreements
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS care_plans_touch ON public.care_plans;
CREATE TRIGGER care_plans_touch BEFORE UPDATE ON public.care_plans
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS care_team_members_touch ON public.care_team_members;
CREATE TRIGGER care_team_members_touch BEFORE UPDATE ON public.care_team_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- care_team_members write-time guards (Blocker 4 + cross-org agreement)
DROP TRIGGER IF EXISTS care_team_members_validate_caps ON public.care_team_members;
CREATE TRIGGER care_team_members_validate_caps
  BEFORE INSERT OR UPDATE ON public.care_team_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_care_team_capabilities();
DROP TRIGGER IF EXISTS care_team_members_require_agreement ON public.care_team_members;
CREATE TRIGGER care_team_members_require_agreement
  BEFORE INSERT OR UPDATE ON public.care_team_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_require_cross_org_agreement();

-- care_plans version bump (AFTER INSERT on the snapshot table)
DROP TRIGGER IF EXISTS care_plan_versions_bump ON public.care_plan_versions;
CREATE TRIGGER care_plan_versions_bump AFTER INSERT ON public.care_plan_versions
  FOR EACH ROW EXECUTE FUNCTION public.tg_bump_careplan_version();

-- care_plan_versions IMMUT-BLOCK (append-only [B]; corrections = new versions)
DROP TRIGGER IF EXISTS care_plan_versions_immutable ON public.care_plan_versions;
CREATE TRIGGER care_plan_versions_immutable BEFORE UPDATE OR DELETE ON public.care_plan_versions
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_update_delete();

-- collaboration_agreements end-cascade (only on the active → ended transition)
DROP TRIGGER IF EXISTS collaboration_agreements_end_cascade ON public.collaboration_agreements;
CREATE TRIGGER collaboration_agreements_end_cascade AFTER UPDATE ON public.collaboration_agreements
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM 'ended' AND NEW.status = 'ended')
  EXECUTE FUNCTION public.tg_agreement_end_cascade();

-- ============================================================================
-- SECTION 5 — table privileges. Revoke the implicit grants, then grant the minimum DML the
-- policies gate. No DELETE anywhere (lifecycle via status; care_plan_versions is immutable).
-- ============================================================================
REVOKE ALL ON public.collaboration_requests   FROM anon, authenticated;
REVOKE ALL ON public.collaboration_meetings   FROM anon, authenticated;
REVOKE ALL ON public.collaboration_agreements FROM anon, authenticated;
REVOKE ALL ON public.care_plans               FROM anon, authenticated;
REVOKE ALL ON public.care_team_members        FROM anon, authenticated;
REVOKE ALL ON public.care_plan_versions       FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.collaboration_requests   TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.collaboration_meetings   TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.collaboration_agreements TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.care_plans               TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.care_team_members        TO authenticated;
GRANT SELECT, INSERT         ON public.care_plan_versions        TO authenticated; -- INSERT-only

-- ============================================================================
-- SECTION 6 — policies (all TO authenticated).
-- ============================================================================

-- collaboration_requests — members of EITHER org (spec: SELECT/write = either org); the from-org
-- initiates, either side may update (cancel / accept / decline).
DROP POLICY IF EXISTS collaboration_requests_select ON public.collaboration_requests;
CREATE POLICY collaboration_requests_select ON public.collaboration_requests FOR SELECT TO authenticated
  USING (public.is_active_org_member(from_organization_id)
         OR public.is_active_org_member(to_organization_id));
DROP POLICY IF EXISTS collaboration_requests_insert ON public.collaboration_requests;
CREATE POLICY collaboration_requests_insert ON public.collaboration_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() AND public.is_active_org_member(from_organization_id));
DROP POLICY IF EXISTS collaboration_requests_update ON public.collaboration_requests;
CREATE POLICY collaboration_requests_update ON public.collaboration_requests FOR UPDATE TO authenticated
  USING (public.is_active_org_member(from_organization_id)
         OR public.is_active_org_member(to_organization_id))
  WITH CHECK (public.is_active_org_member(from_organization_id)
              OR public.is_active_org_member(to_organization_id));

-- collaboration_meetings — the hosting org plus (when linked) either org of the request.
DROP POLICY IF EXISTS collaboration_meetings_select ON public.collaboration_meetings;
CREATE POLICY collaboration_meetings_select ON public.collaboration_meetings FOR SELECT TO authenticated
  USING (public.is_active_org_member(organization_id)
         OR public.can_access_collab_request(collaboration_request_id));
DROP POLICY IF EXISTS collaboration_meetings_insert ON public.collaboration_meetings;
CREATE POLICY collaboration_meetings_insert ON public.collaboration_meetings FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid()
              AND (public.is_active_org_member(organization_id)
                   OR public.can_access_collab_request(collaboration_request_id)));
DROP POLICY IF EXISTS collaboration_meetings_update ON public.collaboration_meetings;
CREATE POLICY collaboration_meetings_update ON public.collaboration_meetings FOR UPDATE TO authenticated
  USING (public.is_active_org_member(organization_id)
         OR public.can_access_collab_request(collaboration_request_id))
  WITH CHECK (public.is_active_org_member(organization_id)
              OR public.can_access_collab_request(collaboration_request_id));

-- collaboration_agreements — both orgs read; the primary org creates; either org may update.
DROP POLICY IF EXISTS collaboration_agreements_select ON public.collaboration_agreements;
CREATE POLICY collaboration_agreements_select ON public.collaboration_agreements FOR SELECT TO authenticated
  USING (public.is_active_org_member(primary_organization_id)
         OR public.is_active_org_member(collaborating_organization_id));
DROP POLICY IF EXISTS collaboration_agreements_insert ON public.collaboration_agreements;
CREATE POLICY collaboration_agreements_insert ON public.collaboration_agreements FOR INSERT TO authenticated
  WITH CHECK (public.is_active_org_member(primary_organization_id));
DROP POLICY IF EXISTS collaboration_agreements_update ON public.collaboration_agreements;
CREATE POLICY collaboration_agreements_update ON public.collaboration_agreements FOR UPDATE TO authenticated
  USING (public.is_active_org_member(primary_organization_id)
         OR public.is_active_org_member(collaborating_organization_id))
  WITH CHECK (public.is_active_org_member(primary_organization_id)
              OR public.is_active_org_member(collaborating_organization_id));

-- care_plans — SELECT = active care-team + owning org + admin-with-support; write = manage_care_plans.
DROP POLICY IF EXISTS care_plans_select ON public.care_plans;
CREATE POLICY care_plans_select ON public.care_plans FOR SELECT TO authenticated
  USING (public.can_read_care_plan(id));
DROP POLICY IF EXISTS care_plans_insert ON public.care_plans;
CREATE POLICY care_plans_insert ON public.care_plans FOR INSERT TO authenticated
  WITH CHECK (created_by_user_id = auth.uid()
              AND public.is_org_member(organization_id, 'manage_care_plans'));
DROP POLICY IF EXISTS care_plans_update ON public.care_plans;
CREATE POLICY care_plans_update ON public.care_plans FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, 'manage_care_plans'))
  WITH CHECK (public.is_org_member(organization_id, 'manage_care_plans'));

-- care_team_members — readers = plan readers (+ the member sees their own row); writes by the
-- plan-owning org's manage_care_plans holder (the Blocker-4 + cross-org guards run as triggers).
DROP POLICY IF EXISTS care_team_members_select ON public.care_team_members;
CREATE POLICY care_team_members_select ON public.care_team_members FOR SELECT TO authenticated
  USING (public.can_read_care_plan(care_plan_id) OR member_user_id = auth.uid());
DROP POLICY IF EXISTS care_team_members_insert ON public.care_team_members;
CREATE POLICY care_team_members_insert ON public.care_team_members FOR INSERT TO authenticated
  WITH CHECK (added_by = auth.uid()
              AND public.is_org_member(public.care_plan_org(care_plan_id), 'manage_care_plans'));
DROP POLICY IF EXISTS care_team_members_update ON public.care_team_members;
CREATE POLICY care_team_members_update ON public.care_team_members FOR UPDATE TO authenticated
  USING (public.is_org_member(public.care_plan_org(care_plan_id), 'manage_care_plans'))
  WITH CHECK (public.is_org_member(public.care_plan_org(care_plan_id), 'manage_care_plans'));

-- care_plan_versions — read = parent readers; INSERT-only, by the plan-owning manage_care_plans
-- holder (UPDATE/DELETE blocked by IMMUT-BLOCK + no grant).
DROP POLICY IF EXISTS care_plan_versions_select ON public.care_plan_versions;
CREATE POLICY care_plan_versions_select ON public.care_plan_versions FOR SELECT TO authenticated
  USING (public.can_read_care_plan(care_plan_id));
DROP POLICY IF EXISTS care_plan_versions_insert ON public.care_plan_versions;
CREATE POLICY care_plan_versions_insert ON public.care_plan_versions FOR INSERT TO authenticated
  WITH CHECK (authored_by_user_id = auth.uid()
              AND public.is_org_member(public.care_plan_org(care_plan_id), 'manage_care_plans'));

-- ============================================================================
-- NOTES
-- • tg_agreement_end_cascade's grant-half targets the Phase-8 new-shape access_grants; until that
--   table lands, ending an agreement still cascades the care-team rows (the access_grants UPDATE
--   simply matches nothing on the legacy table — but in a fully-migrated deployment it revokes).
-- • care_plans / care_team_members back the foundation health-read helpers on_care_team() /
--   can_read_health() (0005). Their existence here closes that forward reference.
-- • Cross-org capability enforcement is split: Blocker-4 (capabilities ⊆ org perms) and the
--   cross-org-agreement requirement are both write-time triggers; on_care_team() re-checks
--   liveness at read time (grant ∩ org-cap ∩ care-team-cap; most restrictive wins).
-- =============================================================================

RESET check_function_bodies;
