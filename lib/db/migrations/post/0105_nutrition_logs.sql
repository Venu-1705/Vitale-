-- =============================================================================
-- Vitalé — Post-table migration 0105: D4 nutrition_logs + nutrition_log_items — two
-- partitioned parents (parent meal log + child items), lockdown, IST partition-key trigger
-- (parent only), composite FK (Blocker 2), pg_partman provisioning (Phase 3). Implements
-- VITALE_DB_ARCHITECTURE §4 D4 (nutrition_logs lines 338-341, nutrition_log_items lines 343-348)
-- + §6 (partitioning) + VITALE_IMPLEMENTATION_SPEC Part 2 D4 (nutrition_logs line 334-335,
-- nutrition_log_items line 337-338) + Part 6 Phase 3 (line 1108: "...→ health_observations →
-- nutrition_logs/nutrition_log_items [partitioned, composite FK] → ...").
--
-- WHY RAW SQL (not Drizzle pgTables): both are [A, PARTITIONED] — Drizzle's pgTable cannot
-- express PARTITION BY RANGE (arch §6 line 613), and each PK is the composite (id,
-- logged_date_ist). The child→parent reference must be a COMPOSITE FK (Blocker 2): a plain
-- nutrition_log_id cannot reference a composite-PK range-partitioned parent in Postgres 12+.
-- Their only Drizzle-owned FK target is users (created in the generate/migrate step), so these
-- parents are authored here, after that step. (food_items/diet_charts/diet_chart_meals — the
-- three nullable provenance FKs on the child — are Phase 4; those FK constraints are DEFERRED.)
--
-- ORDERING: POST-TABLE companion. Apply order:
--   1. `pnpm db:raw`        → foundation 0001–0006: 0004 tg_set_logged_date_ist +
--      vitale_harden_new_partition event trigger (already lists 'nutrition_logs' AND
--      'nutrition_log_items'); 0006 provision_partition_parent() (pg_partman + hardened template)
--   2. `pnpm generate && pnpm migrate` → Drizzle creates users (the FK target)
--   3. `pnpm db:raw:post`   → 0104 (health_observations) → THIS file
--   (the 0006 header's inline "nutrition_logs/_items Ph4" note is stale; the authoritative Part 6
--    migration order, spec line 1108, places both in Phase 3 — right after health_observations.)
--
-- LOCKDOWN MODEL ("REVOKE-API", spec line 57 + 334-338): REVOKE ALL FROM anon, authenticated +
-- FORCE RLS. With NO policies yet, this is deny-all to PostgREST roles — the SAME interim
-- posture as health_observations (0104). Reads/writes reach these ONLY via service-role
-- (RLS-bypass) or future SECURITY-DEFINER rls_owner RPCs; no PostgREST path exists.
--
-- ⚠ SPEC/ARCH RECONCILIATION — nutrition_log_items partition key (owner-confirmed):
-- spec line 338 lists trigger `tg_set_logged_date_ist` for nutrition_log_items, but that setter
-- reads NEW.logged_at and arch lines 343-348 give the CHILD no logged_at column (only the PARENT
-- has logged_at, arch line 340). Attaching it would error on every child INSERT. Per Blocker 2
-- ("No new column required") and the owner decision, the CHILD gets NO logged_at and NO IST
-- trigger: the write path supplies the child's logged_date_ist = the parent row's
-- logged_date_ist, and the composite FK (nutrition_log_id, logged_date_ist) → nutrition_logs
-- structurally enforces that they match. tg_set_logged_date_ist IS attached to the PARENT
-- (nutrition_logs), which has logged_at. (Same trigger function as the parent; the child simply
-- inherits the already-computed key.)
--
-- DEFERRED to Phase 8 (cohesive RLS-policy unit — the SELECT predicate depends on
-- can_read_health()/admin_has_support_access(), whose bodies query access_grants / care_plans /
-- care_team_members / admin_support_access, none of which exist yet; OR branches are not
-- guaranteed to short-circuit, so adding them now would raise "relation does not exist" at query
-- time). The full policy set for BOTH tables is recorded verbatim at the foot of this file so the
-- Phase-8 author drops it in once the dependencies exist. The owner-only self policies are
-- self-contained but held back too, so the set lands as one reviewable unit and the tables stay
-- cleanly deny-all here (mirrors 0104 health_observations).
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS; DROP TRIGGER IF EXISTS; provisioning helper
-- is a no-op if already registered.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- PARENT: nutrition_logs — one meal-log row per logged meal. Columns per arch §4 D4
-- (lines 338-341); created_at is the universal system column (arch line 186 — "every table has
-- created_at ... even if not re-listed"). No updated_at: this is an append-oriented log (arch
-- omits it; the rare owner correction does not warrant a touch trigger — same posture as
-- health_observations in 0104). total_calories is a denormalized roll-up of the child items.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nutrition_logs (
  id               uuid        NOT NULL,
  logged_date_ist  date        NOT NULL,   -- partition key; set by trigger from logged_at (IST)
  user_id          uuid        NOT NULL REFERENCES public.users(id),
  logged_at        timestamptz NOT NULL,   -- the instant of the meal (source of logged_date_ist)
  meal_type        public.meal_type        NOT NULL,
  total_calories   numeric,                -- denorm roll-up of child items (nullable until summed)
  note             text,
  source           public.nutrition_source NOT NULL DEFAULT 'manual',
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, logged_date_ist)
) PARTITION BY RANGE (logged_date_ist);

-- Lockdown FIRST (before provisioning creates partitions): FORCE RLS + REVOKE so the parent —
-- and, via the hardened pg_partman template + the vitale_harden_new_partition event trigger,
-- every child partition — is born unreachable from PostgREST. No policies = deny-all interim.
ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_logs FORCE  ROW LEVEL SECURITY;
REVOKE ALL ON public.nutrition_logs FROM anon, authenticated;  -- RPC-only (no PostgREST path)

-- Partition-local read index (arch line 341; spec line 335). Created on the parent → cascades
-- to all current/future partitions (native partitioning).
CREATE INDEX IF NOT EXISTS nutrition_logs_user_date_idx
  ON public.nutrition_logs (user_id, logged_date_ist DESC);

-- IST partition-key trigger (tg_set_logged_date_ist from 0004): BEFORE INSERT OR UPDATE OF
-- logged_at, sets logged_date_ist = (logged_at AT TIME ZONE 'Asia/Kolkata')::date. Runs before
-- tuple routing (BEFORE-ROW), so callers need not supply the partition key. Parent only — the
-- child has no logged_at (see reconciliation note in the header).
DROP TRIGGER IF EXISTS nutrition_logs_set_date_ist ON public.nutrition_logs;
CREATE TRIGGER nutrition_logs_set_date_ist
  BEFORE INSERT OR UPDATE OF logged_at ON public.nutrition_logs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_logged_date_ist();

-- Register with pg_partman (monthly): premake=2, infinite, automatic maintenance, RLS-forced /
-- REVOKE-d template so partitions inherit the lockdown. No-op if already registered.
SELECT public.provision_partition_parent('public.nutrition_logs', 'logged_date_ist', '1 month');

-- ----------------------------------------------------------------------------
-- CHILD: nutrition_log_items — itemized lines of a meal (cross-program meal mixing). Columns
-- per arch §4 D4 (lines 343-348) + created_at (arch line 186). user_id is DENORMALIZED from the
-- parent purely so RLS can gate the child without joining to nutrition_logs (arch line 345).
-- No logged_at, NO IST trigger (owner-confirmed — see header): the partition key is supplied by
-- the write path = the parent row's logged_date_ist, and the composite FK enforces the match.
-- The three provenance FKs (food_item_id / source_diet_chart_id / source_meal_id) are plain
-- nullable uuid here; their FK constraints are DEFERRED to Phase 4 (targets land then).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nutrition_log_items (
  id                   uuid    NOT NULL,
  logged_date_ist      date    NOT NULL,   -- partition key; app supplies = parent's logged_date_ist
  nutrition_log_id     uuid    NOT NULL,   -- + logged_date_ist → composite FK to nutrition_logs
  user_id              uuid    NOT NULL REFERENCES public.users(id),  -- denorm for RLS (arch line 345)
  food_item_id         uuid,               -- → food_items (nullable); FK DEFERRED to Phase 4
  source_diet_chart_id uuid,               -- → diet_charts (nullable); FK DEFERRED to Phase 4
  source_meal_id       uuid,               -- → diet_chart_meals (nullable); FK DEFERRED to Phase 4
  name                 text,
  quantity_g           numeric,
  calories             numeric,
  protein_g            numeric,
  carbs_g              numeric,
  fat_g                numeric,
  created_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, logged_date_ist),
  -- composite FK required by Postgres partitioning rules: parent PK is (id, logged_date_ist)
  CONSTRAINT nutrition_log_items_log_fk
    FOREIGN KEY (nutrition_log_id, logged_date_ist)
    REFERENCES public.nutrition_logs (id, logged_date_ist)
) PARTITION BY RANGE (logged_date_ist);

-- DISCHARGED in 0106 (Phase 4): the three provenance FK constraints are added there, once their
-- targets exist (food_items / diet_charts / diet_chart_meals). NOTE: they are added plain/VALID,
-- NOT "NOT VALID then VALIDATE" — a FOREIGN KEY on a PARTITIONED table cannot be declared NOT
-- VALID in Postgres, and these tables are empty at build time, so a plain ADD is instant:
--   ALTER TABLE public.nutrition_log_items
--     ADD CONSTRAINT nutrition_log_items_food_item_fk
--       FOREIGN KEY (food_item_id) REFERENCES public.food_items(id),
--     ADD CONSTRAINT nutrition_log_items_diet_chart_fk
--       FOREIGN KEY (source_diet_chart_id) REFERENCES public.diet_charts(id),
--     ADD CONSTRAINT nutrition_log_items_meal_fk
--       FOREIGN KEY (source_meal_id) REFERENCES public.diet_chart_meals(id);

-- Lockdown FIRST (same posture as the parent): FORCE RLS + REVOKE → deny-all interim.
ALTER TABLE public.nutrition_log_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_log_items FORCE  ROW LEVEL SECURITY;
REVOKE ALL ON public.nutrition_log_items FROM anon, authenticated;  -- RPC-only (no PostgREST path)

-- Partition-local read index (arch line 348; spec line 338).
CREATE INDEX IF NOT EXISTS nutrition_log_items_user_date_idx
  ON public.nutrition_log_items (user_id, logged_date_ist DESC);

-- Register with pg_partman (monthly). No-op if already registered.
SELECT public.provision_partition_parent('public.nutrition_log_items', 'logged_date_ist', '1 month');

-- =============================================================================
-- DEFERRED (Phase 8 — drop in verbatim once can_read_health()/admin_has_support_access() are
-- backed by access_grants / care_plans / care_team_members / admin_support_access). Target RLS
-- from spec policy catalog (line 736): owner OR can_read_health(subject) OR
-- admin_has_support_access(subject) for SELECT; write = owner; UPDATE/DELETE owner only. There
-- is NO coach-entered INSERT path for nutrition (that exists only for health_observations). The
-- subject column is user_id on both tables (denormalized onto the child for exactly this gate).
--
--   CREATE POLICY nl_select ON public.nutrition_logs FOR SELECT TO authenticated
--     USING ( user_id = auth.uid()
--             OR (SELECT public.can_read_health(user_id))
--             OR (SELECT public.admin_has_support_access(user_id)) );
--   CREATE POLICY nl_insert_self ON public.nutrition_logs FOR INSERT TO authenticated
--     WITH CHECK ( user_id = auth.uid() );
--   CREATE POLICY nl_update_owner ON public.nutrition_logs FOR UPDATE TO authenticated
--     USING ( user_id = auth.uid() ) WITH CHECK ( user_id = auth.uid() );
--   CREATE POLICY nl_delete_owner ON public.nutrition_logs FOR DELETE TO authenticated
--     USING ( user_id = auth.uid() );
--
--   CREATE POLICY nli_select ON public.nutrition_log_items FOR SELECT TO authenticated
--     USING ( user_id = auth.uid()
--             OR (SELECT public.can_read_health(user_id))
--             OR (SELECT public.admin_has_support_access(user_id)) );
--   CREATE POLICY nli_insert_self ON public.nutrition_log_items FOR INSERT TO authenticated
--     WITH CHECK ( user_id = auth.uid() );
--   CREATE POLICY nli_update_owner ON public.nutrition_log_items FOR UPDATE TO authenticated
--     USING ( user_id = auth.uid() ) WITH CHECK ( user_id = auth.uid() );
--   CREATE POLICY nli_delete_owner ON public.nutrition_log_items FOR DELETE TO authenticated
--     USING ( user_id = auth.uid() );
--
-- Because both tables are REVOKE-API, these policies gate only the SECURITY-DEFINER rls_owner
-- read/write RPC path (and never PostgREST); they land together with that RPC unit in Phase 8.
-- =============================================================================
