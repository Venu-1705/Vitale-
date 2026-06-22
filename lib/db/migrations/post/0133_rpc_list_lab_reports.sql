-- =============================================================================
-- Vitalé — Post-companion 0133: rpc_list_lab_reports (D11 audited list path)
-- Ground truth: VITALE_DB_ARCHITECTURE §4 D11 + VITALE_IMPLEMENTATION_SPEC §492
-- (lab_reports is REVOKE-API; SELECT = owner OR can_read_health OR admin_has_support_access,
-- reached via an audited RPC) and §43/§870 (audited health-RPC fan-out).
--
-- Why this RPC exists:
--   lab_reports is REVOKE-API (no SELECT grant to authenticated — 0122). rpc_read_lab_report
--   (0120) returns ONE report + its result rows given a report_id, but there is no way for a
--   caller to discover their report_ids in the first place (a raw SELECT on lab_reports is denied).
--   This is the LIST sibling of rpc_read_lab_report: it returns report HEADERS only (no PHI result
--   values) for a subject, under the SAME gate, so a subject can enumerate their own reports and a
--   coach/admin can enumerate a client's. Result VALUES are still only obtainable through
--   rpc_read_lab_report (per-report, audited). This keeps lab_reports fully REVOKE-API.
--
-- Gate (identical shape to rpc_read_lab_report; audit vocabulary frozen — no 'self'/'coach'):
--   • SELF (p_subject = auth.uid()): own report headers. A subject listing their own reports is
--     NOT coach/admin access → NOT audited (D1; mirrors the self path of the read RPCs).
--   • COACH (can_read_health(p_subject)): records the actor's real org role; ONE audit row.
--   • ADMIN (admin_has_support_access(p_subject)): break-glass; records the SUBJECT's org context;
--     ONE audit row.
--   • else: 42501 → rls_denied → 403.
-- The audit row for a list has resource_id = NULL (the access is the subject's report inventory,
-- not a single report); coach_data_access_audit.resource_id is nullable (see rpc_read_clinical_note).
--
-- SECURITY DEFINER + owned by the BYPASSRLS migration role (default `v`): the definer context reads
-- the REVOKE-API lab_reports and INSERTs the FORCE-RLS coach_data_access_audit (no INSERT policy for
-- authenticated). Gate enforced on auth.uid() inside the body → EXECUTE may be granted to authenticated.
--
-- Idempotent: CREATE OR REPLACE; grants re-runnable. Apply order: after 0120 (read RPC) + 0122 (RLS).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_list_lab_reports(
  p_subject_user_id uuid
)
RETURNS TABLE (
  id                  uuid,
  booking_id          uuid,
  user_id             uuid,
  title               text,
  report_date         timestamptz,
  status              text,
  abnormal_count      int,
  package_name        text,
  thyrocare_report_id text,
  created_at          timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_caller    uuid := auth.uid();
  v_acting_as public.audit_acting_as;
  v_org_id    uuid;
  v_role      public.member_role;
  v_is_self   boolean := (auth.uid() = p_subject_user_id);
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'rpc_list_lab_reports: no caller identity' USING ERRCODE = '42501';
  END IF;

  -- ---- Gate (mirrors rpc_read_lab_report). ------------------------------------------------
  IF v_is_self THEN
    NULL;  -- self list: permitted, not audited (D1).
  ELSIF public.can_read_health(p_subject_user_id) THEN
    SELECT m.organization_id, m.member_role INTO v_org_id, v_role
      FROM public.organization_members m
      JOIN public.access_grants g
        ON g.organization_id = m.organization_id
       AND g.user_id = p_subject_user_id
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
  ELSIF public.admin_has_support_access(p_subject_user_id) THEN
    v_acting_as := 'admin';
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
    RAISE EXCEPTION 'rpc_list_lab_reports: access denied for caller % on subject %',
      v_caller, p_subject_user_id USING ERRCODE = '42501';
  END IF;

  -- ---- In-tx audit for coach/admin list (skipped for self; rolls back if the read fails). --
  IF NOT v_is_self THEN
    INSERT INTO public.coach_data_access_audit
      (id, accessed_at, organization_id, accessor_user_id, data_subject_user_id,
       acting_as, resource_type, resource_id, action, calendar_day_ist)
    VALUES
      (gen_random_uuid(), now(), v_org_id, v_caller, p_subject_user_id,
       v_acting_as, 'lab_report', NULL, 'view',
       (now() AT TIME ZONE 'Asia/Kolkata')::date);
  END IF;

  -- ---- Return report HEADERS only (no PHI result values). ----------------------------------
  RETURN QUERY
  SELECT lr.id, lr.booking_id, lr.user_id, lr.title, lr.report_date, lr.status,
         lr.abnormal_count, lr.package_name, lr.thyrocare_report_id, lr.created_at
    FROM public.lab_reports lr
   WHERE lr.user_id = p_subject_user_id
   ORDER BY lr.report_date DESC;
END;
$$;

-- Gate is enforced on auth.uid() inside the body → safe to grant to authenticated.
REVOKE ALL ON FUNCTION public.rpc_list_lab_reports(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rpc_list_lab_reports(uuid) TO authenticated;
