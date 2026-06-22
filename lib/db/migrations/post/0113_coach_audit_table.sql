-- =============================================================================
-- Vitalé — Post-companion 0113: coach_data_access_audit (new-shape, partitioned)
-- Ground truth: VITALE_DB_ARCHITECTURE §4 D2 (lines 259-264) + VITALE_IMPLEMENTATION_SPEC
-- Part 2 D2 (lines 251-258).
--
-- coach_data_access_audit [B immutable, PARTITIONED] — who touched what.
--   • PK = (id, accessed_at) — composite; required for all Postgres partition strategies.
--   • RANGE-partitioned monthly on accessed_at. Each partition is auto-hardened (RLS ENABLED +
--     FORCED, REVOKE ALL from anon/authenticated) by the tg_harden_new_partition event trigger
--     defined in 0004. The parent table is also ENABLE/FORCE RLS'd here.
--   • REVOKE-API: no INSERT/SELECT grant to authenticated; written in-transaction by SECURITY
--     DEFINER RPCs (Express server uses direct Postgres connection — bypasses RLS for API writes
--     until Phase 8 RPCs are complete).
--   • Phase 2 tamper-evidence (prev_hash/row_hash + tg_hash_chain) is deferred; columns present
--     as nullable so no future migration is needed to add them.
--   • Indexes are created on the parent → Postgres replicates them to every partition.
--   • Supersedes the OLD provisional coach_data_access_audit shape in the legacy users.ts
--     (removed Phase 8). Column mapping: coachId→accessor_user_id, userId→data_subject_user_id,
--     reportId→resource_id, calendarDay→calendar_day_ist; revoked column dropped (IMMUT-BLOCK).
--
-- Apply order: after the Drizzle migrate step; 0113 before 0114 (access_grants RLS). Idempotent
-- for the parent CREATE (CREATE TABLE IF NOT EXISTS). Partition creation is idempotent via
-- IF NOT EXISTS on each sub-table.
-- =============================================================================

-- ============================================================================
-- SECTION 1 — parent table (PARTITION BY RANGE on accessed_at).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.coach_data_access_audit (
  id                   uuid        NOT NULL,
  accessed_at          timestamptz NOT NULL,
  organization_id      uuid        NOT NULL,
  accessor_user_id     uuid        NOT NULL,  -- the real person performing the access
  data_subject_user_id uuid        NOT NULL,  -- the customer whose data was accessed
  acting_as            public.audit_acting_as    NOT NULL,
  resource_type        public.audit_resource_type NOT NULL,
  resource_id          uuid,                  -- nullable: some actions target the whole profile
  action               public.audit_action    NOT NULL,
  calendar_day_ist     date        NOT NULL,  -- set by tg_set_calendar_day_ist (0004)
  prev_hash            text,                  -- Phase 2 tamper-evidence; NULL until tg_hash_chain lands
  row_hash             text,                  -- Phase 2 tamper-evidence; NULL until tg_hash_chain lands
  PRIMARY KEY (id, accessed_at)
) PARTITION BY RANGE (accessed_at);

-- ============================================================================
-- SECTION 2 — RLS on the parent (per-partition RLS handled by tg_harden_new_partition, 0004).
-- ============================================================================
ALTER TABLE public.coach_data_access_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_data_access_audit FORCE  ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 3 — triggers on the parent (fire for all partitions in PG14+).
-- ============================================================================
-- IMMUT-BLOCK: append-only audit log. UPDATE/DELETE denied to all roles.
DROP TRIGGER IF EXISTS coach_audit_immutable ON public.coach_data_access_audit;
CREATE TRIGGER coach_audit_immutable BEFORE UPDATE OR DELETE ON public.coach_data_access_audit
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_update_delete();

-- IST calendar-day setter: set calendar_day_ist from accessed_at in Asia/Kolkata.
DROP TRIGGER IF EXISTS coach_audit_set_calendar_day ON public.coach_data_access_audit;
CREATE TRIGGER coach_audit_set_calendar_day BEFORE INSERT ON public.coach_data_access_audit
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_calendar_day_ist();

-- ============================================================================
-- SECTION 4 — parent-level privileges (REVOKE-API: no SELECT/INSERT to authenticated).
--   The Express API server uses a direct Postgres connection (BYPASSRLS), so it can INSERT
--   audit rows without a grant. Phase 8 SECURITY DEFINER RPCs will be the audited read path.
-- ============================================================================
REVOKE ALL ON public.coach_data_access_audit FROM anon, authenticated;

-- ============================================================================
-- SECTION 5 — parent-level RLS policies.
--   SELECT = the data subject reads their own audit trail, admins may read all.
--   No INSERT policy for authenticated (REVOKE-API; written by server-side RPCs only).
-- ============================================================================
DROP POLICY IF EXISTS coach_audit_select ON public.coach_data_access_audit;
CREATE POLICY coach_audit_select ON public.coach_data_access_audit FOR SELECT TO authenticated
  USING (data_subject_user_id = auth.uid() OR public.is_admin());

-- ============================================================================
-- SECTION 6 — partition-local indexes (Postgres replicates to every partition).
--   These cover the two access patterns: subject-timeline and org-timeline.
-- ============================================================================
CREATE INDEX IF NOT EXISTS coach_audit_subject_at_idx
  ON public.coach_data_access_audit (data_subject_user_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS coach_audit_org_at_idx
  ON public.coach_data_access_audit (organization_id, accessed_at DESC);

-- ============================================================================
-- SECTION 7 — initial monthly partitions (2025 + 2026 + 2027 + default overflow).
--   tg_harden_new_partition (0004) fires on each CREATE TABLE here and applies per-partition
--   RLS ENABLE+FORCE + REVOKE ALL from anon/authenticated automatically.
-- ============================================================================

-- 2025 (single annual catch-up partition)
CREATE TABLE IF NOT EXISTS public.coach_data_access_audit_2025
  PARTITION OF public.coach_data_access_audit
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

-- 2026 monthly partitions (likely launch year)
CREATE TABLE IF NOT EXISTS public.coach_data_access_audit_2026_01
  PARTITION OF public.coach_data_access_audit FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE IF NOT EXISTS public.coach_data_access_audit_2026_02
  PARTITION OF public.coach_data_access_audit FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE IF NOT EXISTS public.coach_data_access_audit_2026_03
  PARTITION OF public.coach_data_access_audit FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE IF NOT EXISTS public.coach_data_access_audit_2026_04
  PARTITION OF public.coach_data_access_audit FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS public.coach_data_access_audit_2026_05
  PARTITION OF public.coach_data_access_audit FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS public.coach_data_access_audit_2026_06
  PARTITION OF public.coach_data_access_audit FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS public.coach_data_access_audit_2026_07
  PARTITION OF public.coach_data_access_audit FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS public.coach_data_access_audit_2026_08
  PARTITION OF public.coach_data_access_audit FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS public.coach_data_access_audit_2026_09
  PARTITION OF public.coach_data_access_audit FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS public.coach_data_access_audit_2026_10
  PARTITION OF public.coach_data_access_audit FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS public.coach_data_access_audit_2026_11
  PARTITION OF public.coach_data_access_audit FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS public.coach_data_access_audit_2026_12
  PARTITION OF public.coach_data_access_audit FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- 2027 (annual partition; add monthly when approaching launch)
CREATE TABLE IF NOT EXISTS public.coach_data_access_audit_2027
  PARTITION OF public.coach_data_access_audit FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');

-- Default partition for any dates outside the above ranges
CREATE TABLE IF NOT EXISTS public.coach_data_access_audit_default
  PARTITION OF public.coach_data_access_audit DEFAULT;

-- ============================================================================
-- NOTES
-- • Phase 2 (tg_hash_chain): when the hash-chain trigger lands, prev_hash/row_hash will be
--   populated on every INSERT. Until then they remain NULL and the columns are no-ops.
-- • Partition auto-add: a pg_cron job (Phase 10) will CREATE next-month partitions before the
--   current month rolls over; tg_harden_new_partition handles the per-partition hardening.
-- • Retention: ≥ 5–7 yr per policy §9. Row-level deletion is blocked (IMMUT-BLOCK); old
--   partitions are detached + archived at the infrastructure level, never purged in-DB.
-- =============================================================================
