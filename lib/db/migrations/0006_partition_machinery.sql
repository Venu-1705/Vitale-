-- =============================================================================
-- Vitalé — Migration 0006: Partition machinery + operational singletons
-- Phase 1 (Database Foundations) · Implements VITALE_IMPLEMENTATION_SPEC Part 5
-- (§ job_runs observability contract; § tg_assign_invoice_number → document_number_sequences)
-- and Part 6 Phase 1 (0006_partition_machinery: "pg_partman parent template carrying
-- RLS/REVOKE; document_number_sequences; job_runs").
--
-- This is the LAST of the six Phase-1 foundation files. It creates the two operational
-- singleton tables that every later phase depends on, and the reusable pg_partman
-- parent-provisioning helper. The 6 partitioned PARENTS themselves are created in their
-- domain phases (nutrition_logs/_items Ph4, coach_data_access_audit Ph3, health_observations
-- Ph3, messages Ph6, notifications Ph6); each calls public.provision_partition_parent()
-- once it exists. The 0004 event trigger (vitale_harden_new_partition) is the always-on
-- backstop so a partition can never be born exposed, independent of pg_partman config.
--
-- Apply order: after 0005_rls_helpers. Idempotent: CREATE TABLE IF NOT EXISTS; helper is
-- CREATE OR REPLACE; hardening (ENABLE/FORCE RLS, REVOKE) is naturally idempotent.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- document_number_sequences — gap-free statutory document numbering.
-- Backs tg_assign_invoice_number()/tg_assign_credit_note_number() and the invoice_issue
-- job (Part 5 #9). One row per (series, fiscal_year); writers take a txn-scoped advisory
-- lock on hashtext(series||':'||fiscal_year), read last_value, increment, format VIT/<FY>/<n>.
-- Gap-free PER FISCAL YEAR (Indian FY: April 1 → March 31; fiscal_year stores the starting
-- calendar year, e.g. 2025 = FY2025-26).
--
-- Access: written ONLY by SECURITY DEFINER triggers / pg_cron procedures (which run as the
-- table owner, bypassing RLS). REVOKE-d from PostgREST roles + RLS forced so it is never
-- reachable from the API surface. No policies = deny-all to anon/authenticated.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_number_sequences (
  series      text   NOT NULL,                 -- 'coach_invoice' | 'invoice' | 'credit_note' | ...
  fiscal_year integer NOT NULL,                -- e.g. 2025 ⇒ FY2025-26 (Apr–Mar)
  last_value  bigint NOT NULL DEFAULT 0,       -- monotonic per (series, fiscal_year); next = last_value + 1
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (series, fiscal_year),
  CONSTRAINT document_number_sequences_value_nonneg CHECK (last_value >= 0)
);

ALTER TABLE public.document_number_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_number_sequences FORCE  ROW LEVEL SECURITY;
REVOKE ALL ON public.document_number_sequences FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- job_runs — observability ledger for every pg_cron job (Part 5: "All jobs are idempotent
-- and write a row to job_runs(job_name, started_at, finished_at, status, detail)").
-- Each job procedure inserts a 'running' row at start and flips it to 'success'/'error'
-- (or 'skipped') at the end; the failed-run alerter (Part 7) reads this table.
--
-- Access: written by pg_cron procedures (run as owner). REVOKE-d + RLS forced. Operators
-- read it via service-role / SQL console, not via PostgREST.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name    text NOT NULL,
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status      text NOT NULL DEFAULT 'running'
              CHECK (status IN ('running','success','error','skipped')),
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,   -- structured run notes / error message / counts
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Observability access pattern: latest runs per job (dashboards, SLA alerts).
CREATE INDEX IF NOT EXISTS job_runs_name_started_idx
  ON public.job_runs (job_name, started_at DESC);

ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_runs FORCE  ROW LEVEL SECURITY;
REVOKE ALL ON public.job_runs FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- provision_partition_parent() — reusable native-partitioning registration.
-- Called once from each domain phase, AFTER that phase has created the partitioned parent
-- (so the table exists when this inspects it). Idempotent: no-op if already registered.
--
-- SUBSTRATE NOTE (vanilla PG): pg_partman is not bundled with the EDB installer, so this
-- helper drives the NATIVE declarative-partition framework from 0000 instead of
-- partman.create_parent(). It (1) records the parent in public.part_config with the same
-- hardened lifecycle settings — premake = 2 (Part 5 #1), monthly windows — and (2) eagerly
-- creates the current + 2 future partitions via public.run_partition_maintenance() so writes
-- land from day one. Every child partition is locked down (ENABLE+FORCE RLS, REVOKE from
-- anon/authenticated, realtime add) by the 0004 event trigger `vitale_harden_new_partition`,
-- which replaces pg_partman's hardened TEMPLATE table. The event trigger is the always-on
-- backstop (Part 7: "template carries RLS + REVOKE; event trigger backstop installed").
--
-- Same signature and call convention as before, so domain-phase call sites are unchanged:
--   SELECT public.provision_partition_parent('public.health_observations','measured_date_ist','1 month');
--
-- plpgsql ⇒ body is NOT validated at CREATE time; referencing not-yet-created parents here
-- is safe in Phase 1. The function is only EXECUTED in later phases.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.provision_partition_parent(
        p_parent   regclass,     -- e.g. 'public.health_observations'
        p_control  text,         -- partition key column, e.g. 'measured_date_ist'
        p_interval text DEFAULT '1 month')
  RETURNS void
  LANGUAGE plpgsql
  SET search_path = public, pg_temp AS $$
DECLARE
  v_parent_text text := p_parent::text;
BEGIN
  -- Already registered? (public.part_config is the source of truth.) Make this a no-op.
  IF EXISTS (SELECT 1 FROM public.part_config WHERE parent_table = v_parent_text) THEN
    RAISE NOTICE 'provision_partition_parent: % already registered, skipping.', v_parent_text;
    RETURN;
  END IF;

  -- Register with hardened lifecycle config: keep 2 future partitions ready (Part 5 #1
  -- "Premake = 2"). Retention stays NULL here — the 0116 retention job applies per-table
  -- cutoffs explicitly (audit detach-only vs. drop for others).
  INSERT INTO public.part_config (parent_table, control, part_interval, premake)
  VALUES (v_parent_text, p_control, p_interval, 2)
  ON CONFLICT (parent_table) DO NOTHING;

  -- Eagerly create the current + premake future partitions so the parent can accept writes
  -- immediately. tg_harden_new_partition fires on each CREATE TABLE and locks it down.
  PERFORM public.run_partition_maintenance();

  RAISE NOTICE 'provision_partition_parent: registered % (control=%, interval=%) [native declarative].',
    v_parent_text, p_control, p_interval;
END $$;

-- Provisioning is an operator/migration action, not an app action: no GRANT to authenticated.
REVOKE ALL ON FUNCTION public.provision_partition_parent(regclass, text, text)
  FROM anon, authenticated;
