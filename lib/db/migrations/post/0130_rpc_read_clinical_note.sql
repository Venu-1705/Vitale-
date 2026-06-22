-- =============================================================================
-- Vitalé — Post-companion 0130: rpc_read_clinical_note (D14 audited read path)
-- Ground truth: VITALE_DB_ARCHITECTURE §4 D14 + VITALE_IMPLEMENTATION_SPEC Part 2 D14
-- (line 568, "reads through audited RPC") and §4.2 ("Health-read auditing is NOT a table
-- trigger … performed in-transaction inside each read RPC: rpc_read_health_observations,
-- rpc_read_lab_report, rpc_read_clinical_note").
--
-- clinical_notes is REVOKE-API: authenticated holds INSERT only, NO SELECT grant (0111). The
-- raw client therefore cannot read notes directly. This RPC is the single audited read path:
-- it re-enforces the clinical_notes_select predicate, writes ONE coach_data_access_audit row
-- in the same transaction (so the audit cannot be skipped and rolls back if the read fails),
-- and returns the matching rows. It is the clinical sibling of rpc_read_health_observations
-- (0120) and follows that file's gate/audit/return shape exactly.
--
-- Access model (mirrors the clinical_notes_select RLS policy, 0111):
--   • SELF: the subject reads their OWN notes, but only those with visibility='shared_with_user'.
--     A subject reading their own shared notes is not coach/admin data access → NOT audited (D1,
--     matching the self-path in rpc_read_health_observations).
--   • COACH: an ACTIVE member of the note's org holding write_clinical_notes AND an active
--     'clinical' access_grant on the subject. Audited (acting_as = the member's real org role).
--   • No ambient admin clause (DPDP: admins have no ambient clinical access; break-glass would be
--     a separate admin_support_access path, intentionally excluded here as in the RLS policy).
--
-- SECURITY DEFINER + owned by the BYPASSRLS migration role (default owner `v`, same as 0120's
-- RPCs): the definer context both SELECTs the REVOKE-API clinical_notes and INSERTs the
-- FORCE-RLS coach_data_access_audit (which has no INSERT policy for authenticated). The gate is
-- enforced on auth.uid() inside the body, so EXECUTE may be granted to authenticated.
--
-- Idempotent: CREATE OR REPLACE; grants are re-runnable. Apply order: after 0111 (clinical RLS)
-- and 0113 (audit table). No forward references.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_read_clinical_note(
  p_subject_user_id uuid,
  p_care_plan_id    uuid DEFAULT NULL,
  p_note_id         uuid DEFAULT NULL
)
RETURNS TABLE (
  id                 uuid,
  organization_id    uuid,
  author_member_id   uuid,
  author_role_at_time text,
  subject_user_id    uuid,
  care_plan_id       uuid,
  note_type          text,
  parent_note_id     uuid,
  body               text,
  visibility         text,
  created_at         timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_caller    uuid := auth.uid();
  v_is_self   boolean := (auth.uid() = p_subject_user_id);
  v_org_id    uuid;
  v_role      public.member_role;
  v_acting_as public.audit_acting_as;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'rpc_read_clinical_note: no caller identity' USING ERRCODE = '42501';
  END IF;

  -- ---- SELF path: subject reads own shared notes only; not audited (D1). -------------------
  IF v_is_self THEN
    RETURN QUERY
    SELECT cn.id, cn.organization_id, cn.author_member_id, cn.author_role_at_time::text,
           cn.subject_user_id, cn.care_plan_id, cn.note_type::text, cn.parent_note_id,
           cn.body, cn.visibility::text, cn.created_at
      FROM public.clinical_notes cn
     WHERE cn.subject_user_id = p_subject_user_id
       AND cn.visibility = 'shared_with_user'
       AND (p_care_plan_id IS NULL OR cn.care_plan_id = p_care_plan_id)
       AND (p_note_id IS NULL OR cn.id = p_note_id)
     ORDER BY cn.created_at DESC;
    RETURN;
  END IF;

  -- ---- COACH path: resolve the caller's org that satisfies the full read predicate. --------
  -- is_org_member re-checks the active-membership + write_clinical_notes capability on
  -- auth.uid(); org_has_active_grant checks the active 'clinical' grant. We enumerate the
  -- caller's active memberships and pick the first that satisfies both — that org is the only
  -- org whose notes for this subject the caller may read (clinical_notes_select binds the note's
  -- organization_id to the reader's org).
  SELECT m.organization_id, m.member_role
    INTO v_org_id, v_role
    FROM public.organization_members m
   WHERE m.user_id = v_caller
     AND m.status = 'active'
     AND public.is_org_member(m.organization_id, 'write_clinical_notes')
     AND public.org_has_active_grant(m.organization_id, p_subject_user_id, 'clinical')
   ORDER BY m.created_at
   LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'rpc_read_clinical_note: access denied for caller % on subject %',
      v_caller, p_subject_user_id USING ERRCODE = '42501';
  END IF;

  v_acting_as := COALESCE(v_role::text::public.audit_acting_as, 'owner_coach');

  -- In-transaction audit row (immutable; rolls back with the read on failure). One row per call;
  -- resource_id binds to the most specific target the caller named (note, else plan, else NULL
  -- → the whole subject profile within this org).
  INSERT INTO public.coach_data_access_audit
    (id, accessed_at, organization_id, accessor_user_id, data_subject_user_id,
     acting_as, resource_type, resource_id, action, calendar_day_ist)
  VALUES
    (gen_random_uuid(), now(), v_org_id, v_caller, p_subject_user_id,
     v_acting_as, 'clinical_note', COALESCE(p_note_id, p_care_plan_id), 'view',
     (now() AT TIME ZONE 'Asia/Kolkata')::date);

  RETURN QUERY
  SELECT cn.id, cn.organization_id, cn.author_member_id, cn.author_role_at_time::text,
         cn.subject_user_id, cn.care_plan_id, cn.note_type::text, cn.parent_note_id,
         cn.body, cn.visibility::text, cn.created_at
    FROM public.clinical_notes cn
   WHERE cn.subject_user_id = p_subject_user_id
     AND cn.organization_id = v_org_id
     AND (p_care_plan_id IS NULL OR cn.care_plan_id = p_care_plan_id)
     AND (p_note_id IS NULL OR cn.id = p_note_id)
   ORDER BY cn.created_at DESC;
END;
$$;

-- Gate is enforced on auth.uid() inside the body → safe to grant to authenticated.
REVOKE ALL ON FUNCTION public.rpc_read_clinical_note(uuid, uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rpc_read_clinical_note(uuid, uuid, uuid) TO authenticated;
