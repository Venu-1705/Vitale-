-- =============================================================================
-- Vitalé — Post-table migration 0141: service_role table grants (Supabase parity)
-- -----------------------------------------------------------------------------
-- `service_role` is the trusted, BYPASSRLS server identity (assumable ONLY by the
-- API's service pool via SET ROLE; never exposed to clients). On Supabase it is
-- granted full DML on the public schema by the platform's own role setup. The
-- vanilla bootstrap recreated the ROLE but not those grants, so every
-- withServiceContext write path (e.g. POST /organizations creating the org +
-- owner_coach seat atomically) failed locally with 42501 "permission denied".
--
-- This migration replicates Supabase's default service_role grants so the trusted
-- server paths behave identically on local PostgreSQL. RLS is unaffected
-- (service_role already bypasses it); this only restores the table-level grants.
--
-- Idempotent: GRANT/ALTER DEFAULT PRIVILEGES are safe to re-run.
-- =============================================================================

GRANT USAGE ON SCHEMA public TO service_role;

GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Future objects created in public inherit the same grants (matches Supabase).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL     ON TABLES    TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL     ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
