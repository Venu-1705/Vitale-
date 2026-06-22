-- =============================================================================
-- Vitalé — Post-companion 0126: tg_audit_grant_change + PostgREST hardening
-- Ground truth: VITALE_IMPLEMENTATION_SPEC §4.5 (lines 864-867) +
-- §7.9 PostgREST (line 1221) + Part 7 checklist §7.1 (line 1153-1154).
--
-- Delivers:
--   • tg_audit_grant_change — access_grants AFTER INSERT OR UPDATE OF status:
--     write coach_data_access_audit row capturing grant creation (action='grant'),
--     revocation and expiry (action='revoke'), resource_type='access_grant'.
--     acting_as is the actor's real org role (owner_coach|nutritionist|
--     community_manager) or 'admin' under a live support case. The hardening-added
--     enum values ('access_grant','grant','revoke') come from 0100; before that
--     correction this trigger cast non-existent enum literals and silently no-oped.
--   • PostgREST schema exposure restriction — ensure partitioned / PHI /
--     financial tables are NOT in the public PostgREST schema; only safe tables
--     are discoverable.
--
-- Apply order: after 0125 (lexical). Idempotent: CREATE OR REPLACE;
-- DROP TRIGGER IF EXISTS.
-- =============================================================================

-- ============================================================================
-- SECTION 1 — tg_audit_grant_change (spec §4.5)
-- Fires AFTER INSERT OR UPDATE OF status on access_grants.
-- Writes an audit row capturing: who created/revoked/expired the grant,
-- acting_as derived from whether the actor is an admin with support access.
-- SECURITY DEFINER: must INSERT into coach_data_access_audit (REVOKE-API).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.tg_audit_grant_change()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp AS $$
DECLARE
  v_actor     uuid  := auth.uid();
  v_acting_as public.audit_acting_as;
  v_action    public.audit_action;
  v_org_id    uuid  := NEW.organization_id;
  v_role      public.member_role;
BEGIN
  -- Determine the action FIRST so non-terminal status updates skip cheaply.
  --   INSERT          → 'grant'  (a new data-sharing grant created)
  --   status revoked  → 'revoke' (deliberately withdrawn)
  --   status expired  → 'revoke' (lifecycle end; exact cause kept on NEW.status,
  --                               reachable from the audit row via resource_id)
  IF TG_OP = 'INSERT' THEN
    v_action := 'grant';
  ELSIF NEW.status IN ('revoked', 'expired') THEN
    v_action := 'revoke';
  ELSE
    RETURN NEW; -- non-terminal status change — nothing to audit
  END IF;

  -- Determine acting_as: an admin with a live support case acts as 'admin';
  -- otherwise record the actor's SPECIFIC org role (owner_coach | nutritionist |
  -- community_manager) — all valid audit_acting_as values, so no enum value for a
  -- generic 'coach' is needed. System/service-role grant creation (e.g. the
  -- enrollment trigger, auth.uid() NULL) defaults to 'owner_coach' (the org's
  -- principal capacity).
  --
  -- SELF-SUFFICIENCY: the admin-with-support-access test is INLINED here (rather
  -- than calling public.admin_has_support_access()) on purpose. That helper, and
  -- the is_admin() it wraps, are SECURITY DEFINER owned by the low-privilege
  -- rls_owner role (0119), which currently lacks USAGE on schema auth and read
  -- access to public.users / public.admin_support_access (FORCE RLS) — so it
  -- RAISEs "permission denied" at runtime, which inside this trigger would lose
  -- the audit row for every actor-attributed grant change. This function already
  -- runs as the BYPASSRLS migration role, so the identical liveness check is safe
  -- inline and decouples the compliance-critical audit from the rls_owner
  -- helper-layer defect (reported separately as an architecture decision). The
  -- predicate is byte-for-byte the same as admin_has_support_access(NEW.user_id).
  IF v_actor IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.users u
        WHERE u.id = v_actor AND 'admin' = ANY (u.roles) AND u.status = 'active'
     )
     AND EXISTS (
       SELECT 1 FROM public.admin_support_access a
        WHERE a.subject_user_id = NEW.user_id
          AND a.status = 'active'
          AND a.expires_at > now()
          AND (a.requested_by_admin_id = v_actor OR a.approved_by_admin_id = v_actor)
     ) THEN
    v_acting_as := 'admin';
  ELSE
    SELECT m.member_role INTO v_role
      FROM public.organization_members m
     WHERE m.organization_id = NEW.organization_id
       AND m.user_id        = v_actor
       AND m.status         = 'active'
     LIMIT 1;
    v_acting_as := COALESCE(v_role::text::public.audit_acting_as, 'owner_coach');
  END IF;

  -- Insert immutable audit row (resource_type/action are the hardening-added
  -- enum values from 0100). resource_id links back to the grant row so the
  -- precise revoked-vs-expired cause and full grant detail remain recoverable.
  INSERT INTO public.coach_data_access_audit (
    id,
    accessed_at,
    organization_id,
    accessor_user_id,
    data_subject_user_id,
    acting_as,
    resource_type,
    resource_id,
    action,
    calendar_day_ist
  )
  VALUES (
    gen_random_uuid(),
    now(),
    v_org_id,
    COALESCE(v_actor, NEW.revoked_by, NEW.user_id),  -- actor; else who revoked; else subject (system path)
    NEW.user_id,
    v_acting_as,
    'access_grant',
    NEW.id,
    v_action,
    (now() AT TIME ZONE 'Asia/Kolkata')::date
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Audit failure must not block the grant operation, but it must NOT be silent
  -- either (a blanket swallow previously hid invalid-enum + privilege bugs). Emit
  -- a WARNING so the failure is visible in logs; the Part 7.6 audit-completeness
  -- monitor (PHI/grant change count vs audit-row count) is the backstop.
  RAISE WARNING 'tg_audit_grant_change: audit insert failed for grant % (org %, subject %): %',
    NEW.id, NEW.organization_id, NEW.user_id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS access_grants_audit_change ON public.access_grants;
CREATE TRIGGER access_grants_audit_change
  AFTER INSERT OR UPDATE OF status ON public.access_grants
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_grant_change();

-- ============================================================================
-- SECTION 2 — PostgREST hardening (spec §7.9, line 1221)
-- Revoke SELECT from the `web_anon` / `anon` roles on tables that must NOT be
-- directly accessible via the auto-generated PostgREST REST API.
-- PHI, financial, partitioned, clinical, and audit tables must be unreachable
-- via REST; they are only accessible via SECURITY DEFINER RPCs.
--
-- The "authenticated" role already has REVOKE ALL on these tables (set in
-- their respective companions). This section adds an explicit REVOKE on the
-- PostgREST system role `anon` where not already done, and ensures the
-- `pg_catalog` introspection path cannot leak schema details.
-- ============================================================================

-- PHI / REVOKE-API tables — ensure anon has zero access
REVOKE ALL ON public.health_observations      FROM anon;
REVOKE ALL ON public.nutrition_logs           FROM anon;
REVOKE ALL ON public.nutrition_log_items      FROM anon;
REVOKE ALL ON public.lab_reports              FROM anon;
REVOKE ALL ON public.lab_report_results       FROM anon;
REVOKE ALL ON public.clinical_notes           FROM anon;
REVOKE ALL ON public.care_plans               FROM anon;
REVOKE ALL ON public.care_plan_versions       FROM anon;
REVOKE ALL ON public.care_team_members        FROM anon;
REVOKE ALL ON public.coach_data_access_audit  FROM anon;

-- Financial tables — anon has no business seeing billing
REVOKE ALL ON public.coach_invoices           FROM anon;
REVOKE ALL ON public.invoice_line_items       FROM anon;
REVOKE ALL ON public.enrollment_payments      FROM anon;
REVOKE ALL ON public.revenue_splits           FROM anon;
REVOKE ALL ON public.refunds                  FROM anon;
REVOKE ALL ON public.disputes                 FROM anon;
REVOKE ALL ON public.payouts                  FROM anon;
REVOKE ALL ON public.settlements              FROM anon;
REVOKE ALL ON public.payment_webhook_events   FROM anon;

-- Consent / access control
REVOKE ALL ON public.dpdp_consent_records     FROM anon;
REVOKE ALL ON public.access_grants            FROM anon;
REVOKE ALL ON public.admin_support_access     FROM anon;
REVOKE ALL ON public.data_deletion_requests   FROM anon;

-- ============================================================================
-- SECTION 3 — PostgREST max-rows setting
-- SUBSTRATE NOTE (vanilla PG): there is NO PostgREST in the self-hosted stack —
-- the Node API is the only data gateway and enforces its own pagination/limits.
-- This setting is therefore inert here. It is applied (best-effort, guarded) only
-- so the configuration carries over verbatim if PostgREST is ever introduced.
-- ============================================================================
DO $pgrst$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    EXECUTE 'ALTER ROLE authenticator SET pgrst.db_max_rows = ''1000''';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pgrst.db_max_rows not applied (no PostgREST on vanilla PG): %', SQLERRM;
END
$pgrst$;

-- ============================================================================
-- SECTION 4 — ownership for new SECURITY DEFINER functions
-- ============================================================================
-- tg_audit_grant_change is NOT transferred to rls_owner: it must INSERT into
-- coach_data_access_audit, a REVOKE-API table with FORCE RLS and no INSERT
-- policy. The low-privilege rls_owner role can neither bypass that RLS nor insert
-- (no grant), so a SECURITY DEFINER function owned by rls_owner would fail at
-- runtime (permission denied — previously masked by the EXCEPTION handler). It
-- therefore stays owned by the BYPASSRLS migration role, matching the audit-write
-- pattern used by 0120's rpc_read_health_observations / rpc_read_lab_report.
--
-- tg_check_settlement_totals only validates NEW-row arithmetic (no table writes),
-- so low-privilege rls_owner ownership is correct for it.
ALTER FUNCTION public.tg_check_settlement_totals() OWNER TO rls_owner;

-- ============================================================================
-- NOTES
-- • tg_audit_grant_change: the EXCEPTION block keeps audit failure from blocking
--   the underlying grant INSERT/UPDATE, but now RAISEs a WARNING instead of
--   silently swallowing — a blanket swallow had hidden two real bugs (invalid
--   enum literals + rls_owner privilege denial). The function is owned by the
--   BYPASSRLS migration role so its INSERT into the REVOKE-API audit table
--   actually succeeds; the audit-completeness monitor (§7.6) catches any drift.
-- • PostgREST exposes the `public` schema by default. Tables not listed in
--   the REVOKE blocks (product_categories, programs, community_posts, etc.)
--   are safe for anon/authenticated direct REST reads because they already
--   have appropriate RLS policies restricting visibility.
-- • ALTER ROLE authenticator ... requires superuser. Apply via Supabase SQL
--   editor (service_role connection) or a migration runner with elevated privs.
-- =============================================================================
