-- =============================================================================
-- Vitalé — Post-companion 0114: access_grants RLS, triggers, grants
-- Ground truth: VITALE_DB_ARCHITECTURE §4 D2 (lines 244-251) + VITALE_IMPLEMENTATION_SPEC
-- Part 2 D2 (lines 236-242).
--
-- Table (Drizzle-owned DDL in lib/db/src/schema/access.ts), RLS-FORCE:
--   access_grants [C] — org-scoped, source-bound data access grant. The grantee is the
--     ORGANIZATION; grants are bound to the source record that justifies them (program_enrollment,
--     diet_assignment, lab_review, care_plan, collaboration_agreement, or manual_consent).
--     SELECT = data subject + grantee-org members with view_client_health.
--     INSERT/UPDATE = data subject only (org cannot self-grant; subject creates/revokes own grants).
--     Liveness predicate: status='active' AND (end_date IS NULL OR end_date > now()).
--
-- Triggers:
--   • tg_require_consent_on_activate — BEFORE INSERT/UPDATE: when status='active', assert that the
--     data subject has at least one live dpdp_consent_records row (granted=true). Blocked by
--     dpdp_consent_records dependency built in 0112.
--   • tg_validate_grant_source — BEFORE INSERT: per source_type, assert source_id exists in the
--     correct parent table (program_enrollments | diet_chart_assignments | lab_reports |
--     care_plans | collaboration_agreements | dpdp_consent_records for manual_consent).
--   • tg_touch_updated_at — BEFORE UPDATE.
--
-- Reuses helpers: is_org_member (0005). No forward references → no check_function_bodies toggle.
-- Apply order: after migrate + after 0113 (lexical). Idempotent: CREATE OR REPLACE; DROP IF EXISTS.
-- =============================================================================

-- ============================================================================
-- SECTION 1 — trigger functions.
-- ============================================================================

-- Consent gate: activating a grant requires the subject's explicit consent (DPDP §5).
-- Fires BEFORE INSERT/UPDATE so consent absence blocks the row from landing.
CREATE OR REPLACE FUNCTION public.tg_require_consent_on_activate()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status = 'active' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.dpdp_consent_records
      WHERE user_id = NEW.user_id AND granted = true
    ) THEN
      RAISE EXCEPTION
        'access_grants: cannot activate grant for user % — no live dpdp_consent_records (granted=true)',
        NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Source integrity: per source_type, assert source_id exists in the correct parent table.
-- Implements the polymorphic FK validation described in arch §4 D2 / spec Part 2 D2.
-- Fires BEFORE INSERT only (source_type + source_id are set at creation, never changed).
CREATE OR REPLACE FUNCTION public.tg_validate_grant_source()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.source_type = 'program_enrollment' THEN
    IF NOT EXISTS (SELECT 1 FROM public.program_enrollments WHERE id = NEW.source_id) THEN
      RAISE EXCEPTION 'access_grants: source_id % not found in program_enrollments', NEW.source_id;
    END IF;
  ELSIF NEW.source_type = 'diet_assignment' THEN
    IF NOT EXISTS (SELECT 1 FROM public.diet_chart_assignments WHERE id = NEW.source_id) THEN
      RAISE EXCEPTION 'access_grants: source_id % not found in diet_chart_assignments', NEW.source_id;
    END IF;
  ELSIF NEW.source_type = 'lab_review' THEN
    IF NOT EXISTS (SELECT 1 FROM public.lab_reports WHERE id = NEW.source_id) THEN
      RAISE EXCEPTION 'access_grants: source_id % not found in lab_reports', NEW.source_id;
    END IF;
  ELSIF NEW.source_type = 'care_plan' THEN
    IF NOT EXISTS (SELECT 1 FROM public.care_plans WHERE id = NEW.source_id) THEN
      RAISE EXCEPTION 'access_grants: source_id % not found in care_plans', NEW.source_id;
    END IF;
  ELSIF NEW.source_type = 'collaboration_agreement' THEN
    IF NOT EXISTS (SELECT 1 FROM public.collaboration_agreements WHERE id = NEW.source_id) THEN
      RAISE EXCEPTION 'access_grants: source_id % not found in collaboration_agreements', NEW.source_id;
    END IF;
  ELSIF NEW.source_type = 'manual_consent' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.dpdp_consent_records WHERE id = NEW.source_id AND granted = true
    ) THEN
      RAISE EXCEPTION
        'access_grants: source_id % not found in dpdp_consent_records or consent is not granted',
        NEW.source_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- SECTION 2 — enable RLS-FORCE (clinical-boundary equivalent for health access).
-- ============================================================================
ALTER TABLE public.access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_grants FORCE  ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 3 — triggers.
-- ============================================================================
DROP TRIGGER IF EXISTS access_grants_require_consent ON public.access_grants;
CREATE TRIGGER access_grants_require_consent BEFORE INSERT OR UPDATE ON public.access_grants
  FOR EACH ROW EXECUTE FUNCTION public.tg_require_consent_on_activate();

DROP TRIGGER IF EXISTS access_grants_validate_source ON public.access_grants;
CREATE TRIGGER access_grants_validate_source BEFORE INSERT ON public.access_grants
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_grant_source();

DROP TRIGGER IF EXISTS access_grants_touch ON public.access_grants;
CREATE TRIGGER access_grants_touch BEFORE UPDATE ON public.access_grants
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============================================================================
-- SECTION 4 — table privileges.
--   Authenticated users: SELECT (subject + org), INSERT (subject creates own grants),
--   UPDATE (subject revokes own grants). No DELETE (soft lifecycle via status only).
-- ============================================================================
REVOKE ALL ON public.access_grants FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.access_grants TO authenticated;

-- ============================================================================
-- SECTION 5 — policies (all TO authenticated).
-- ============================================================================

-- SELECT: the data subject reads their own grants; grantee-org members with view_client_health
-- can see grants where their org is the grantee (to scope their data-read decisions).
DROP POLICY IF EXISTS access_grants_select ON public.access_grants;
CREATE POLICY access_grants_select ON public.access_grants FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_org_member(organization_id, 'view_client_health'));

-- INSERT: data subject only (auth.uid() = the subject). Org cannot self-grant.
-- tg_require_consent_on_activate + tg_validate_grant_source fire as additional guards.
DROP POLICY IF EXISTS access_grants_insert ON public.access_grants;
CREATE POLICY access_grants_insert ON public.access_grants FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: subject can revoke (update status to 'revoked', set revoked_at/revoked_by).
-- The row must belong to the subject; no re-activation (only subject can grant/revoke own data).
DROP POLICY IF EXISTS access_grants_update ON public.access_grants;
CREATE POLICY access_grants_update ON public.access_grants FOR UPDATE TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- NOTES
-- • org_has_active_grant() (0005, forward-referenced under check_function_bodies=off) now
--   resolves against this table. Liveness test: status='active' AND (end_date IS NULL OR
--   end_date > now()). The helper queries organization_id + user_id + data_categories_granted.
-- • tg_agreement_end_cascade (0110) deactivates grants WHERE organization_id=collaborating_org
--   AND user_id=shared_customer AND status='active' when a collaboration agreement ends.
-- • tg_validate_grant_source fires BEFORE INSERT only; source_type + source_id are immutable
--   after creation (no UPDATE policy exposes them for change by authenticated users).
-- • tg_require_consent_on_activate: the consent gate closes the DPDP §5 loop — a grant cannot
--   be activated unless the subject has an explicit live consent record. The tg_enrollment_grant
--   trigger (programs RLS, Phase 4) and the lab-share API (labs.ts) both create active grants,
--   so this gate fires for every new active grant regardless of source.
-- =============================================================================
