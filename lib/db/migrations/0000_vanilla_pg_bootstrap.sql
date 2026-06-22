-- =============================================================================
-- Vitalé — Migration 0000: Vanilla PostgreSQL compatibility bootstrap
-- Phase 0 (Substrate) · Makes a self-hosted, vanilla PostgreSQL 18.x install
-- present the surface the rest of the schema was authored against (originally
-- Supabase). NOTHING in 0001–0126 is Supabase-specific after this file runs.
--
-- WHY THIS FILE EXISTS
--   The schema was built assuming Supabase, which provides out of the box:
--     • an `extensions` schema (CREATE EXTENSION ... WITH SCHEMA extensions)
--     • the roles  anon / authenticated / service_role / authenticator
--     • an `auth` schema with auth.uid()/auth.role()/auth.jwt()/auth.email()
--     • an `auth.users` table whose INSERT provisions public.users
--     • pg_cron + pg_partman bundled in the image
--   Vanilla PostgreSQL has none of these. Rather than rewrite 152 auth.uid()
--   calls, 449 `TO authenticated` grants/policies, 149 anon references, etc.,
--   this bootstrap RE-CREATES those objects natively. Every downstream policy,
--   trigger and grant then works unchanged.
--
--   pg_cron  → replaced by OS cron driving the job_*() procedures (lib/db/cron/).
--   pg_partman → replaced by the native declarative-partition framework below
--                (part_config + run_partition_maintenance + drop_old_partitions),
--                consumed by 0006 provision_partition_parent() and the 0116 jobs.
--
-- Apply order: FIRST. Runs before 0001_extensions (lexical: 0000 < 0001).
-- Idempotent: IF NOT EXISTS / CREATE OR REPLACE / guarded role creation.
-- Privileges: run as a superuser (the `postgres` role from the EDB installer).
-- =============================================================================

-- ============================================================================
-- SECTION 1 — schemas
-- `extensions` must exist before 0001 does CREATE EXTENSION ... WITH SCHEMA
-- extensions (pgcrypto, pg_trgm). `auth` hosts the JWT/identity shim.
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS auth;

-- ============================================================================
-- SECTION 2 — roles
-- Mirror the Supabase/PostgREST role model so all `TO <role>` clauses resolve.
--   anon            — unauthenticated API identity (public reads only)
--   authenticated   — logged-in end users / coaches (RLS-governed)
--   service_role    — trusted server identity; BYPASSRLS (the Node API uses it)
--   authenticator   — login/SET ROLE switchboard (kept for parity; PostgREST-era)
--   rls_owner       — low-privilege owner of SECURITY DEFINER helpers (also made
--                     in 0005; created here too so 0000-era grants can reference it)
-- All are NOLOGIN: the application connects as a dedicated login role that is a
-- member of these, or (for trusted server work) as service_role / a superuser.
-- ============================================================================
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    -- NOINHERIT: gains privileges only via explicit SET ROLE, like PostgREST.
    CREATE ROLE authenticator NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rls_owner') THEN
    CREATE ROLE rls_owner NOLOGIN;
  END IF;

  -- authenticator may assume the three API identities (SET ROLE switchboard).
  GRANT anon, authenticated, service_role TO authenticator;

  -- Let the current superuser SET ROLE into the API identities for local
  -- testing / running RLS-governed statements as a specific identity.
  EXECUTE format('GRANT anon, authenticated, service_role TO %I', current_user);
END
$roles$;

-- Baseline schema usage (Supabase grants these; downstream migrations then add
-- the per-table SELECT/INSERT/… grants). CREATE on public stays revoked (PG15+
-- default) — only migrations (run as superuser) create objects.
GRANT USAGE ON SCHEMA public     TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth       TO authenticated, service_role;

-- ============================================================================
-- SECTION 3 — auth.* identity shim (the heart of the compatibility layer)
-- Faithful to Supabase/PostgREST semantics: identity comes from a per-request
-- GUC. The Node API sets ONE of these at the start of each request/transaction:
--
--   -- simplest (recommended for the vanilla app):
--   SET LOCAL app.user_id = '<uuid>';
--
--   -- or full PostgREST-style claims:
--   SET LOCAL request.jwt.claims = '{"sub":"<uuid>","role":"authenticated", ...}';
--
-- auth.uid() resolves in this order: discrete sub claim → app.user_id → claims
-- JSON. Pure-SQL + STABLE so the planner can inline it inside RLS policies (the
-- jsonb parse is only reached when the earlier, cheaper GUCs are unset, so a
-- non-JSON value in an unused GUC never errors). Trusted server code that runs
-- as service_role / superuser bypasses RLS and need not set any GUC.
-- ============================================================================
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
           nullif(current_setting('request.jwt.claim.sub', true), ''),
           nullif(current_setting('app.user_id', true), ''),
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
         )::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
  LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
           nullif(current_setting('request.jwt.claim.role', true), ''),
           nullif(current_setting('app.user_role', true), ''),
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
           'authenticated'
         )
$$;

CREATE OR REPLACE FUNCTION auth.email() RETURNS text
  LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
           nullif(current_setting('app.user_email', true), ''),
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email'
         )
$$;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
  LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
           nullif(current_setting('request.jwt.claims', true), '')::jsonb,
           '{}'::jsonb
         )
$$;

GRANT EXECUTE ON FUNCTION auth.uid(), auth.role(), auth.email(), auth.jwt()
  TO anon, authenticated, service_role;

-- ============================================================================
-- SECTION 4 — (removed) auth.users provisioning source table
-- ARCHITECTURE: Supabase is the AUTHENTICATION provider only (it issues the JWTs,
-- including Google OAuth) and no longer hosts our database. There is therefore no
-- local `auth.users` table and no INSERT-trigger provisioning. Users are created
-- Just-In-Time in `public.users` on their first authenticated request — see
-- public.rpc_provision_user (migration post/0140) and the API's lib/provision.ts.
-- The `auth` schema and its auth.uid()/role()/jwt()/email() helpers (Section 3)
-- remain — they read the request.jwt.claims GUC, NOT any auth table.
-- ============================================================================

-- ============================================================================
-- SECTION 5 — native declarative-partition framework (pg_partman replacement)
-- The 6 partitioned parents (health_observations, nutrition_logs,
-- nutrition_log_items, coach_data_access_audit, messages, notifications) are
-- declared PARTITION BY RANGE (<*_date_ist>) in their domain phases and then
-- registered here via provision_partition_parent() (0006, rewritten to call
-- this framework). All Vitalé partitions are MONTHLY over a date column.
--
-- Every partition this framework stamps out is automatically locked down by the
-- 0004 event trigger `vitale_harden_new_partition` (ENABLE+FORCE RLS, REVOKE
-- from anon/authenticated, realtime publication add) — exactly as pg_partman's
-- hardened template did. No partition is ever born exposed.
-- ============================================================================

-- Registry of partitioned parents (one row per parent). Operator/migration data;
-- locked down like job_runs / document_number_sequences.
CREATE TABLE IF NOT EXISTS public.part_config (
  parent_table          text PRIMARY KEY,                 -- 'public.health_observations'
  control               text NOT NULL,                    -- partition key column
  part_interval         text NOT NULL DEFAULT '1 month',  -- monthly only (native shim)
  premake               integer NOT NULL DEFAULT 2,       -- future partitions to keep ready
  retention             text,                             -- e.g. '7 years'; NULL = keep forever
  retention_keep_table  boolean NOT NULL DEFAULT true,    -- detach (true) vs drop (false)
  child_reloptions      text,                             -- storage params applied to each NEW child
                                                          -- (e.g. 'autovacuum_vacuum_scale_factor=0.01,...').
                                                          -- Partitioned PARENTS cannot hold storage params,
                                                          -- so per-partition tuning is carried here. See 0117.
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Existing deployments (CREATE TABLE IF NOT EXISTS above is a no-op) gain the column:
ALTER TABLE public.part_config ADD COLUMN IF NOT EXISTS child_reloptions text;

ALTER TABLE public.part_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.part_config FORCE  ROW LEVEL SECURITY;
REVOKE ALL ON public.part_config FROM anon, authenticated;

-- Create the monthly partition covering p_month_start, if it does not exist.
-- Idempotent; the event trigger hardens the new child automatically.
CREATE OR REPLACE FUNCTION public.ensure_month_partition(
        p_parent regclass, p_month_start date)
  RETURNS boolean
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_schema    text;
  v_short     text;
  v_part_name text;
  v_reloptions text;
  v_from      date := date_trunc('month', p_month_start)::date;
  v_to        date := (date_trunc('month', p_month_start) + interval '1 month')::date;
BEGIN
  SELECT n.nspname, c.relname INTO v_schema, v_short
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE c.oid = p_parent;

  -- Naming MUST match the explicit per-month partitions pre-created by the domain
  -- migrations (post/0131,0134,0135,0136 …) which use <parent>_YYYY_MM. The EXISTS
  -- check below keys on this name, so an exact match lets maintenance skip months
  -- already pre-created instead of colliding on an overlapping range.
  v_part_name := v_short || '_' || to_char(v_from, 'YYYY_MM');

  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relname = v_part_name AND n.nspname = v_schema
  ) THEN
    RETURN false;  -- already present
  END IF;

  EXECUTE format(
    'CREATE TABLE %I.%I PARTITION OF %s FOR VALUES FROM (%L) TO (%L)',
    v_schema, v_part_name, p_parent::text, v_from, v_to);

  -- Apply per-partition storage params (autovacuum tuning) registered for this
  -- parent. Partitioned parents cannot carry storage params, so every NEW child
  -- inherits them here. NULL = no overrides (server defaults).
  SELECT child_reloptions INTO v_reloptions
    FROM public.part_config WHERE parent_table = p_parent::text;
  IF v_reloptions IS NOT NULL AND length(btrim(v_reloptions)) > 0 THEN
    EXECUTE format('ALTER TABLE %I.%I SET (%s)', v_schema, v_part_name, v_reloptions);
  END IF;

  RETURN true;
END
$$;

-- Detach/drop monthly partitions whose UPPER bound <= p_cutoff.
-- p_keep_table=true → DETACH (archive at infra level, never purge: audit/DPDP).
-- p_keep_table=false → DROP.
CREATE OR REPLACE FUNCTION public.drop_old_partitions(
        p_parent regclass, p_cutoff timestamptz, p_keep_table boolean DEFAULT true)
  RETURNS integer
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  r            record;
  v_cnt        integer := 0;
  v_upper      text;
  v_upper_date date;
BEGIN
  FOR r IN
    SELECT n.nspname, c.relname,
           pg_get_expr(c.relpartbound, c.oid) AS bound
      FROM pg_inherits i
      JOIN pg_class c     ON c.oid = i.inhrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE i.inhparent = p_parent
  LOOP
    -- bound: FOR VALUES FROM ('2025-01-01') TO ('2025-02-01')
    v_upper := substring(r.bound from 'TO \(''([0-9-]+)''\)');
    CONTINUE WHEN v_upper IS NULL;
    v_upper_date := v_upper::date;
    IF v_upper_date <= p_cutoff::date THEN
      IF p_keep_table THEN
        EXECUTE format('ALTER TABLE %s DETACH PARTITION %I.%I',
                       p_parent::text, r.nspname, r.relname);
      ELSE
        EXECUTE format('DROP TABLE IF EXISTS %I.%I', r.nspname, r.relname);
      END IF;
      v_cnt := v_cnt + 1;
    END IF;
  END LOOP;
  RETURN v_cnt;
END
$$;

-- Provision current + premake future partitions for EVERY registered parent.
-- This is the native equivalent of partman.run_maintenance() and is called by
-- job_partition_provision() (0116). Returns the count of partitions created.
CREATE OR REPLACE FUNCTION public.run_partition_maintenance()
  RETURNS integer
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  r       record;
  i       integer;
  v_base  date := date_trunc('month', now())::date;
  v_made  integer := 0;
BEGIN
  FOR r IN SELECT * FROM public.part_config LOOP
    -- current month + `premake` future months (all parents are monthly)
    FOR i IN 0..r.premake LOOP
      IF public.ensure_month_partition(
           r.parent_table::regclass,
           (v_base + (i || ' months')::interval)::date) THEN
        v_made := v_made + 1;
      END IF;
    END LOOP;

    -- optional in-band retention (0116 also drives retention explicitly per table)
    IF r.retention IS NOT NULL THEN
      PERFORM public.drop_old_partitions(
        r.parent_table::regclass,
        now() - r.retention::interval,
        r.retention_keep_table);
    END IF;
  END LOOP;
  RETURN v_made;
END
$$;

-- Framework functions are operator/migration actions, not app actions.
REVOKE ALL ON FUNCTION public.ensure_month_partition(regclass, date)            FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.drop_old_partitions(regclass, timestamptz, boolean) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.run_partition_maintenance()                       FROM anon, authenticated;

-- =============================================================================
-- NOTES
-- • The application connection model on vanilla PG:
--     - Trusted server work (the Express API today): connect as service_role
--       (BYPASSRLS) or a superuser — RLS/FORCE-RLS is bypassed, matching the
--       prior Supabase service_role behaviour.
--     - Per-end-user enforcement (optional, future): connect as a login role
--       that is a member of `authenticated`, SET ROLE authenticated, and
--       SET LOCAL app.user_id = '<uuid>' so auth.uid() resolves and RLS applies.
-- • gen_random_uuid() is core (pg_catalog) in PG13+, so unqualified calls work
--   regardless of the extensions schema. PostgreSQL 18 also ships native
--   uuidv7(); UUIDv7 PKs remain app-generated per the pkV7() convention.
-- • pgcrypto/pg_trgm install into `extensions` (0001); digest() is therefore
--   schema-qualified as extensions.digest() (0121) and the trigram opclass as
--   extensions.gin_trgm_ops (0103/0106).
-- =============================================================================
