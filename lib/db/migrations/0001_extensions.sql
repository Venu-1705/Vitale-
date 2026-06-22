-- =============================================================================
-- Vitalé — Migration 0001: Extensions
-- Phase 1 (Database Foundations) · Implements VITALE_IMPLEMENTATION_SPEC Part 1 §1.3,
-- Part 6 Phase 1, and VITALE_DB_ARCHITECTURE §9 (migration ordering, step 1).
--
-- Apply order: runs after 0000_vanilla_pg_bootstrap (which creates the
-- `extensions` schema this file installs into). Run before 0002_enums.sql.
-- Idempotent: every statement uses IF NOT EXISTS / guarded DO blocks.
--
-- SUBSTRATE = self-hosted vanilla PostgreSQL 18.x (EDB installer). Notes:
--   * The `extensions` schema is created in 0000 (Supabase pre-creates it).
--   * pgcrypto + pg_trgm ship in PG contrib → install cleanly into `extensions`.
--   * pg_cron + pg_partman are NOT bundled with the vanilla/EDB installer. They
--     are OPTIONAL here: pg_cron is replaced by OS cron (lib/db/cron/) and
--     pg_partman by the native partition framework (0000 + 0006). The CREATE
--     EXTENSIONs below are attempted but never fatal — if the operator later
--     installs them (e.g. via StackBuilder / a build), they will be picked up.
--   * pg_uuidv7 is OPTIONAL — UUIDv7 PKs are generated app-side (TS); a DB
--     DEFAULT is a convenience only. PostgreSQL 18 also ships native uuidv7().
--     `users.id = auth.users.id` is the sole non-v7 PK.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;       -- digest() for hash-chain; gen_random_uuid() is core in PG13+
CREATE EXTENSION IF NOT EXISTS pg_trgm  WITH SCHEMA extensions;       -- GIN trigram search: food_items.name, metric_definitions.display_name

-- pg_cron — optional. Not bundled with the vanilla/EDB PostgreSQL 18 installer
-- (needs shared_preload_libraries + a separate build). When absent, the 15
-- job_*() procedures (0116) are driven by OS cron instead — see lib/db/cron/.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION WHEN undefined_file OR feature_not_supported OR insufficient_privilege OR invalid_parameter_value THEN
  RAISE NOTICE 'pg_cron not available — scheduling job_*() via OS cron (lib/db/cron/). Expected on vanilla PG.';
END $$;

-- pg_partman — optional. Replaced by the native declarative-partition framework
-- (public.run_partition_maintenance / drop_old_partitions in 0000; consumed by
-- 0006 provision_partition_parent and the 0116 jobs). Attempted for parity only.
DO $$
BEGIN
  CREATE SCHEMA IF NOT EXISTS partman;
  CREATE EXTENSION IF NOT EXISTS pg_partman WITH SCHEMA partman;
EXCEPTION WHEN undefined_file OR feature_not_supported OR insufficient_privilege THEN
  RAISE NOTICE 'pg_partman not available — using native partitioning (public.run_partition_maintenance). Expected on vanilla PG.';
END $$;

-- Optional DB-side UUIDv7 default (only if available in the project image).
-- Generation remains app-side (TS uuidv7()); this DEFAULT is convenience only.
--
-- IMPORTANT: several DB-side paths call uuidv7() unqualified and REQUIRE it to resolve at runtime —
-- tg_bump_program_version (program publish → program_versions) and rpc_enroll_in_program (enrollment)
-- among them. On Supabase, pg_uuidv7 supplies extensions.uuidv7() and the default search_path includes
-- `extensions`, so the bare call resolves. On vanilla/local PG the extension is absent, so we install a
-- pure-SQL public.uuidv7() fallback (the triggers/RPCs run with search_path=public,pg_temp → resolves).
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_uuidv7 WITH SCHEMA extensions;
EXCEPTION
  WHEN undefined_file OR feature_not_supported OR insufficient_privilege THEN
    RAISE NOTICE 'pg_uuidv7 not available in this image; installing pure-SQL public.uuidv7() fallback.';
    -- RFC 9562 UUIDv7: 48-bit Unix-millis timestamp prefix + version/variant bits + random tail.
    -- Time-ordered (preserves index locality) like the app-side generator. Core deps only (pg_catalog).
    CREATE OR REPLACE FUNCTION public.uuidv7() RETURNS uuid
      LANGUAGE plpgsql VOLATILE PARALLEL SAFE AS $fn$
    DECLARE
      v_millis bigint := (extract(epoch FROM clock_timestamp()) * 1000)::bigint;
      v_bytes  bytea  := uuid_send(gen_random_uuid());
    BEGIN
      v_bytes := set_byte(v_bytes, 0, ((v_millis >> 40) & 255)::int);
      v_bytes := set_byte(v_bytes, 1, ((v_millis >> 32) & 255)::int);
      v_bytes := set_byte(v_bytes, 2, ((v_millis >> 24) & 255)::int);
      v_bytes := set_byte(v_bytes, 3, ((v_millis >> 16) & 255)::int);
      v_bytes := set_byte(v_bytes, 4, ((v_millis >>  8) & 255)::int);
      v_bytes := set_byte(v_bytes, 5, ( v_millis        & 255)::int);
      -- byte 6: version 7 (0x70) in the high nibble, keep low nibble random
      v_bytes := set_byte(v_bytes, 6, ((get_byte(v_bytes, 6) & 15) | 112));
      -- byte 8: RFC 4122 variant (10xx) in the high bits, keep low bits random
      v_bytes := set_byte(v_bytes, 8, ((get_byte(v_bytes, 8) & 63) | 128));
      RETURN encode(v_bytes, 'hex')::uuid;
    END $fn$;
END $$;

-- pg_stat_statements is enabled via Supabase project config / postgresql.conf
-- (shared_preload_libraries) — referenced by Part 7 §7.10, not created here.
