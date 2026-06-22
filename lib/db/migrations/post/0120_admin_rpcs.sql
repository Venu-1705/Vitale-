-- =============================================================================
-- Vitalé — Post-companion 0120: admin read RPCs + DPDP erasure RPC
-- Ground truth: VITALE_IMPLEMENTATION_SPEC Part 3 §RLS flow (lines 792-809),
-- Phase 8 migration order (line 1133), arch §7 (admin ambient access = none).
--
-- RPCs delivered here:
--   • rpc_read_health_observations — coach/admin reads health data; audited in-tx
--   • rpc_read_lab_report          — coach/admin reads a lab report; audited in-tx
--   • rpc_anonymize_user           — DPDP right-to-erasure; service-role only
--
-- All are SECURITY DEFINER, SET search_path = public, pg_temp.
-- OWNERSHIP: the two audited PHI read RPCs (rpc_read_health_observations, rpc_read_lab_report)
-- INSERT into coach_data_access_audit, a FORCE-RLS table with no INSERT policy for authenticated.
-- They MUST therefore be owned by the BYPASSRLS migration role (default `v`) so the in-tx audit
-- write succeeds and the definer context can read the REVOKE-API source tables — NOT by the
-- low-privilege rls_owner (0119), which owns ordinary RLS helper functions only. This matches the
-- live siblings (rpc_read_clinical_note 0130, rpc_update_health_observation 0132, both owned by v).
-- GRANT EXECUTE to authenticated here; the access gate is enforced on auth.uid() inside each body.
-- rpc_anonymize_user: REVOKE from authenticated; callable only via service_role.
--
-- Apply order: after 0119 (lexical). Idempotent: CREATE OR REPLACE.
-- =============================================================================

-- ============================================================================
-- SECTION 1 — rpc_read_health_observations
-- Coach or admin reads a subject's health observations for a metric + range.
-- Gate: can_read_health(subject_user_id) OR admin_has_support_access(subject).
-- In-tx audit: INSERT into coach_data_access_audit; on failure audit rolls back.
-- Returns: matching rows from health_observations (REVOKE-API table).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_read_health_observations(
  p_subject_user_id   uuid,
  p_metric_id         uuid,
  p_from_date         date,
  p_to_date           date
)
RETURNS TABLE (
  id                  uuid,
  subject_user_id     uuid,
  metric_definition_id uuid,
  measured_date_ist   date,
  value_numeric       numeric,
  value_bool          boolean,
  value_text          text,
  source              text,
  recorded_by_user_id uuid,
  reading_group_id    uuid,
  created_at          timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_caller        uuid := auth.uid();
  v_acting_as     public.audit_acting_as;
  v_org_id        uuid;
  v_role          public.member_role;
  v_is_self       boolean := (v_caller = p_subject_user_id);
BEGIN
  -- Gate: caller must be the subject, a coach with active grant, or an admin
  -- with a live support-access case. acting_as / org are resolved to the frozen
  -- audit vocabulary (no 'self'/'coach' — those are not audit_acting_as values).
  IF v_is_self THEN
    -- D1: self-reads are permitted but NOT written to coach_data_access_audit
    -- (a subject reading their own data is not coach/admin data access). No
    -- acting_as / org is computed; the audit INSERT below is skipped.
    NULL;
  ELSIF public.can_read_health(p_subject_user_id) THEN
    -- Coach acting in the specific org that shares this subject's data. Record
    -- the actor's REAL org role (owner_coach|nutritionist|community_manager) —
    -- all valid audit_acting_as values (matches 0126/0127).
    SELECT m.organization_id, m.member_role INTO v_org_id, v_role
      FROM public.organization_members m
      JOIN public.access_grants g
        ON g.organization_id = m.organization_id
       AND g.user_id = p_subject_user_id
       AND g.status  = 'active'
     WHERE m.user_id = v_caller AND m.status = 'active'
     LIMIT 1;
    IF v_org_id IS NULL THEN  -- fallback: caller's active membership
      SELECT organization_id, member_role INTO v_org_id, v_role
        FROM public.organization_members
       WHERE user_id = v_caller AND status = 'active'
       LIMIT 1;
    END IF;
    v_acting_as := COALESCE(v_role::text::public.audit_acting_as, 'owner_coach');
  ELSIF public.admin_has_support_access(p_subject_user_id) THEN
    v_acting_as := 'admin';
    -- D2: admin break-glass records the SUBJECT's organization context (the org
    -- that owns the accessed data), not the admin's. Resolve from the subject's
    -- active access grant, falling back to an active care plan.
    SELECT g.organization_id INTO v_org_id
      FROM public.access_grants g
     WHERE g.user_id = p_subject_user_id AND g.status = 'active'
     ORDER BY g.created_at DESC LIMIT 1;
    IF v_org_id IS NULL THEN
      SELECT cp.organization_id INTO v_org_id
        FROM public.care_plans cp
       WHERE cp.user_id = p_subject_user_id AND cp.status = 'active'
       ORDER BY cp.created_at DESC LIMIT 1;
    END IF;
  ELSE
    RAISE EXCEPTION 'rpc_read_health_observations: access denied for caller % on subject %',
      v_caller, p_subject_user_id USING ERRCODE = '42501';
  END IF;

  -- In-transaction audit row (immutable; rolls back if the read fails). Skipped
  -- for self-access (D1). organization_id is NOT NULL: if no org context can be
  -- resolved the INSERT raises and the whole read fails closed — correct for a
  -- coach/admin PHI access that cannot be attributed to an org.
  IF NOT v_is_self THEN
    INSERT INTO public.coach_data_access_audit
      (id, accessed_at, organization_id, accessor_user_id, data_subject_user_id,
       acting_as, resource_type, resource_id, action, calendar_day_ist)
    VALUES
      (gen_random_uuid(), now(), v_org_id, v_caller, p_subject_user_id,
       v_acting_as, 'health_observation', p_metric_id, 'view',
       (now() AT TIME ZONE 'Asia/Kolkata')::date);
  END IF;

  -- Return matching observations (REVOKE-API table; SECURITY DEFINER context reads it)
  RETURN QUERY
  SELECT
    ho.id,
    ho.subject_user_id,
    ho.metric_definition_id,
    ho.measured_date_ist,
    ho.value_numeric,
    ho.value_bool,
    ho.value_text,
    ho.source::text,
    ho.recorded_by_user_id,
    ho.reading_group_id,
    ho.created_at
  FROM public.health_observations ho
  WHERE ho.subject_user_id     = p_subject_user_id
    AND ho.metric_definition_id = p_metric_id
    AND ho.measured_date_ist   BETWEEN p_from_date AND p_to_date
  ORDER BY ho.measured_date_ist DESC;
END;
$$;

-- ============================================================================
-- SECTION 2 — rpc_read_lab_report
-- Coach or admin reads a single lab report with its result rows.
-- Gate: subject owns the report, OR can_read_health(subject), OR admin.
-- In-tx audit row written; on any failure the audit rolls back.
-- Returns: the lab_report row + its lab_report_results as JSON.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_read_lab_report(
  p_report_id uuid
)
RETURNS TABLE (
  id               uuid,
  booking_id       uuid,
  user_id          uuid,
  title            text,
  report_date      timestamptz,
  status           text,
  abnormal_count   int,
  package_name     text,
  thyrocare_report_id text,
  created_at       timestamptz,
  results          jsonb
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_caller    uuid := auth.uid();
  v_acting_as public.audit_acting_as;
  v_org_id    uuid;
  v_role      public.member_role;
  v_is_self   boolean;
  v_report    public.lab_reports%ROWTYPE;
BEGIN
  -- Load the report first (need subject_user_id for gate check)
  SELECT * INTO v_report FROM public.lab_reports WHERE lab_reports.id = p_report_id;
  IF NOT FOUND THEN
    -- no_data_found (P0002) → not_found → 404 (a missing report is not a business-rule 422).
    RAISE EXCEPTION 'rpc_read_lab_report: report % not found', p_report_id
      USING ERRCODE = 'no_data_found';
  END IF;

  v_is_self := (v_caller = v_report.user_id);

  -- Gate (acting_as / org resolved to the frozen audit vocabulary; no 'self'/'coach').
  IF v_is_self THEN
    -- D1: self-reads are permitted but NOT audited (see rpc_read_health_observations).
    NULL;
  ELSIF public.can_read_health(v_report.user_id) THEN
    -- Coach acting in the org that shares this subject's data; record real org role.
    SELECT m.organization_id, m.member_role INTO v_org_id, v_role
      FROM public.organization_members m
      JOIN public.access_grants g
        ON g.organization_id = m.organization_id
       AND g.user_id = v_report.user_id
       AND g.status  = 'active'
     WHERE m.user_id = v_caller AND m.status = 'active'
     LIMIT 1;
    IF v_org_id IS NULL THEN
      SELECT organization_id, member_role INTO v_org_id, v_role
        FROM public.organization_members
       WHERE user_id = v_caller AND status = 'active'
       LIMIT 1;
    END IF;
    v_acting_as := COALESCE(v_role::text::public.audit_acting_as, 'owner_coach');
  ELSIF public.admin_has_support_access(v_report.user_id) THEN
    v_acting_as := 'admin';
    -- D2: subject's organization context (org that owns the accessed data).
    SELECT g.organization_id INTO v_org_id
      FROM public.access_grants g
     WHERE g.user_id = v_report.user_id AND g.status = 'active'
     ORDER BY g.created_at DESC LIMIT 1;
    IF v_org_id IS NULL THEN
      SELECT cp.organization_id INTO v_org_id
        FROM public.care_plans cp
       WHERE cp.user_id = v_report.user_id AND cp.status = 'active'
       ORDER BY cp.created_at DESC LIMIT 1;
    END IF;
  ELSE
    -- 42501 → rls_denied → 403 (consistent with rpc_read_health_observations / rpc_read_clinical_note).
    RAISE EXCEPTION 'rpc_read_lab_report: access denied for caller % on report %',
      v_caller, p_report_id USING ERRCODE = '42501';
  END IF;

  -- In-tx audit (skipped for self-access per D1; rolls back if the read fails).
  IF NOT v_is_self THEN
    INSERT INTO public.coach_data_access_audit
      (id, accessed_at, organization_id, accessor_user_id, data_subject_user_id,
       acting_as, resource_type, resource_id, action, calendar_day_ist)
    VALUES
      (gen_random_uuid(), now(), v_org_id, v_caller, v_report.user_id,
       v_acting_as, 'lab_report', p_report_id, 'view',
       (now() AT TIME ZONE 'Asia/Kolkata')::date);
  END IF;

  -- Return report + results bundled
  RETURN QUERY
  SELECT
    v_report.id,
    v_report.booking_id,
    v_report.user_id,
    v_report.title,
    v_report.report_date,
    v_report.status,
    v_report.abnormal_count,
    v_report.package_name,
    v_report.thyrocare_report_id,
    v_report.created_at,
    (SELECT jsonb_agg(row_to_json(r.*))
     FROM public.lab_report_results r
     WHERE r.report_id = p_report_id) AS results;
END;
$$;

-- ============================================================================
-- SECTION 3 — rpc_anonymize_user  (DPDP right-to-erasure)
-- Callable only via service_role (REVOKE from authenticated).
-- Steps (arch §7 DPDP erasure, line 696):
--   1. Null PII in users + user_profiles; set is_anonymized = true.
--   2. Revoke all active access_grants (status='revoked').
--   3. Mark open enrollments/subscriptions as cancelled.
--   4. Update data_deletion_requests status to 'completed'.
--   5. Re-attribute community_posts to org (posted_by = org sentinel).
-- Does NOT delete audit/consent/financial rows (immutable legal basis).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_anonymize_user(
  p_user_id          uuid,
  p_deletion_request_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  -- 1. Anonymize identity
  UPDATE public.users
  SET
    phone        = NULL,
    email        = NULL,
    is_anonymized = true,
    updated_at   = now()
  WHERE id = p_user_id;

  UPDATE public.user_profiles
  SET
    full_name    = '[deleted]',
    date_of_birth = NULL,
    avatar_asset_id = NULL,
    updated_at   = now()
  WHERE user_id = p_user_id;

  -- 2. Revoke all active access grants for this subject
  UPDATE public.access_grants
  SET status = 'revoked', revoked_at = now(), revoked_by = p_user_id, updated_at = now()
  WHERE user_id = p_user_id AND status = 'active';

  -- 3. Cancel open enrollments
  UPDATE public.program_enrollments
  SET status = 'cancelled', updated_at = now()
  WHERE user_id = p_user_id AND status IN ('active', 'pending');

  -- 4. Cancel active subscriptions
  UPDATE public.coach_subscriptions
  SET status = 'cancelled', updated_at = now()
  WHERE coach_id = p_user_id AND status IN ('active', 'trialing', 'past_due');

  -- 5. Complete the deletion request
  UPDATE public.data_deletion_requests
  SET status = 'completed', completed_at = now(), updated_at = now()
  WHERE id = p_deletion_request_id AND user_id = p_user_id;

  -- NOTE: audit/consent/financial rows are intentionally retained (immutable legal basis).
  -- PHI storage object deletion is handled by the service-role worker that calls this RPC.
END;
$$;

-- ============================================================================
-- SECTION 4 — privileges
-- ============================================================================

-- Health observations RPC: grant to authenticated (gate enforced inside)
REVOKE ALL ON FUNCTION public.rpc_read_health_observations(uuid, uuid, date, date) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rpc_read_health_observations(uuid, uuid, date, date) TO authenticated;

-- Lab report RPC: grant to authenticated (gate enforced inside)
REVOKE ALL ON FUNCTION public.rpc_read_lab_report(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rpc_read_lab_report(uuid) TO authenticated;

-- Erasure RPC: service_role only (REVOKE from anon + authenticated)
REVOKE ALL ON FUNCTION public.rpc_anonymize_user(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- NOTES
-- • rpc_anonymize_user is NOT GRANT-ed to authenticated. The Express API must
--   call it via the service_role Postgres connection (bypasses RLS).
--   Never expose the service_role key to the browser/mobile client.
-- • can_read_health() and admin_has_support_access() are STABLE, so their
--   results are cached as scalar InitPlans within each RPC call.
-- • gen_random_uuid() from pgcrypto (0001_extensions) is used for audit IDs;
--   app-side UUIDv7 is preferred but pgcrypto v4 is acceptable for audit rows
--   where time-ordering is provided by accessed_at.
-- • health_observations is a REVOKE-API table; SECURITY DEFINER context allows
--   the RPC to SELECT it even though authenticated role has no SELECT grant.
-- • Finding-C correction (no enum change): both RPCs previously assigned the
--   non-enum literals 'self' / 'coach' to v_acting_as, which raised
--   "invalid input value for enum audit_acting_as" at the assignment — before the
--   audit INSERT and before the read — so the self and coach paths hard-failed.
--   Now: self-access is allowed but NOT audited (D1; the audit INSERT is skipped),
--   coach access records the actor's real org role via member_role::audit_acting_as
--   (COALESCE → 'owner_coach'), and admin break-glass records the SUBJECT's org
--   context (D2: subject's active access_grant, else active care_plan). No
--   EXCEPTION handler is added: per spec the in-tx audit must roll the read back on
--   failure (fail-closed), which is the correct posture for a PHI read RPC.
-- =============================================================================
