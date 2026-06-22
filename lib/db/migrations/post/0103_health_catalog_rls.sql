-- =============================================================================
-- Vitalé — Post-table migration 0103: D5 metric_definitions catalog — pg_trgm, RLS, grants,
-- touch trigger (Phase 3). Implements VITALE_IMPLEMENTATION_SPEC Part 2 D5 (metric_definitions
-- line 344-345: "RLS-ON; SELECT public; write = admins only (PostgREST-exposed read)"; GIN
-- pg_trgm on display_name) + policy catalog line 737 (public read | ADMIN write | ADMIN
-- delete) + VITALE_DB_ARCHITECTURE §4 D5 / §5 (pg_trgm) / §7.
--
-- ORDERING: POST-TABLE companion. Apply order:
--   1. `pnpm db:raw`        → foundation 0001–0006 (0001 installs pg_trgm WITH SCHEMA
--      extensions; 0004 tg_touch_updated_at; 0005 is_admin)
--   2. `pnpm generate && pnpm migrate` → Drizzle creates metric_definitions (health.ts) —
--      columns + UNIQUE(code) + (category) btree indexes
--   3. `pnpm db:raw:post`   → THIS file: GIN pg_trgm index, RLS enable, grants, policies, trigger
--
-- metric_definitions is a LOW-SENSITIVITY PUBLIC CATALOG (no PHI), so RLS is ENABLE (not
-- FORCE) and it is PostgREST-exposed: SELECT granted to anon + authenticated; write is
-- admin-only (is_admin from 0005). This is the first public-read catalog wired in the
-- new-model build, so it establishes the anon-SELECT pattern (cf. the REVOKE-from-anon pattern
-- used by partitioned/PHI tables in 0006).
--
-- DEFERRED to the next Phase-3 companion (health_observations is PARTITIONED + REVOKE-API, so
-- it cannot be a Drizzle table and is authored in raw SQL): the partitioned parent + monthly
-- partitions, REVOKE ALL FROM anon/authenticated, RLS-FORCE policies (owner OR
-- can_read_health(subject) OR admin_has_support_access; INSERT owner OR coach with
-- view_client_health + active grant), tg_set_measured_date_ist, and rpc_read_health_observations
-- (in-tx audit). metric_definitions is its FK target, so it must exist first — hence this file.
--
-- Idempotent: CREATE INDEX IF NOT EXISTS; DROP ... IF EXISTS before CREATE TRIGGER/POLICY.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- GIN pg_trgm index on display_name (fuzzy metric search). The opclass is schema-qualified:
-- pg_trgm was installed WITH SCHEMA extensions (0001), and no session search_path includes
-- `extensions`, so a bare `gin_trgm_ops` would not resolve. arch §9: trgm indexes are
-- raw-owned (Drizzle declares only the btree UNIQUE(code)/(category) indexes in health.ts).
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS metric_definitions_display_name_trgm_idx
  ON public.metric_definitions USING gin (display_name extensions.gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- Trigger attachment: touch updated_at (tg_touch_updated_at from 0004).
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS metric_definitions_touch ON public.metric_definitions;
CREATE TRIGGER metric_definitions_touch BEFORE UPDATE ON public.metric_definitions
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ----------------------------------------------------------------------------
-- RLS: ENABLE (public catalog, no PHI → not FORCE). Grant DML so PostgREST can reach it:
-- SELECT to anon + authenticated (public read); write to authenticated (admin-gated by policy).
-- ----------------------------------------------------------------------------
ALTER TABLE public.metric_definitions ENABLE ROW LEVEL SECURITY;

GRANT SELECT                 ON public.metric_definitions TO anon, authenticated; -- public catalog read
GRANT INSERT, UPDATE, DELETE ON public.metric_definitions TO authenticated;       -- admins only (policy-gated)

-- ----------------------------------------------------------------------------
-- Policies. Public read (anon + authenticated); admin-only write/delete.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS metric_definitions_select_public ON public.metric_definitions;
CREATE POLICY metric_definitions_select_public ON public.metric_definitions FOR SELECT TO anon, authenticated
  USING (true); -- whole catalog is public; consumers filter is_active in-query

DROP POLICY IF EXISTS metric_definitions_insert_admin ON public.metric_definitions;
CREATE POLICY metric_definitions_insert_admin ON public.metric_definitions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS metric_definitions_update_admin ON public.metric_definitions;
CREATE POLICY metric_definitions_update_admin ON public.metric_definitions FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS metric_definitions_delete_admin ON public.metric_definitions;
CREATE POLICY metric_definitions_delete_admin ON public.metric_definitions FOR DELETE TO authenticated
  USING (public.is_admin()); -- FK from health_observations blocks deleting a referenced metric; prefer is_active=false
