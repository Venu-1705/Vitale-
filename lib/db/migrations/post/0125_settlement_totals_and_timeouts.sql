-- =============================================================================
-- Vitalé — Post-companion 0125: tg_check_settlement_totals + session timeouts
-- Ground truth: VITALE_IMPLEMENTATION_SPEC §4.4 (line 917-919) + §7.10
-- (lines 1232-1233).
--
-- Delivers:
--   • tg_check_settlement_totals — settlements: gross = net + fees + tax (same-row
--     arithmetic invariant; spec §4.4).
--   • statement_timeout / idle_in_transaction_session_timeout — protect against
--     runaway or leaked transactions (spec §7.10).
--   • timezone = UTC at server level (all IST derivation via triggers, never tz).
--
-- Apply order: after 0124 (lexical). Idempotent: CREATE OR REPLACE; ALTER SYSTEM
-- is idempotent (overwrites previous value).
-- =============================================================================

-- ============================================================================
-- SECTION 1 — tg_check_settlement_totals (spec §4.4)
-- Settlements: gross_paise = net_paise + fees_paise + tax_paise.
-- BEFORE INSERT OR UPDATE so no bad row ever lands.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.tg_check_settlement_totals()
  RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.gross_paise IS NOT NULL
     AND NEW.net_paise IS NOT NULL
     AND NEW.fees_paise IS NOT NULL
     AND NEW.tax_paise IS NOT NULL
  THEN
    IF NEW.gross_paise <> (NEW.net_paise + NEW.fees_paise + NEW.tax_paise) THEN
      RAISE EXCEPTION
        'settlements: gross_paise (%) <> net_paise (%) + fees_paise (%) + tax_paise (%)',
        NEW.gross_paise, NEW.net_paise, NEW.fees_paise, NEW.tax_paise
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS settlements_check_totals ON public.settlements;
CREATE TRIGGER settlements_check_totals
  BEFORE INSERT OR UPDATE ON public.settlements
  FOR EACH ROW EXECUTE FUNCTION public.tg_check_settlement_totals();

-- ============================================================================
-- SECTION 2 — session-level timeouts (spec §7.10)
-- These are applied as ALTER DATABASE defaults so every new connection inherits
-- them. Individual RPCs or long-running jobs can SET LOCAL to override within
-- their transaction.
--
-- statement_timeout: 30 s — kills runaway queries (max for API endpoints).
-- idle_in_transaction_session_timeout: 60 s — reclaims leaked transactions.
-- lock_timeout: 10 s — prevents lock-queue pile-ups under concurrent writes.
-- ============================================================================
-- SUBSTRATE NOTE (vanilla PG): target the database the migration is connected to
-- via current_database() rather than the hardcoded Supabase default ('postgres').
-- On self-hosted PG the app database is typically named 'vitale'.
DO $db$
DECLARE v_db text := current_database();
BEGIN
  EXECUTE format('ALTER DATABASE %I SET statement_timeout = %L',                    v_db, '30s');
  EXECUTE format('ALTER DATABASE %I SET idle_in_transaction_session_timeout = %L',  v_db, '60s');
  EXECUTE format('ALTER DATABASE %I SET lock_timeout = %L',                         v_db, '10s');
  -- Enforce UTC at the server level. IST derivation is done exclusively via
  -- AT TIME ZONE 'Asia/Kolkata' in triggers and queries (never via SET timezone).
  EXECUTE format('ALTER DATABASE %I SET timezone = %L',                             v_db, 'UTC');
END
$db$;

-- ============================================================================
-- SECTION 3 — default_statistics_target for skewed columns (spec §7.10)
-- Raise for high-cardinality partition key + FK columns used in range scans.
-- This improves planner estimates on partitioned tables.
-- ============================================================================
ALTER TABLE public.health_observations      ALTER COLUMN measured_date_ist    SET STATISTICS 500;
ALTER TABLE public.health_observations      ALTER COLUMN subject_user_id      SET STATISTICS 500;
ALTER TABLE public.nutrition_logs           ALTER COLUMN logged_date_ist      SET STATISTICS 500;
ALTER TABLE public.nutrition_logs           ALTER COLUMN user_id              SET STATISTICS 500;
ALTER TABLE public.coach_data_access_audit  ALTER COLUMN accessed_at          SET STATISTICS 500;
ALTER TABLE public.messages                 ALTER COLUMN created_date_ist     SET STATISTICS 500;
ALTER TABLE public.notifications            ALTER COLUMN created_date_ist     SET STATISTICS 500;
ALTER TABLE public.access_grants            ALTER COLUMN status               SET STATISTICS 200;
ALTER TABLE public.program_enrollments      ALTER COLUMN status               SET STATISTICS 200;

-- ============================================================================
-- NOTES
-- • statement_timeout applies per statement; the pg_cron job procedures use
--   SET LOCAL statement_timeout = '0' at the top of any long-running sweep to
--   exempt themselves (within the same transaction).
-- • idle_in_transaction_session_timeout terminates connections that have been
--   idle inside a transaction for > 60 s — catches dropped clients that hold
--   row locks.
-- • The ALTER DATABASE commands require superuser or the pg_database_owner
--   role; apply via the Supabase dashboard SQL editor or a service_role
--   migration (not via the authenticated role).
-- • tg_check_settlement_totals: the settlements table uses paise (int) so
--   there is no floating-point precision issue.
-- =============================================================================
