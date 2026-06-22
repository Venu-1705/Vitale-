-- =============================================================================
-- Vitalé — Post-companion 0134: D4 nutrition_logs + nutrition_log_items — the APPLIED
-- nutrition-log DB layer (parents, explicit partitions, REVOKE-API lockdown, the deferred
-- nl_*/nli_* policy set now made live, the self-log INSERT grant, and the audited range-read
-- RPC). Implements VITALE_DB_ARCHITECTURE §4 D4 (nutrition_logs lines 338-341,
-- nutrition_log_items lines 343-348) + §6 (partitioning) + §7 (RLS, line 736 SELECT predicate:
-- owner OR can_read_health(subject) OR admin_has_support_access(subject)) + VITALE_IMPLEMENTATION_SPEC
-- Part 2 D4 (lines 334-338) + Part 6 (audited health-RPC fan-out).
--
-- WHY THIS FILE (relationship to 0105):
--   0105 is the CANONICAL authoring record for these two [A, PARTITIONED] parents, but it
--   registers them with pg_partman via provision_partition_parent() (foundation 0006). pg_partman
--   is NOT bundled with the EDB installer, so provision_partition_parent() is ABSENT from this
--   cluster — under the db:raw:post runner's ON_ERROR_STOP that call aborts 0105 (this is the same
--   D5-A substrate deviation already taken for health_observations: 0104 carries the provision
--   call; the APPLIED partition + policy layer was authored separately in 0131). 0134 is the
--   nutrition-log analogue of 0131: it creates the parents WITHOUT pg_partman and lays down
--   EXPLICIT monthly partitions, which the always-on vitale_harden_new_partition event trigger
--   (tg_harden_new_partition) auto-hardens (ENABLE + FORCE RLS + REVOKE) as each is created — so a
--   partition can never be born exposed. The verbatim deferred policy set at the foot of 0105 is
--   made live here (its dependencies — can_read_health / admin_has_support_access — now exist).
--
-- ORDERING: apply AFTER the Drizzle generate/migrate step (users + the 13 D3/D4 tables exist) and
-- BEFORE 0106 — 0106 discharges this file's three nutrition_log_items provenance FKs
-- (food_item_id → food_items, source_diet_chart_id → diet_charts, source_meal_id → diet_chart_meals)
-- and applies the D3/D4 catalog/plan RLS. Run: psql -v ON_ERROR_STOP=1 -f 0134 ; then 0106.
--
-- LOCKDOWN MODEL ("REVOKE-API", spec line 334-338): both tables are FORCE RLS + REVOKE ALL from
-- anon/authenticated. The CORE write surface this phase is the subject's OWN meal log: a single
-- GRANT INSERT to authenticated (parent + child), gated by the nl_insert_self / nli_insert_self
-- WITH CHECK (user_id = auth.uid()). No SELECT grant → reads are RPC-only (rpc_read_nutrition_logs
-- below); no UPDATE/DELETE grant → owner correction/delete is a future SECURITY-DEFINER RPC (D5-3
-- class: a WHERE-clause UPDATE/DELETE on a REVOKE-API table needs SELECT on the predicate columns).
-- The nl_update_owner / nl_delete_owner policies are laid down now (so the future RPC path is gated
-- the instant a grant is added) but carry no grant, so they are inert against PostgREST today.
--
-- ⚠ PARTITION-ROUTING TRAP (D5-1/D11-4 class): Postgres routes a tuple to its partition BEFORE
-- BEFORE-ROW triggers fire, so tg_set_logged_date_ist (attached to the PARENT) cannot populate the
-- partition key in time. The write path MUST supply logged_date_ist = (logged_at AT TIME ZONE
-- 'Asia/Kolkata')::date itself; the trigger is a no-op safety net (and the source of truth for an
-- UPDATE OF logged_at). The CHILD has no logged_at and no trigger: the write path supplies the
-- child's logged_date_ist = the parent row's, and the composite FK enforces the match (Blocker 2).
--
-- Idempotent: CREATE TABLE/INDEX/POLICY guarded (IF NOT EXISTS / DROP ... IF EXISTS); CREATE OR
-- REPLACE FUNCTION; grants re-runnable.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- PARENT: nutrition_logs — one meal-log row per logged meal (arch §4 D4 lines 338-341).
-- created_at is the universal system column (arch line 186); no updated_at (append-oriented log).
-- total_calories is a denorm roll-up of child items.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nutrition_logs (
  id               uuid        NOT NULL,
  logged_date_ist  date        NOT NULL,   -- partition key; write path supplies it (routing trap)
  user_id          uuid        NOT NULL REFERENCES public.users(id),
  logged_at        timestamptz NOT NULL,   -- the instant of the meal (source of logged_date_ist)
  meal_type        public.meal_type        NOT NULL,
  total_calories   numeric,                -- denorm roll-up of child items (nullable until summed)
  note             text,
  source           public.nutrition_source NOT NULL DEFAULT 'manual',
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, logged_date_ist)
) PARTITION BY RANGE (logged_date_ist);

-- Lockdown FIRST (before partitions exist): FORCE RLS + REVOKE → deny-all to PostgREST roles.
ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_logs FORCE  ROW LEVEL SECURITY;
REVOKE ALL ON public.nutrition_logs FROM anon, authenticated;

-- Partition-local read index (arch line 341; spec line 335) — cascades to all partitions.
CREATE INDEX IF NOT EXISTS nutrition_logs_user_date_idx
  ON public.nutrition_logs (user_id, logged_date_ist DESC);

-- IST partition-key trigger (no-op safety net; the write path supplies the key — see header).
DROP TRIGGER IF EXISTS nutrition_logs_set_date_ist ON public.nutrition_logs;
CREATE TRIGGER nutrition_logs_set_date_ist
  BEFORE INSERT OR UPDATE OF logged_at ON public.nutrition_logs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_logged_date_ist();

-- ----------------------------------------------------------------------------
-- CHILD: nutrition_log_items — itemized meal lines (arch §4 D4 lines 343-348). user_id is
-- DENORMALIZED from the parent so RLS gates the child without joining the parent (arch line 345).
-- No logged_at, no IST trigger: partition key supplied by the write path = parent's logged_date_ist,
-- enforced by the composite FK. The three provenance FKs are plain nullable uuid here; their FK
-- constraints are discharged in 0106 (targets land there).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nutrition_log_items (
  id                   uuid    NOT NULL,
  logged_date_ist      date    NOT NULL,   -- partition key; app supplies = parent's logged_date_ist
  nutrition_log_id     uuid    NOT NULL,   -- + logged_date_ist → composite FK to nutrition_logs
  user_id              uuid    NOT NULL REFERENCES public.users(id),  -- denorm for RLS (arch line 345)
  food_item_id         uuid,               -- → food_items (nullable); FK discharged in 0106
  source_diet_chart_id uuid,               -- → diet_charts (nullable); FK discharged in 0106
  source_meal_id       uuid,               -- → diet_chart_meals (nullable); FK discharged in 0106
  name                 text,
  quantity_g           numeric,
  calories             numeric,
  protein_g            numeric,
  carbs_g              numeric,
  fat_g                numeric,
  created_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, logged_date_ist),
  CONSTRAINT nutrition_log_items_log_fk
    FOREIGN KEY (nutrition_log_id, logged_date_ist)
    REFERENCES public.nutrition_logs (id, logged_date_ist)
) PARTITION BY RANGE (logged_date_ist);

ALTER TABLE public.nutrition_log_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_log_items FORCE  ROW LEVEL SECURITY;
REVOKE ALL ON public.nutrition_log_items FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS nutrition_log_items_user_date_idx
  ON public.nutrition_log_items (user_id, logged_date_ist DESC);

-- ----------------------------------------------------------------------------
-- EXPLICIT monthly partitions (D5-A: no pg_partman). Mirrors 0131's health_observations layout —
-- a 2025 full-year catch-all, the live 2026 monthly set, a 2027 full-year landing zone, and a
-- DEFAULT backstop. Each CREATE ... PARTITION OF fires vitale_harden_new_partition, which applies
-- ENABLE + FORCE RLS + REVOKE to the new partition (born unreachable from PostgREST).
-- ----------------------------------------------------------------------------
-- nutrition_logs partitions
CREATE TABLE IF NOT EXISTS public.nutrition_logs_2025 PARTITION OF public.nutrition_logs
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE IF NOT EXISTS public.nutrition_logs_2026_01 PARTITION OF public.nutrition_logs
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE IF NOT EXISTS public.nutrition_logs_2026_02 PARTITION OF public.nutrition_logs
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE IF NOT EXISTS public.nutrition_logs_2026_03 PARTITION OF public.nutrition_logs
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE IF NOT EXISTS public.nutrition_logs_2026_04 PARTITION OF public.nutrition_logs
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS public.nutrition_logs_2026_05 PARTITION OF public.nutrition_logs
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS public.nutrition_logs_2026_06 PARTITION OF public.nutrition_logs
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS public.nutrition_logs_2026_07 PARTITION OF public.nutrition_logs
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS public.nutrition_logs_2026_08 PARTITION OF public.nutrition_logs
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS public.nutrition_logs_2026_09 PARTITION OF public.nutrition_logs
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS public.nutrition_logs_2026_10 PARTITION OF public.nutrition_logs
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS public.nutrition_logs_2026_11 PARTITION OF public.nutrition_logs
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS public.nutrition_logs_2026_12 PARTITION OF public.nutrition_logs
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE IF NOT EXISTS public.nutrition_logs_2027 PARTITION OF public.nutrition_logs
  FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');
CREATE TABLE IF NOT EXISTS public.nutrition_logs_default PARTITION OF public.nutrition_logs DEFAULT;

-- nutrition_log_items partitions (same boundaries; composite FK requires matching logged_date_ist)
CREATE TABLE IF NOT EXISTS public.nutrition_log_items_2025 PARTITION OF public.nutrition_log_items
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE IF NOT EXISTS public.nutrition_log_items_2026_01 PARTITION OF public.nutrition_log_items
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE IF NOT EXISTS public.nutrition_log_items_2026_02 PARTITION OF public.nutrition_log_items
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE IF NOT EXISTS public.nutrition_log_items_2026_03 PARTITION OF public.nutrition_log_items
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE IF NOT EXISTS public.nutrition_log_items_2026_04 PARTITION OF public.nutrition_log_items
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS public.nutrition_log_items_2026_05 PARTITION OF public.nutrition_log_items
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS public.nutrition_log_items_2026_06 PARTITION OF public.nutrition_log_items
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS public.nutrition_log_items_2026_07 PARTITION OF public.nutrition_log_items
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS public.nutrition_log_items_2026_08 PARTITION OF public.nutrition_log_items
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS public.nutrition_log_items_2026_09 PARTITION OF public.nutrition_log_items
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS public.nutrition_log_items_2026_10 PARTITION OF public.nutrition_log_items
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS public.nutrition_log_items_2026_11 PARTITION OF public.nutrition_log_items
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS public.nutrition_log_items_2026_12 PARTITION OF public.nutrition_log_items
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE IF NOT EXISTS public.nutrition_log_items_2027 PARTITION OF public.nutrition_log_items
  FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');
CREATE TABLE IF NOT EXISTS public.nutrition_log_items_default PARTITION OF public.nutrition_log_items DEFAULT;

-- ----------------------------------------------------------------------------
-- RLS policies — the verbatim deferred set from 0105's foot, now live. SELECT/UPDATE/DELETE gate
-- the future SECURITY-DEFINER RPC path (no grant today); INSERT is the live self-log path (granted
-- below). Subject column is user_id on both tables. No coach-entered INSERT path for nutrition
-- (that exists only for health_observations).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS nl_select ON public.nutrition_logs;
CREATE POLICY nl_select ON public.nutrition_logs FOR SELECT TO authenticated
  USING ( user_id = auth.uid()
          OR (SELECT public.can_read_health(user_id))
          OR (SELECT public.admin_has_support_access(user_id)) );
DROP POLICY IF EXISTS nl_insert_self ON public.nutrition_logs;
CREATE POLICY nl_insert_self ON public.nutrition_logs FOR INSERT TO authenticated
  WITH CHECK ( user_id = auth.uid() );
DROP POLICY IF EXISTS nl_update_owner ON public.nutrition_logs;
CREATE POLICY nl_update_owner ON public.nutrition_logs FOR UPDATE TO authenticated
  USING ( user_id = auth.uid() ) WITH CHECK ( user_id = auth.uid() );
DROP POLICY IF EXISTS nl_delete_owner ON public.nutrition_logs;
CREATE POLICY nl_delete_owner ON public.nutrition_logs FOR DELETE TO authenticated
  USING ( user_id = auth.uid() );

DROP POLICY IF EXISTS nli_select ON public.nutrition_log_items;
CREATE POLICY nli_select ON public.nutrition_log_items FOR SELECT TO authenticated
  USING ( user_id = auth.uid()
          OR (SELECT public.can_read_health(user_id))
          OR (SELECT public.admin_has_support_access(user_id)) );
DROP POLICY IF EXISTS nli_insert_self ON public.nutrition_log_items;
CREATE POLICY nli_insert_self ON public.nutrition_log_items FOR INSERT TO authenticated
  WITH CHECK ( user_id = auth.uid() );
DROP POLICY IF EXISTS nli_update_owner ON public.nutrition_log_items;
CREATE POLICY nli_update_owner ON public.nutrition_log_items FOR UPDATE TO authenticated
  USING ( user_id = auth.uid() ) WITH CHECK ( user_id = auth.uid() );
DROP POLICY IF EXISTS nli_delete_owner ON public.nutrition_log_items;
CREATE POLICY nli_delete_owner ON public.nutrition_log_items FOR DELETE TO authenticated
  USING ( user_id = auth.uid() );

-- ----------------------------------------------------------------------------
-- Self-log write grant (CORE this phase). INSERT only: the subject logs their own meals (parent +
-- items in one tx). SELECT is RPC-only; UPDATE/DELETE await a future SECURITY-DEFINER correction
-- RPC (D5-3 class). Grant on the PARTITIONED PARENT is sufficient — INSERT via the parent checks
-- the parent's privilege; tuple routing to a (REVOKE-d) partition needs no privilege on the child.
-- ----------------------------------------------------------------------------
GRANT INSERT ON public.nutrition_logs       TO authenticated;
GRANT INSERT ON public.nutrition_log_items  TO authenticated;

-- =============================================================================
-- rpc_read_nutrition_logs — the audited READ path (sibling of rpc_read_health_observations /
-- rpc_list_lab_reports). nutrition_logs is REVOKE-API (no SELECT grant), so the ONLY read path is
-- this SECURITY DEFINER RPC owned by `v` (BYPASSRLS): the definer context reads the REVOKE-API
-- logs/items and INSERTs the FORCE-RLS coach_data_access_audit. Gate enforced on auth.uid().
--
-- Gate (frozen audit vocabulary — no 'self'/'coach'):
--   • SELF (p_subject = auth.uid()): own logs, NOT audited (D1).
--   • COACH (can_read_health(p_subject)): records the actor's real org role; ONE audit row.
--   • ADMIN (admin_has_support_access(p_subject)): break-glass; records the SUBJECT's org; ONE row.
--   • else: 42501 → rls_denied → 403.
-- The audit row is a range/inventory read → resource_id = NULL (nullable; see rpc_list_lab_reports),
-- resource_type = 'nutrition_log', action = 'view'. organization_id is NOT NULL: an unattributable
-- coach/admin read fails closed (the INSERT raises and the read rolls back).
--
-- Returns each log header + its items as a nested jsonb array (no separate item read path needed).
-- Optional [p_from, p_to] filter the partition key (logged_date_ist) inclusive.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.rpc_read_nutrition_logs(
  p_subject_user_id uuid,
  p_from            date DEFAULT NULL,
  p_to              date DEFAULT NULL
)
RETURNS TABLE (
  id              uuid,
  logged_date_ist date,
  user_id         uuid,
  logged_at       timestamptz,
  meal_type       text,
  total_calories  numeric,
  note            text,
  source          text,
  created_at      timestamptz,
  items           jsonb
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_caller    uuid := auth.uid();
  v_acting_as public.audit_acting_as;
  v_org_id    uuid;
  v_role      public.member_role;
  v_is_self   boolean := (auth.uid() = p_subject_user_id);
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'rpc_read_nutrition_logs: no caller identity' USING ERRCODE = '42501';
  END IF;

  -- ---- Gate (mirrors rpc_read_health_observations). ----------------------------------------
  IF v_is_self THEN
    NULL;  -- self read: permitted, not audited (D1).
  ELSIF public.can_read_health(p_subject_user_id) THEN
    SELECT m.organization_id, m.member_role INTO v_org_id, v_role
      FROM public.organization_members m
      JOIN public.access_grants g
        ON g.organization_id = m.organization_id
       AND g.user_id = p_subject_user_id
       AND g.status  = 'active'
     WHERE m.user_id = v_caller AND m.status = 'active'
     LIMIT 1;
    IF v_org_id IS NULL THEN
      SELECT organization_id, member_role INTO v_org_id, v_role
        FROM public.organization_members
       WHERE user_id = v_caller AND status = 'active'
       LIMIT 1;
    END IF;
    v_acting_as := COALESCE(v_role::text::public.audit_acting_as, 'owner_coach');
  ELSIF public.admin_has_support_access(p_subject_user_id) THEN
    v_acting_as := 'admin';
    SELECT g.organization_id INTO v_org_id
      FROM public.access_grants g
     WHERE g.user_id = p_subject_user_id AND g.status = 'active'
     ORDER BY g.created_at DESC LIMIT 1;
    IF v_org_id IS NULL THEN
      SELECT cp.organization_id INTO v_org_id
        FROM public.care_plans cp
       WHERE cp.user_id = p_subject_user_id AND cp.status = 'active'
       ORDER BY cp.created_at DESC LIMIT 1;
    END IF;
  ELSE
    RAISE EXCEPTION 'rpc_read_nutrition_logs: access denied for caller % on subject %',
      v_caller, p_subject_user_id USING ERRCODE = '42501';
  END IF;

  -- ---- In-tx audit for coach/admin read (skipped for self; rolls back if the read fails). --
  IF NOT v_is_self THEN
    INSERT INTO public.coach_data_access_audit
      (id, accessed_at, organization_id, accessor_user_id, data_subject_user_id,
       acting_as, resource_type, resource_id, action, calendar_day_ist)
    VALUES
      (gen_random_uuid(), now(), v_org_id, v_caller, p_subject_user_id,
       v_acting_as, 'nutrition_log', NULL, 'view',
       (now() AT TIME ZONE 'Asia/Kolkata')::date);
  END IF;

  -- ---- Return each log header + its items (nested jsonb). -----------------------------------
  RETURN QUERY
  SELECT nl.id, nl.logged_date_ist, nl.user_id, nl.logged_at,
         nl.meal_type::text, nl.total_calories, nl.note, nl.source::text, nl.created_at,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
                    'id',                   i.id,
                    'name',                 i.name,
                    'food_item_id',         i.food_item_id,
                    'source_diet_chart_id', i.source_diet_chart_id,
                    'source_meal_id',       i.source_meal_id,
                    'quantity_g',           i.quantity_g,
                    'calories',             i.calories,
                    'protein_g',            i.protein_g,
                    'carbs_g',              i.carbs_g,
                    'fat_g',                i.fat_g)
                  ORDER BY i.created_at)
             FROM public.nutrition_log_items i
            WHERE i.nutrition_log_id = nl.id
              AND i.logged_date_ist  = nl.logged_date_ist
         ), '[]'::jsonb) AS items
    FROM public.nutrition_logs nl
   WHERE nl.user_id = p_subject_user_id
     AND (p_from IS NULL OR nl.logged_date_ist >= p_from)
     AND (p_to   IS NULL OR nl.logged_date_ist <= p_to)
   ORDER BY nl.logged_at DESC;
END;
$$;

-- Gate is enforced on auth.uid() inside the body → safe to grant to authenticated.
REVOKE ALL ON FUNCTION public.rpc_read_nutrition_logs(uuid, date, date) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rpc_read_nutrition_logs(uuid, date, date) TO authenticated;
