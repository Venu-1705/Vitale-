-- =============================================================================
-- Vitalé — Post-companion 0131: D5 health_observations — partitions + RLS policies + grants
-- Ground truth: the DEFERRED block at the foot of 0104_health_observations.sql (the four ho_*
-- policies recorded verbatim there for "the Phase-8 author to drop in once the dependencies
-- exist") + VITALE_IMPLEMENTATION_SPEC Part 2 D5 / §3.3 / §4.3.
--
-- This is the cohesive Phase-8 unit 0104 promised: the access-core dependencies it waited on
-- (access_grants, care_plans, care_team_members, admin_support_access, coach_data_access_audit,
-- can_read_health, org_has_active_grant, has_capability) all now exist. It:
--   1. Creates the monthly partitions (this local cluster has NO pg_partman, so 0104's
--      provision_partition_parent() is a no-op-that-isn't — partitions are created explicitly,
--      exactly as 0113 does for coach_data_access_audit). Each CREATE TABLE … PARTITION OF fires
--      the vitale_harden_new_partition event trigger (0004) → per-partition RLS ENABLE+FORCE +
--      REVOKE ALL from anon/authenticated, so children inherit the parent's lockdown.
--   2. Installs the four spec policies verbatim from 0104's footer.
--   3. Grants INSERT + UPDATE to authenticated (the write paths the ho_insert_*/ho_update_owner
--      policies gate). SELECT stays REVOKED (0104): health_observations is REVOKE-API — the only
--      read path is the audited rpc_read_health_observations (0120). ho_select is therefore a
--      defense-in-depth / documentary policy (unreachable by a raw client lacking SELECT), the
--      same posture clinical_notes_select holds in 0111.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS; DROP POLICY IF EXISTS before each CREATE; grants are
-- re-runnable. Apply order: after 0104 (parent table) and after the access-core companions.
-- =============================================================================

-- ============================================================================
-- SECTION 1 — partitions (explicit; auto-hardened by vitale_harden_new_partition).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.health_observations_2025
  PARTITION OF public.health_observations FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE IF NOT EXISTS public.health_observations_2026_01
  PARTITION OF public.health_observations FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE IF NOT EXISTS public.health_observations_2026_02
  PARTITION OF public.health_observations FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE IF NOT EXISTS public.health_observations_2026_03
  PARTITION OF public.health_observations FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE IF NOT EXISTS public.health_observations_2026_04
  PARTITION OF public.health_observations FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS public.health_observations_2026_05
  PARTITION OF public.health_observations FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS public.health_observations_2026_06
  PARTITION OF public.health_observations FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS public.health_observations_2026_07
  PARTITION OF public.health_observations FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS public.health_observations_2026_08
  PARTITION OF public.health_observations FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS public.health_observations_2026_09
  PARTITION OF public.health_observations FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS public.health_observations_2026_10
  PARTITION OF public.health_observations FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS public.health_observations_2026_11
  PARTITION OF public.health_observations FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS public.health_observations_2026_12
  PARTITION OF public.health_observations FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE IF NOT EXISTS public.health_observations_2027
  PARTITION OF public.health_observations FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');
-- Overflow: any measured_date_ist outside the explicit ranges still lands (and stays hardened).
CREATE TABLE IF NOT EXISTS public.health_observations_default
  PARTITION OF public.health_observations DEFAULT;

-- ============================================================================
-- SECTION 2 — policies (verbatim from 0104 footer). REVOKE-API: SELECT not granted → ho_select
-- is documentary/defense; reads go through rpc_read_health_observations (audited).
-- ============================================================================
DROP POLICY IF EXISTS ho_select ON public.health_observations;
CREATE POLICY ho_select ON public.health_observations FOR SELECT TO authenticated
  USING ( subject_user_id = auth.uid()
          OR (SELECT public.can_read_health(subject_user_id))
          OR (SELECT public.admin_has_support_access(subject_user_id)) );

DROP POLICY IF EXISTS ho_insert_self ON public.health_observations;
CREATE POLICY ho_insert_self ON public.health_observations FOR INSERT TO authenticated
  WITH CHECK ( subject_user_id = auth.uid() );

DROP POLICY IF EXISTS ho_insert_coach ON public.health_observations;
CREATE POLICY ho_insert_coach ON public.health_observations FOR INSERT TO authenticated
  WITH CHECK ( source = 'coach_entered'
               AND recorded_by_user_id = auth.uid()
               AND EXISTS ( SELECT 1 FROM public.organization_members m
                            WHERE m.user_id = auth.uid() AND m.status='active'
                              AND public.org_has_active_grant(m.organization_id,
                                    subject_user_id, 'health_data')
                              AND public.has_capability(m.id, 'view_client_health') ) );

DROP POLICY IF EXISTS ho_update_owner ON public.health_observations;
CREATE POLICY ho_update_owner ON public.health_observations FOR UPDATE TO authenticated
  USING ( subject_user_id = auth.uid() ) WITH CHECK ( subject_user_id = auth.uid() );
-- no DELETE policy ⇒ delete denied for authenticated.

-- ============================================================================
-- SECTION 3 — write grants (the paths ho_insert_*/ho_update_owner gate). SELECT stays revoked.
-- ============================================================================
GRANT INSERT, UPDATE ON public.health_observations TO authenticated;
