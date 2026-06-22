-- =============================================================================
-- Vitalé — Post-companion 0111: D14 Clinical Coaching (RLS, grants, triggers)
-- Ground truth: VITALE_DB_ARCHITECTURE §4 D14 (lines 543-561) + VITALE_IMPLEMENTATION_SPEC
-- Part 2 D14 (lines 565-575).
--
-- Tables (Drizzle-owned DDL in lib/db/src/schema/clinical.ts), all RLS-FORCE:
--   clinical_notes [B immutable] — REVOKE-API: INSERT direct, but NO direct SELECT (reads go
--                                  through the Phase-8 audited rpc_read_clinical_note). UPDATE/
--                                  DELETE denied (IMMUT-BLOCK) — corrections are addendum rows.
--   interventions / outcomes      — care-team + subject readers; care-team writers (tg_touch).
--
-- Reuses helpers already created earlier in the post-companion sequence: care_plan_org /
-- on_care_plan_team / can_read_care_plan (0110) and is_org_member / org_has_active_grant (0005).
-- Apply order: after the Drizzle migrate step and after 0110 (care helpers); lexical order
-- places it last. No forward references in this file's own function bodies (org_has_active_grant
-- is merely *called* in a policy; its body was validated under 0005's check_function_bodies=off).
--
-- Idempotent: CREATE OR REPLACE; DROP ... IF EXISTS before every trigger/policy.
-- =============================================================================

-- ============================================================================
-- SECTION 1 — author-integrity helper (SECURITY DEFINER → avoids RLS recursion on
-- organization_members). p_org NULL skips the org match (interventions/outcomes carry no org
-- column; clinical_notes passes its organization_id for the tighter same-org check).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.member_is_self_in_org(p_member uuid, p_org uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.id = p_member
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND (p_org IS NULL OR m.organization_id = p_org));
$$;

GRANT EXECUTE ON FUNCTION public.member_is_self_in_org(uuid, uuid) TO authenticated;

-- ============================================================================
-- SECTION 2 — enable RLS-FORCE on all three (owner cannot bypass; clinical access boundary).
-- ============================================================================
ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_notes FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.interventions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interventions  FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.outcomes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outcomes       FORCE  ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 3 — triggers.
-- ============================================================================
-- clinical_notes IMMUT-BLOCK: append-only. UPDATE/DELETE denied to ALL roles (no edited_at /
-- deleted_at / updated_at columns exist; corrections are addendum rows).
DROP TRIGGER IF EXISTS clinical_notes_immutable ON public.clinical_notes;
CREATE TRIGGER clinical_notes_immutable BEFORE UPDATE OR DELETE ON public.clinical_notes
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_update_delete();

-- interventions / outcomes carry updated_at → touch on UPDATE.
DROP TRIGGER IF EXISTS interventions_touch ON public.interventions;
CREATE TRIGGER interventions_touch BEFORE UPDATE ON public.interventions
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS outcomes_touch ON public.outcomes;
CREATE TRIGGER outcomes_touch BEFORE UPDATE ON public.outcomes
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============================================================================
-- SECTION 4 — table privileges.
--   clinical_notes: REVOKE-API → grant INSERT only; SELECT stays revoked (read via the audited
--   Phase-8 rpc_read_clinical_note). No UPDATE/DELETE (immutable).
--   interventions / outcomes: SELECT/INSERT/UPDATE (no DELETE; lifecycle via status).
-- ============================================================================
REVOKE ALL ON public.clinical_notes FROM anon, authenticated;
REVOKE ALL ON public.interventions  FROM anon, authenticated;
REVOKE ALL ON public.outcomes        FROM anon, authenticated;

GRANT INSERT                 ON public.clinical_notes TO authenticated; -- REVOKE-API: no SELECT grant
GRANT SELECT, INSERT, UPDATE ON public.interventions  TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.outcomes        TO authenticated;

-- ============================================================================
-- SECTION 5 — policies (all TO authenticated).
-- ============================================================================

-- clinical_notes.
-- SELECT predicate (arch §4 D14): the author's org members holding write_clinical_notes WITH an
-- active 'clinical' grant on the subject, plus the subject when the note is shared. NOTE: because
-- SELECT is REVOKED from authenticated above (REVOKE-API), this policy is not reachable by a raw
-- client query — reads go through the SECURITY DEFINER rpc_read_clinical_note (Phase 8), which
-- re-enforces this same predicate and writes a coach_data_access_audit row. The policy documents
-- and defends the predicate for any non-bypassing reader. No admin clause: ambient admin access
-- to clinical notes is intentionally excluded (DPDP).
DROP POLICY IF EXISTS clinical_notes_select ON public.clinical_notes;
CREATE POLICY clinical_notes_select ON public.clinical_notes FOR SELECT TO authenticated
  USING (
    (subject_user_id = auth.uid() AND visibility = 'shared_with_user')
    OR ( public.is_org_member(organization_id, 'write_clinical_notes')
         AND public.org_has_active_grant(organization_id, subject_user_id, 'clinical')));
-- INSERT: the caller must hold write_clinical_notes + an active 'clinical' grant on the subject,
-- and must record THEMSELVES as author (author_member_id is their own active membership in this
-- org). The addendum/parent invariant is the table CHECK; immutability is the trigger above.
DROP POLICY IF EXISTS clinical_notes_insert ON public.clinical_notes;
CREATE POLICY clinical_notes_insert ON public.clinical_notes FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id, 'write_clinical_notes')
    AND public.org_has_active_grant(organization_id, subject_user_id, 'clinical')
    AND public.member_is_self_in_org(author_member_id, organization_id));

-- interventions — read = plan readers (care-team + owning org + admin-support, via
-- can_read_care_plan) OR the subject; write = active care-team / plan owner, recording self as
-- author. Subject is read-only.
DROP POLICY IF EXISTS interventions_select ON public.interventions;
CREATE POLICY interventions_select ON public.interventions FOR SELECT TO authenticated
  USING (public.can_read_care_plan(care_plan_id) OR subject_user_id = auth.uid());
DROP POLICY IF EXISTS interventions_insert ON public.interventions;
CREATE POLICY interventions_insert ON public.interventions FOR INSERT TO authenticated
  WITH CHECK (
    public.member_is_self_in_org(author_member_id, NULL)
    AND ( public.on_care_plan_team(care_plan_id)
          OR public.is_org_member(public.care_plan_org(care_plan_id), 'manage_care_plans')));
DROP POLICY IF EXISTS interventions_update ON public.interventions;
CREATE POLICY interventions_update ON public.interventions FOR UPDATE TO authenticated
  USING (public.on_care_plan_team(care_plan_id)
         OR public.is_org_member(public.care_plan_org(care_plan_id), 'manage_care_plans'))
  WITH CHECK (public.on_care_plan_team(care_plan_id)
              OR public.is_org_member(public.care_plan_org(care_plan_id), 'manage_care_plans'));

-- outcomes — same access shape as interventions (no author_member_id column on this table).
DROP POLICY IF EXISTS outcomes_select ON public.outcomes;
CREATE POLICY outcomes_select ON public.outcomes FOR SELECT TO authenticated
  USING (public.can_read_care_plan(care_plan_id) OR subject_user_id = auth.uid());
DROP POLICY IF EXISTS outcomes_insert ON public.outcomes;
CREATE POLICY outcomes_insert ON public.outcomes FOR INSERT TO authenticated
  WITH CHECK (public.on_care_plan_team(care_plan_id)
              OR public.is_org_member(public.care_plan_org(care_plan_id), 'manage_care_plans'));
DROP POLICY IF EXISTS outcomes_update ON public.outcomes;
CREATE POLICY outcomes_update ON public.outcomes FOR UPDATE TO authenticated
  USING (public.on_care_plan_team(care_plan_id)
         OR public.is_org_member(public.care_plan_org(care_plan_id), 'manage_care_plans'))
  WITH CHECK (public.on_care_plan_team(care_plan_id)
              OR public.is_org_member(public.care_plan_org(care_plan_id), 'manage_care_plans'));

-- ============================================================================
-- NOTES
-- • rpc_read_clinical_note (SECURITY DEFINER, audited) lands in Phase 8 with the new-shape
--   coach_data_access_audit; until then clinical_notes is unreadable via the API (INSERT-only),
--   which is the safe default for the most sensitive table.
-- • author_member_id immutability (arch) is subsumed by the whole-row IMMUT-BLOCK; the snapshot
--   author_role_at_time is therefore frozen at insert.
-- • interventions/outcomes are user-visible clinical feedback → the subject reads their own rows;
--   writes remain care-team-only.
-- =============================================================================
