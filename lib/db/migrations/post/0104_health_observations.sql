-- =============================================================================
-- Vitalé — Post-table migration 0104: D5 health_observations — partitioned parent, lockdown,
-- IST partition-key trigger, pg_partman provisioning (Phase 3). Implements
-- VITALE_DB_ARCHITECTURE §4 D5 (lines 357-363) + §6 (partitioning; lines 617-633 illustrative
-- DDL) + VITALE_IMPLEMENTATION_SPEC Part 2 D5 (health_observations line 347-348) + Part 4 §4.3
-- (IST setters, partition hardening) + Part 6 Phase 3 (line 1108).
--
-- WHY RAW SQL (not a Drizzle pgTable): Drizzle's pgTable cannot express PARTITION BY RANGE
-- (arch §6 line 613), and the PK is the composite (id, measured_date_ist). The logical table
-- is modelled for the app via the read RPC, not a Drizzle select. metric_definitions (its FK
-- target) is Drizzle-owned and created in the generate/migrate step — so this parent must be
-- created AFTER that step (hence a POST companion), and after 0103 wired metric_definitions.
--
-- ORDERING: POST-TABLE companion. Apply order:
--   1. `pnpm db:raw`        → foundation 0001–0006: 0004 tg_set_measured_date_ist +
--      vitale_harden_new_partition event trigger (already lists 'health_observations');
--      0006 provision_partition_parent() (pg_partman registration + hardened template)
--   2. `pnpm generate && pnpm migrate` → Drizzle creates users + metric_definitions (FK targets)
--   3. `pnpm db:raw:post`   → 0103 (metric_definitions RLS) → THIS file
--
-- LOCKDOWN MODEL ("the most sensitive table", spec §3.3): REVOKE ALL FROM anon, authenticated
-- + FORCE RLS. With NO policies yet, this is deny-all to PostgREST roles — the SAME interim
-- posture as document_number_sequences/job_runs in 0006 ("No policies = deny-all"). Only
-- service-role (RLS-bypass) or the future SECURITY-DEFINER rls_owner RPCs can reach it. No
-- PostgREST path to health_observations exists (spec line 124).
--
-- DEFERRED to Phase 8 (cohesive RLS-policy + read-RPC unit — every clause depends on a table
-- that lands with the access-core / labs refactor): the four spec policies and the audited
-- read RPC. Their exact target SQL is recorded verbatim at the foot of this file so the
-- Phase-8 author drops it in once the dependencies exist:
--   • ho_select        → can_read_health(subject)  [access_grants, care_plans, care_team_members]
--                        + admin_has_support_access(subject)  [admin_support_access]
--   • ho_insert_coach  → org_has_active_grant(...)  [access_grants]
--   • rpc_read_health_observations → in-tx audit INSERT into coach_data_access_audit (new shape)
--   (ho_insert_self / ho_update_owner are self-contained but are held back too, so the policy
--    set + RPC land together as one reviewable unit and the table stays cleanly deny-all here.)
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS; DROP TRIGGER IF EXISTS; provisioning helper
-- is a no-op if already registered.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Partitioned parent. Columns per arch §4 D5 (lines 357-363). One scalar observation per row;
-- exactly one of the three value columns is populated (value_type lives on the metric, so the
-- match-to-value_type is enforced by the write RPC/app; the row-local CHECK enforces "exactly
-- one"). Lab analytes normalize in here with source='lab'; reading_group_id ties compound
-- readings (e.g. BP systolic + diastolic) together.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.health_observations (
  id                    uuid        NOT NULL,
  measured_date_ist     date        NOT NULL,   -- partition key; set by trigger from measured_at (IST)
  subject_user_id       uuid        NOT NULL REFERENCES public.users(id),
  metric_definition_id  uuid        NOT NULL REFERENCES public.metric_definitions(id),
  value_numeric         numeric,                -- numeric/integer metrics
  value_bool            boolean,                -- boolean metrics
  value_text            text,                   -- enum/coded metrics
  unit                  text,                   -- e.g. 'mmHg','kg' (metadata, not a value)
  reading_group_id      uuid,                   -- groups compound readings (BP systolic+diastolic share one id)
  measured_at           timestamptz NOT NULL,   -- the instant of measurement (source of measured_date_ist)
  source                public.health_obs_source NOT NULL DEFAULT 'manual',
  source_device_id      text,                   -- wearable/source provenance (arch §4 D5)
  source_external_id    text,                   -- external system id (dedupe wearable/lab imports)
  recorded_by_user_id   uuid        REFERENCES public.users(id),  -- coach for source='coach_entered'; NULL for self
  created_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, measured_date_ist),
  CONSTRAINT health_observations_one_value
    CHECK (num_nonnulls(value_numeric, value_bool, value_text) = 1)
) PARTITION BY RANGE (measured_date_ist);

-- ----------------------------------------------------------------------------
-- Lockdown FIRST (before provisioning creates partitions): FORCE RLS + REVOKE so the parent —
-- and, via the hardened pg_partman template + the vitale_harden_new_partition event trigger,
-- every child partition — is born unreachable from PostgREST. No policies = deny-all interim.
-- ----------------------------------------------------------------------------
ALTER TABLE public.health_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_observations FORCE  ROW LEVEL SECURITY;
REVOKE ALL ON public.health_observations FROM anon, authenticated;  -- RPC-only (no PostgREST path)

-- Partition-local read index (arch §4 D5 line 362; spec line 348). Created on the parent →
-- cascades to all current/future partitions (native partitioning).
CREATE INDEX IF NOT EXISTS health_observations_subject_metric_date_idx
  ON public.health_observations (subject_user_id, metric_definition_id, measured_date_ist DESC);

-- ----------------------------------------------------------------------------
-- IST partition-key trigger (tg_set_measured_date_ist from 0004): BEFORE INSERT OR UPDATE OF
-- measured_at, sets measured_date_ist = (measured_at AT TIME ZONE 'Asia/Kolkata')::date. Runs
-- before tuple routing (BEFORE-ROW), so callers need not supply the partition key. Attached to
-- the parent → applies to every partition.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS health_observations_set_date_ist ON public.health_observations;
CREATE TRIGGER health_observations_set_date_ist
  BEFORE INSERT OR UPDATE OF measured_at ON public.health_observations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_measured_date_ist();

-- ----------------------------------------------------------------------------
-- Register with pg_partman (monthly): premake=2, infinite, automatic maintenance, and a
-- RLS-forced / REVOKE-d template so partitions inherit the lockdown. No-op if already
-- registered. (0006 helper; the 0004 event trigger is the always-on backstop.)
-- ----------------------------------------------------------------------------
SELECT public.provision_partition_parent('public.health_observations', 'measured_date_ist', '1 month');

-- =============================================================================
-- DEFERRED (Phase 8 — drop in verbatim once access_grants / care_plans / care_team_members /
-- admin_support_access + coach_data_access_audit[new] exist). Target RLS from spec §3.3:
--
--   CREATE POLICY ho_select ON public.health_observations FOR SELECT TO authenticated
--     USING ( subject_user_id = auth.uid()
--             OR (SELECT public.can_read_health(subject_user_id))
--             OR (SELECT public.admin_has_support_access(subject_user_id)) );
--
--   CREATE POLICY ho_insert_self ON public.health_observations FOR INSERT TO authenticated
--     WITH CHECK ( subject_user_id = auth.uid() );
--
--   CREATE POLICY ho_insert_coach ON public.health_observations FOR INSERT TO authenticated
--     WITH CHECK ( source = 'coach_entered'
--                  AND recorded_by_user_id = auth.uid()
--                  AND EXISTS ( SELECT 1 FROM public.organization_members m
--                               WHERE m.user_id = auth.uid() AND m.status='active'
--                                 AND public.org_has_active_grant(m.organization_id,
--                                       subject_user_id, 'health_data')
--                                 AND public.has_capability(m.id, 'view_client_health') ) );
--
--   CREATE POLICY ho_update_owner ON public.health_observations FOR UPDATE TO authenticated
--     USING ( subject_user_id = auth.uid() ) WITH CHECK ( subject_user_id = auth.uid() );
--   -- no DELETE policy ⇒ delete denied for authenticated.
--
-- And rpc_read_health_observations(subject, metric, range) — SECURITY DEFINER, runs as
-- rls_owner, re-checks can_read_health, returns partition-pruned rows, and writes exactly ONE
-- coach_data_access_audit row IN THE SAME TRANSACTION (rolls back the audit if the read fails).
-- =============================================================================
