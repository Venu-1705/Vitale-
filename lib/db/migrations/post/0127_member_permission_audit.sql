-- =============================================================================
-- Vitalé — Post-companion 0127: tg_audit_permission_change
-- Ground truth: VITALE_IMPLEMENTATION_SPEC §4.2 (lines 859-862) +
-- VITALE_DB_ARCHITECTURE §2 (line 64: "organization_member_permissions rows
-- (audited, granted_by)") + §7 core guarantee 5 (line 694: "permission/grant
-- changes audited"). Resolves the TODO carried in 0101 (lines 121-122).
--
-- Delivers tg_audit_permission_change on organization_member_permissions:
--   • AFTER INSERT OR DELETE, FOR EACH ROW, SECURITY DEFINER (spec §4.2).
--   • Writes one immutable coach_data_access_audit row per capability change:
--       INSERT → action='grant'   (capability added to a staff member)
--       DELETE → action='revoke'  (capability removed; the table is insert/delete
--                                  only — no UPDATE path — so these two cover it)
--     resource_type='member_permission', resource_id = the permission row id,
--     accessor_user_id = the actor (auth.uid()), data_subject_user_id = the staff
--     member whose capability changed, acting_as = the actor's real org role.
--
-- WHY THIS WAS DEFERRED (and why it lands now): the target audit table
-- (coach_data_access_audit, new shape) only arrives in 0113, and the enum values
-- needed to express a permission change ('member_permission','grant','revoke')
-- only arrive in 0100 (audit-enum hardening correction). Both now exist, so the
-- trigger the spec required since Phase 2 can finally be implemented faithfully.
--
-- OWNERSHIP: like 0120's audit-writing RPCs and 0126's tg_audit_grant_change,
-- this function is NOT transferred to the low-privilege rls_owner role. It must
-- INSERT into coach_data_access_audit (REVOKE-API, FORCE RLS, no INSERT policy),
-- which rls_owner can neither bypass nor be granted without weakening the model.
-- It therefore stays owned by the BYPASSRLS migration role (the established
-- audit-write pattern). 0119's note about this function is updated accordingly.
--
-- Apply order: after 0113 (audit table) and 0100 (enum values); placed last in
-- the post series. Idempotent: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS.
-- =============================================================================

-- ============================================================================
-- SECTION 1 — tg_audit_permission_change (spec §4.2)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.tg_audit_permission_change()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp AS $$
DECLARE
  v_actor     uuid := auth.uid();
  v_acting_as public.audit_acting_as;
  v_action    public.audit_action;
  v_role      public.member_role;
  v_member_id uuid;
  v_perm_id   uuid;
  v_org_id    uuid;
  v_subject   uuid;  -- the staff member whose capability changed
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_member_id := NEW.member_id;
    v_perm_id   := NEW.id;
    v_action    := 'grant';
  ELSE  -- DELETE
    v_member_id := OLD.member_id;
    v_perm_id   := OLD.id;
    v_action    := 'revoke';
  END IF;

  -- Resolve org + target user from the membership this permission row hangs off.
  SELECT m.organization_id, m.user_id
    INTO v_org_id, v_subject
    FROM public.organization_members m
   WHERE m.id = v_member_id;

  IF v_org_id IS NULL THEN
    -- Membership not found (FK should prevent this) — nothing coherent to audit.
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- acting_as: a platform admin acts as 'admin'; otherwise record the actor's
  -- SPECIFIC org role (owner_coach|nutritionist|community_manager — all valid
  -- audit_acting_as values). Service-role/system changes (auth.uid() NULL)
  -- default to 'owner_coach' (the org's principal management capacity).
  --
  -- SELF-SUFFICIENCY: the admin test is INLINED here (rather than calling the
  -- canonical public.is_admin() helper) on purpose. is_admin() is a SECURITY
  -- DEFINER helper owned by the low-privilege rls_owner role (0119); rls_owner
  -- currently lacks both USAGE on schema auth and read access to public.users
  -- (FORCE RLS), so the helper RAISEs "permission denied" at runtime — which,
  -- inside this trigger, would lose the audit row for every actor-attributed
  -- change. This function already runs as the BYPASSRLS migration role, so the
  -- identical lookup (users row with the 'admin' role, active) is safe inline
  -- and makes the compliance-critical audit independent of the rls_owner
  -- helper-layer defect (reported separately as an architecture decision).
  IF v_actor IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.users u
        WHERE u.id = v_actor AND 'admin' = ANY (u.roles) AND u.status = 'active'
     ) THEN
    v_acting_as := 'admin';
  ELSE
    SELECT m.member_role INTO v_role
      FROM public.organization_members m
     WHERE m.organization_id = v_org_id
       AND m.user_id        = v_actor
       AND m.status         = 'active'
     LIMIT 1;
    v_acting_as := COALESCE(v_role::text::public.audit_acting_as, 'owner_coach');
  END IF;

  -- Immutable audit row. NOTE: coach_data_access_audit has no column for the
  -- specific capability; for grants it is recoverable via resource_id → the
  -- organization_member_permissions row, but for revokes that row is deleted, so
  -- the capability name is not retained. This is inherent to the frozen audit
  -- table shape (no detail/jsonb column) — recorded here for traceability.
  INSERT INTO public.coach_data_access_audit (
    id, accessed_at, organization_id, accessor_user_id, data_subject_user_id,
    acting_as, resource_type, resource_id, action, calendar_day_ist
  )
  VALUES (
    gen_random_uuid(), now(), v_org_id,
    COALESCE(v_actor, v_subject),   -- actor; else target (system path) so NOT NULL holds
    v_subject,
    v_acting_as, 'member_permission', v_perm_id, v_action,
    (now() AT TIME ZONE 'Asia/Kolkata')::date
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Visible-but-non-blocking, matching tg_audit_grant_change: a permission change
  -- must not be blocked by an audit-write failure, but the failure must not be
  -- silent (a blanket swallow is what hid the grant-trigger bugs).
  RAISE WARNING 'tg_audit_permission_change: audit insert failed for permission % (member %): %',
    v_perm_id, v_member_id, SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================================
-- SECTION 2 — wire the trigger (insert/delete only; table has no UPDATE path)
-- ============================================================================
DROP TRIGGER IF EXISTS omp_audit_change ON public.organization_member_permissions;
CREATE TRIGGER omp_audit_change
  AFTER INSERT OR DELETE ON public.organization_member_permissions
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_permission_change();

-- ============================================================================
-- NOTES
-- • Ownership intentionally left with the BYPASSRLS migration role (see header) —
--   do NOT ALTER FUNCTION ... OWNER TO rls_owner here.
-- • The companion records grant (INSERT) and revoke (DELETE); there is no UPDATE
--   path on organization_member_permissions (GRANT is SELECT/INSERT/DELETE only,
--   per 0101), so AFTER INSERT OR DELETE is complete coverage.
-- • Self-escalation is already blocked at the RLS layer (0101 omp_insert/omp_delete
--   policies forbid acting on one's own membership); this trigger is the audit
--   record of every legitimate change.
-- =============================================================================
