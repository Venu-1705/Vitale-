-- =============================================================================
-- Vitalé — Post-companion 0122: lab domain RLS, triggers, tg_normalize_to_observations
-- Ground truth: VITALE_DB_ARCHITECTURE §4 D11 (lines 488-496) +
-- VITALE_IMPLEMENTATION_SPEC §4.5 (line 1035), Phase 8 (line 1133).
--
-- Tables (Drizzle-owned DDL now in new-convention lab.ts):
--   lab_packages        [C]  — REVOKE anon; authenticated SELECT
--   lab_tests           [C]  — REVOKE anon; authenticated SELECT
--   lab_bookings        [C]  — owner + org member with view_client_health
--   lab_reports         [B]  — REVOKE-API; owner + can_read_health + admin; via rpc_read_lab_report
--   lab_report_results  [B]  — same as lab_reports
--   coach_lab_recommendations [C] — coach writes, owner reads
--
-- Trigger:
--   tg_normalize_to_observations — AFTER INSERT on lab_report_results;
--     upserts a health_observations row (source='lab') for numeric results that
--     have a matching metric_definition (by lab_test.code = metric_definition.lab_code).
--
-- Apply order: after 0121 (lexical). Idempotent: CREATE OR REPLACE;
-- DROP TRIGGER IF EXISTS; DROP POLICY IF EXISTS; RLS ENABLE is idempotent.
-- =============================================================================

-- ============================================================================
-- SECTION 1 — enable RLS
-- ============================================================================
ALTER TABLE public.lab_packages               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_tests                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_bookings               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_reports                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_report_results         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_lab_recommendations  ENABLE ROW LEVEL SECURITY;

-- FORCE on PHI-bearing tables (reports, results)
ALTER TABLE public.lab_reports        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.lab_report_results FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 2 — tg_normalize_to_observations trigger function
-- Maps lab_report_results → health_observations(source='lab').
-- Matches lab_test.code to metric_definitions.lab_code (a future column;
-- COALESCE to skip if no mapping exists).
-- SECURITY DEFINER: must INSERT into health_observations (REVOKE-API table).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.tg_normalize_to_observations()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp AS $$
DECLARE
  v_metric_id    uuid;
  v_user_id      uuid;
  v_report_date  timestamptz;
  v_measured_date date;
BEGIN
  -- Only normalize numeric results
  IF NEW.value IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve metric_definition by matching lab_test.code to metric_definitions.lab_code
  -- (metric_definitions.lab_code column added in Phase 3; skip if absent)
  BEGIN
    SELECT md.id INTO v_metric_id
    FROM public.lab_tests lt
    JOIN public.metric_definitions md
      ON md.lab_code = lt.code
    WHERE lt.id = NEW.test_id
    LIMIT 1;
  EXCEPTION WHEN undefined_column THEN
    -- metric_definitions.lab_code not yet present; skip normalization
    RETURN NEW;
  END;

  IF v_metric_id IS NULL THEN
    RETURN NEW; -- No mapping exists; skip
  END IF;

  -- Resolve subject and report date
  SELECT lr.user_id, lr.report_date
  INTO v_user_id, v_report_date
  FROM public.lab_reports lr
  WHERE lr.id = NEW.report_id;

  -- Partition-safety (mirrors D5 health-data insert): health_observations is RANGE-partitioned on
  -- measured_date_ist and has a BEFORE-INSERT trigger (tg_set_measured_date_ist) that recomputes
  -- measured_date_ist := (measured_at AT TIME ZONE 'Asia/Kolkata')::date. PostgreSQL routes the
  -- tuple to its partition BEFORE that trigger fires, so we must (1) supply measured_at — it is
  -- NOT NULL with no default — and (2) supply measured_date_ist using the SAME IST expression, so
  -- routing lands in the right partition and the BEFORE trigger's recompute is a no-op (no
  -- "moving row to another partition during a BEFORE trigger" error).
  v_measured_date := (v_report_date AT TIME ZONE 'Asia/Kolkata')::date;

  -- Upsert into health_observations (source='lab')
  -- ON CONFLICT DO NOTHING (no target) absorbs any unique/partition-unique collision if a
  -- normalization unique index exists; harmless when none does.
  INSERT INTO public.health_observations (
    id,
    subject_user_id,
    metric_definition_id,
    measured_date_ist,
    value_numeric,
    measured_at,
    source,
    recorded_by_user_id,
    created_at
  )
  VALUES (
    gen_random_uuid(),
    v_user_id,
    v_metric_id,
    v_measured_date,
    NEW.value::numeric,
    v_report_date,
    'lab',
    v_user_id,
    now()
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- SECTION 3 — trigger attachment
-- ============================================================================
DROP TRIGGER IF EXISTS lab_results_normalize ON public.lab_report_results;
CREATE TRIGGER lab_results_normalize
  AFTER INSERT ON public.lab_report_results
  FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_to_observations();

-- ============================================================================
-- SECTION 4 — table privileges
-- ============================================================================

-- Catalog tables: public read (no PHI); anon can browse packages/tests
REVOKE ALL ON public.lab_packages FROM anon, authenticated;
REVOKE ALL ON public.lab_tests    FROM anon, authenticated;
GRANT SELECT ON public.lab_packages TO anon, authenticated;
GRANT SELECT ON public.lab_tests    TO anon, authenticated;

-- Bookings: owner manages own bookings
REVOKE ALL ON public.lab_bookings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.lab_bookings TO authenticated;

-- Reports + results: REVOKE-API (reached via rpc_read_lab_report only)
REVOKE ALL ON public.lab_reports        FROM anon, authenticated;
REVOKE ALL ON public.lab_report_results FROM anon, authenticated;

-- Coach recommendations: coach inserts, owner reads
REVOKE ALL ON public.coach_lab_recommendations FROM anon, authenticated;
GRANT SELECT, INSERT ON public.coach_lab_recommendations TO authenticated;

-- ============================================================================
-- SECTION 5 — RLS policies
-- ============================================================================

-- lab_packages: public catalog — all authenticated can read
DROP POLICY IF EXISTS lab_packages_select ON public.lab_packages;
CREATE POLICY lab_packages_select ON public.lab_packages FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS lab_packages_select_anon ON public.lab_packages;
CREATE POLICY lab_packages_select_anon ON public.lab_packages FOR SELECT TO anon
  USING (is_active = true);

-- lab_tests: public catalog
DROP POLICY IF EXISTS lab_tests_select ON public.lab_tests;
CREATE POLICY lab_tests_select ON public.lab_tests FOR SELECT TO authenticated
  USING (true);

-- lab_bookings: owner reads/writes own bookings; a coach may read a booking ONLY for a subject
-- whose health data they may already read (active health_data grant + capability, care-team-scoped).
-- can_read_health(user_id) is the exact, subject-scoped predicate — it also short-circuits true for
-- self. The earlier `is_org_member(<caller's org>, 'view_client_health')` form was unscoped: it let
-- ANY org member with that capability read EVERY booking system-wide (the rows carry patient PII),
-- so it is replaced here.
DROP POLICY IF EXISTS lab_bookings_select ON public.lab_bookings;
CREATE POLICY lab_bookings_select ON public.lab_bookings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_read_health(user_id));

DROP POLICY IF EXISTS lab_bookings_insert ON public.lab_bookings;
CREATE POLICY lab_bookings_insert ON public.lab_bookings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS lab_bookings_update ON public.lab_bookings;
CREATE POLICY lab_bookings_update ON public.lab_bookings FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- lab_reports / lab_report_results: REVOKE-API + FORCE RLS. There is NO SELECT/INSERT grant or
-- policy for authenticated — the raw client can neither read nor write these PHI tables directly.
--   • READ goes EXCLUSIVELY through rpc_read_lab_report (0120): SECURITY DEFINER, owned by the
--     BYPASSRLS role `v`, so it bypasses RLS to read the report + results and writes the in-tx
--     coach_data_access_audit row. (It is NOT owned by rls_owner; an rls_owner SELECT policy would
--     be the wrong execution model and is intentionally absent — see 0120 ownership note.)
--   • WRITE (report ingestion) is a service-role path: the Thyrocare webhook / API server inserts
--     via the service_role connection, which is BYPASSRLS. No authenticated INSERT policy exists by
--     design (reports are issued by the lab, never authored by an end-user/coach client).
-- Earlier drafts of this file created `*_rpc_owner` (FOR SELECT TO rls_owner) and `*_insert`
-- (FOR INSERT TO rls_owner) policies on the assumption the RPC ran as rls_owner; that assumption was
-- wrong (the RPC runs as v), so those policies are dropped here and not recreated.
DROP POLICY IF EXISTS lab_reports_rpc_owner        ON public.lab_reports;
DROP POLICY IF EXISTS lab_report_results_rpc_owner ON public.lab_report_results;
DROP POLICY IF EXISTS lab_reports_insert           ON public.lab_reports;
DROP POLICY IF EXISTS lab_report_results_insert    ON public.lab_report_results;

-- coach_lab_recommendations: coach (INSERT) + subject (SELECT own)
DROP POLICY IF EXISTS clr_select ON public.coach_lab_recommendations;
CREATE POLICY clr_select ON public.coach_lab_recommendations FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR coach_id = auth.uid());

DROP POLICY IF EXISTS clr_insert ON public.coach_lab_recommendations;
CREATE POLICY clr_insert ON public.coach_lab_recommendations FOR INSERT TO authenticated
  WITH CHECK (coach_id = auth.uid());

-- ============================================================================
-- NOTES
-- • lab_reports and lab_report_results are REVOKE-API: no SELECT grant to
--   authenticated. The app always reads via rpc_read_lab_report (0120).
-- • tg_normalize_to_observations skips rows without a test_id or without a
--   matching metric_definitions.lab_code mapping (Phase 3 column).
-- • The trigger fires AFTER INSERT (not BEFORE) so NEW.report_id is already
--   committed to lab_reports. SECURITY DEFINER allows INSERT into health_
--   observations even though the trigger session may be authenticated role.
-- =============================================================================
