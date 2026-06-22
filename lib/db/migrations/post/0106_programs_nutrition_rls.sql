-- =============================================================================
-- Vitalé — Post-table migration 0106: D3 Programs & D4 Nutrition (catalog/plan half) —
-- RLS, grants, policies, touch/immutability/business triggers, the now-unblocked
-- nutrition_log_items provenance FKs, and the food_items trgm index (Phase 4).
-- Implements VITALE_IMPLEMENTATION_SPEC Part 2 D3 (lines 278-307) + D4 (lines 311-332) +
-- Part 4 §4.1/§4.5 (triggers) + Part 6 Phase 4 (line 1113) + VITALE_DB_ARCHITECTURE §4
-- D3/D4, §5 (pg_trgm), §7 (RLS).
--
-- ORDERING: POST-TABLE companion. Apply order:
--   1. `pnpm db:raw`        → foundation 0001-0006 (0004 tg_touch_updated_at /
--      tg_block_update_delete; 0005 is_admin / is_org_member / has_capability /
--      org_has_active_grant / can_read_health / admin_has_support_access)
--   2. `pnpm generate && pnpm migrate` → Drizzle creates the 13 D3/D4 tables
--      (programs.ts, nutrition.ts) — columns, FKs, btree/partial-unique indexes
--   3. `pnpm db:raw:post`   → 0101..0105 → THIS file (the targets of the 3 nutrition-log
--      FKs — food_items / diet_charts / diet_chart_meals — now exist, so 0105's deferred
--      FK TODO is discharged here)
--
-- SCOPE SPLIT (what lands now vs is deferred):
--   IMPLEMENTED (dependencies satisfied + behavior fully specified):
--     • tg_touch_updated_at on the 9 mutable [A]/[C] tables.
--     • IMMUT-BLOCK (tg_block_update_delete) on program_versions + diet_chart_versions
--       (§4.1 line 821-823 names both).
--     • tg_no_edit_while_enrolled on programs (pseudocode: spec line 1002).
--     • tg_rollup_progress on session_watches (spec line 1036: recompute progress_pct).
--     • RLS enable/FORCE + grants + policies for all 13 tables, using only 0005 helpers
--       whose backing tables already exist (is_admin, is_active_org_member, is_org_member,
--       has_capability). Public/self/org/capability branches are written; grant-bearing
--       branches are deferred (see below).
--     • the 3 nutrition_log_items provenance FKs (→ food_items / diet_charts / diet_chart_meals).
--     • GIN pg_trgm on food_items.name (arch §9: trgm indexes are raw-owned).
--   DEFERRED — version-snapshot triggers (tg_bump_program_version, tg_bump_dietchart_version):
--     the spec specifies only the fire moment ("on publish") and the snapshot *contents*
--     ("program + modules + sessions at publish"), NOT the snapshot JSON contract, the
--     version_number ↔ current_version increment protocol, or the actor/change_summary
--     source. They INSERT the append-only [B] *_versions tables, where a guessed shape is
--     permanent (no UPDATE/DELETE). They pair with the publish/assign RPC (not yet built).
--     Recorded verbatim at the foot of this file; emit once the snapshot contract is pinned.
--   DEFERRED to Phase 8 (new-shape access_grants + tg_audit_grant_change land then):
--     tg_enrollment_grant / tg_enrollment_complete_cascade (program_enrollments),
--     tg_assignment_grant / tg_assignment_end_cascade (diet_chart_assignments), the
--     grant-bearing org-member SELECT branches on program_enrollments / session_watches /
--     diet_chart_assignments, and the coach (org-member) write path for diet_chart_assignments
--     (its INSERT fires tg_assignment_grant, so policy + trigger land as one unit).
--   DEFERRED to Phase 5 (plan_limits + coach_subscriptions land then):
--     tg_enforce_plan_limit on programs / diet_charts / active program_enrollments (spec line 1004).
--
-- Idempotent: CREATE OR REPLACE; CREATE INDEX IF NOT EXISTS; DROP ... IF EXISTS before
-- CREATE TRIGGER/POLICY; guarded ADD CONSTRAINT.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Companion-local read/manage helpers. SECURITY DEFINER (owned by the migration role, which
-- has BYPASSRLS) so a policy that calls them does not re-trigger the referenced tables' RLS
-- (avoids recursion + lets a child read inherit the parent's visibility). Same posture as
-- is_active_org_member in 0101. All referenced tables (programs, program_enrollments,
-- diet_charts, diet_chart_assignments, recipes) exist by step 2, so no body-check disable.
-- ----------------------------------------------------------------------------

-- programs SELECT predicate (spec line 280: public/enrolled + org members). Reused by
-- program_versions/_modules/_sessions ("inherit program read").
CREATE OR REPLACE FUNCTION public.can_read_program(p_program uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.programs pr
    WHERE pr.id = p_program
      AND ( public.is_active_org_member(pr.organization_id)
            OR (pr.status = 'published' AND pr.visibility = 'public')
            OR EXISTS (SELECT 1 FROM public.program_enrollments e
                       WHERE e.program_id = pr.id AND e.user_id = auth.uid()
                         AND e.status = 'active')));
$$;

-- write gate for program child tables that carry program_id but not organization_id
-- (program_modules/_sessions, spec lines 293/296: write = manage_programs).
CREATE OR REPLACE FUNCTION public.can_manage_program(p_program uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.programs pr
    WHERE pr.id = p_program AND public.is_org_member(pr.organization_id, 'manage_programs'));
$$;

-- diet_charts SELECT predicate (spec line 323: org members + assigned customers). Reused by
-- diet_chart_meals ("as chart") and diet_chart_versions ("same readers as parent").
CREATE OR REPLACE FUNCTION public.can_read_diet_chart(p_chart uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.diet_charts dc
    WHERE dc.id = p_chart
      AND ( public.is_active_org_member(dc.organization_id)
            OR EXISTS (SELECT 1 FROM public.diet_chart_assignments a
                       WHERE a.diet_chart_id = dc.id AND a.user_id = auth.uid()
                         AND a.status = 'active')));
$$;

-- write gate for diet_chart_meals (spec line 326: as chart → write = manage_diet_charts).
CREATE OR REPLACE FUNCTION public.can_manage_diet_chart(p_chart uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.diet_charts dc
    WHERE dc.id = p_chart AND public.is_org_member(dc.organization_id, 'manage_diet_charts'));
$$;

-- recipes SELECT predicate (spec line 317: public when is_public else org members + author).
-- Reused by recipe_ingredients ("as recipe").
CREATE OR REPLACE FUNCTION public.can_read_recipe(p_recipe uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.recipes r
    WHERE r.id = p_recipe
      AND ( r.is_public
            OR r.created_by_user_id = auth.uid()
            OR (r.organization_id IS NOT NULL AND public.is_active_org_member(r.organization_id))));
$$;

-- write gate for recipe_ingredients (spec line 320: as recipe → write = author/org).
CREATE OR REPLACE FUNCTION public.can_manage_recipe(p_recipe uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.recipes r
    WHERE r.id = p_recipe
      AND ( r.created_by_user_id = auth.uid()
            OR (r.organization_id IS NOT NULL AND public.is_active_org_member(r.organization_id))));
$$;

GRANT EXECUTE ON FUNCTION
  public.can_read_program(uuid),
  public.can_manage_program(uuid),
  public.can_read_diet_chart(uuid),
  public.can_manage_diet_chart(uuid),
  public.can_read_recipe(uuid),
  public.can_manage_recipe(uuid)
TO authenticated;

-- ----------------------------------------------------------------------------
-- Business triggers (defined here; attached below).
-- ----------------------------------------------------------------------------

-- tg_no_edit_while_enrolled — programs (spec line 1002 / table line 280-282): block content
-- edits while ≥1 active enrollment exists. "Content" = the learner-facing program definition
-- on the programs row: title, description, cover_asset_id, duration_days. Commercial/lifecycle
-- columns (price_paise, currency, status, visibility, published_at, current_version,
-- max_enrollments, updated_at) are intentionally NOT frozen — publishing, archiving, re-pricing,
-- and cap changes must remain possible mid-cohort. (Module/session content is authored on the
-- child tables; this guard mirrors the spec, which attaches the trigger to programs only.)
-- SECURITY DEFINER (owned by the BYPASSRLS migration role): the editor is a manage_programs coach,
-- NOT the enrolled customer, so under program_enrollments' FORCE RLS an INVOKER read would see
-- zero rows and the freeze would never fire. DEFINER lets the existence test see all enrollments.
CREATE OR REPLACE FUNCTION public.tg_no_edit_while_enrolled() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF ( NEW.title          IS DISTINCT FROM OLD.title
       OR NEW.description    IS DISTINCT FROM OLD.description
       OR NEW.cover_asset_id IS DISTINCT FROM OLD.cover_asset_id
       OR NEW.duration_days  IS DISTINCT FROM OLD.duration_days )
     AND EXISTS (SELECT 1 FROM public.program_enrollments e
                 WHERE e.program_id = NEW.id AND e.status = 'active') THEN
    RAISE EXCEPTION 'program % content is frozen while an active enrollment exists', NEW.id
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

-- tg_rollup_progress — session_watches (spec line 1036): recompute the enrolling row's
-- progress_pct = completed sessions / total sessions in the program, clamped to [0,100].
-- SECURITY DEFINER: a learner's session_watch write must update program_enrollments
-- (FORCE-RLS, no learner UPDATE grant) and count program_sessions regardless of their RLS.
CREATE OR REPLACE FUNCTION public.tg_rollup_progress() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_enrollment uuid := COALESCE(NEW.enrollment_id, OLD.enrollment_id);
  v_program    uuid;
  v_total      integer;
  v_done       integer;
BEGIN
  SELECT e.program_id INTO v_program FROM public.program_enrollments e WHERE e.id = v_enrollment;
  IF v_program IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT count(*) INTO v_total FROM public.program_sessions s WHERE s.program_id = v_program;
  SELECT count(*) INTO v_done  FROM public.session_watches w
    WHERE w.enrollment_id = v_enrollment AND w.completed = true;
  UPDATE public.program_enrollments
     SET progress_pct = CASE WHEN v_total > 0
                             THEN LEAST(100, round(100.0 * v_done / v_total))::smallint
                             ELSE 0 END
   WHERE id = v_enrollment;
  RETURN COALESCE(NEW, OLD);
END $$;

-- ----------------------------------------------------------------------------
-- Trigger attachments.
-- ----------------------------------------------------------------------------

-- content-freeze (BEFORE UPDATE; body compares the content columns and gates on active enrollment)
DROP TRIGGER IF EXISTS programs_no_edit_while_enrolled ON public.programs;
CREATE TRIGGER programs_no_edit_while_enrolled BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.tg_no_edit_while_enrolled();

-- progress roll-up (AFTER INSERT OR UPDATE on session_watches)
DROP TRIGGER IF EXISTS session_watches_rollup_progress ON public.session_watches;
CREATE TRIGGER session_watches_rollup_progress AFTER INSERT OR UPDATE ON public.session_watches
  FOR EACH ROW EXECUTE FUNCTION public.tg_rollup_progress();

-- IMMUT-BLOCK (append-only [B]): block UPDATE/DELETE on the two version tables (§4.1).
DROP TRIGGER IF EXISTS program_versions_immutable ON public.program_versions;
CREATE TRIGGER program_versions_immutable BEFORE UPDATE OR DELETE ON public.program_versions
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_update_delete();
DROP TRIGGER IF EXISTS diet_chart_versions_immutable ON public.diet_chart_versions;
CREATE TRIGGER diet_chart_versions_immutable BEFORE UPDATE OR DELETE ON public.diet_chart_versions
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_update_delete();

-- touch updated_at (tg_touch_updated_at from 0004) on every D3/D4 table that has updated_at.
-- Excluded: program_versions / diet_chart_versions (immutable, created_at-only) and the
-- trigger-less children recipe_ingredients / diet_chart_meals (created_at-only).
DROP TRIGGER IF EXISTS programs_touch ON public.programs;
CREATE TRIGGER programs_touch BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS program_modules_touch ON public.program_modules;
CREATE TRIGGER program_modules_touch BEFORE UPDATE ON public.program_modules
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS program_sessions_touch ON public.program_sessions;
CREATE TRIGGER program_sessions_touch BEFORE UPDATE ON public.program_sessions
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS program_enrollments_touch ON public.program_enrollments;
CREATE TRIGGER program_enrollments_touch BEFORE UPDATE ON public.program_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS session_watches_touch ON public.session_watches;
CREATE TRIGGER session_watches_touch BEFORE UPDATE ON public.session_watches
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS food_items_touch ON public.food_items;
CREATE TRIGGER food_items_touch BEFORE UPDATE ON public.food_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS recipes_touch ON public.recipes;
CREATE TRIGGER recipes_touch BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS diet_charts_touch ON public.diet_charts;
CREATE TRIGGER diet_charts_touch BEFORE UPDATE ON public.diet_charts
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS diet_chart_assignments_touch ON public.diet_chart_assignments;
CREATE TRIGGER diet_chart_assignments_touch BEFORE UPDATE ON public.diet_chart_assignments
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ----------------------------------------------------------------------------
-- Discharge 0105's deferred nutrition_log_items provenance FKs (targets now exist).
-- NOTE: these supersede 0105's "NOT VALID then VALIDATE" TODO — a FOREIGN KEY on a PARTITIONED
-- table cannot be declared NOT VALID in Postgres, and the tables are empty at build time, so the
-- constraints are added plain/VALID (instant, no scan). nutrition_log_items is partitioned, so
-- each constraint cascades to all current/future partitions. Guarded for idempotency.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nutrition_log_items_food_item_fk') THEN
    ALTER TABLE public.nutrition_log_items
      ADD CONSTRAINT nutrition_log_items_food_item_fk
      FOREIGN KEY (food_item_id) REFERENCES public.food_items(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nutrition_log_items_diet_chart_fk') THEN
    ALTER TABLE public.nutrition_log_items
      ADD CONSTRAINT nutrition_log_items_diet_chart_fk
      FOREIGN KEY (source_diet_chart_id) REFERENCES public.diet_charts(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nutrition_log_items_meal_fk') THEN
    ALTER TABLE public.nutrition_log_items
      ADD CONSTRAINT nutrition_log_items_meal_fk
      FOREIGN KEY (source_meal_id) REFERENCES public.diet_chart_meals(id);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- GIN pg_trgm on food_items.name (fuzzy food search; spec line 314). Schema-qualified opclass:
-- pg_trgm is installed WITH SCHEMA extensions (0001) and no search_path includes `extensions`,
-- so a bare gin_trgm_ops would not resolve. arch §9: trgm indexes are raw-owned (food_items.ts
-- declares only the (category) btree).
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS food_items_name_trgm_idx
  ON public.food_items USING gin (name extensions.gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- RLS: enable; FORCE the [C]/[B] tables that the spec marks RLS-FORCE (program_versions,
-- program_enrollments, session_watches, diet_chart_assignments, diet_chart_versions). The
-- RLS-ON catalog/plan tables are ENABLE-only (public/org reads via PostgREST).
-- ----------------------------------------------------------------------------
ALTER TABLE public.programs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_versions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_versions        FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.program_modules         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_enrollments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_enrollments     FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.session_watches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_watches         FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.food_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_charts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_chart_meals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_chart_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_chart_assignments  FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.diet_chart_versions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_chart_versions     FORCE  ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Grants (PostgREST reachability; policies below do row filtering). food_items is a public
-- catalog → SELECT to anon. The FORCE tables whose writes happen via RPC/trigger get SELECT
-- only (program_versions, program_enrollments, diet_chart_assignments, diet_chart_versions);
-- session_watches gets self INSERT/UPDATE. Authoring children get full DML; [A] parents get no
-- DELETE (lifecycle via status / referenced by children).
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE         ON public.programs               TO authenticated;
GRANT SELECT                         ON public.program_versions       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_modules        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_sessions       TO authenticated;
GRANT SELECT                         ON public.program_enrollments    TO authenticated; -- writes via purchase RPC (Phase 5)
GRANT SELECT, INSERT, UPDATE         ON public.session_watches        TO authenticated;
GRANT SELECT                         ON public.food_items             TO anon, authenticated; -- public catalog read
GRANT INSERT, UPDATE                 ON public.food_items             TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.recipes                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_ingredients     TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.diet_charts            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diet_chart_meals       TO authenticated;
GRANT SELECT                         ON public.diet_chart_assignments TO authenticated; -- coach write path → Phase 8
GRANT SELECT                         ON public.diet_chart_versions    TO authenticated;

-- ----------------------------------------------------------------------------
-- Policies (TO authenticated unless a public catalog). DROP IF EXISTS first for idempotency.
-- ----------------------------------------------------------------------------

-- programs: public(published+public) / enrolled / org members read; manage_programs write.
DROP POLICY IF EXISTS programs_select ON public.programs;
CREATE POLICY programs_select ON public.programs FOR SELECT TO authenticated
  USING ( public.is_admin()
          OR public.is_active_org_member(organization_id)
          OR (status = 'published' AND visibility = 'public')
          OR EXISTS (SELECT 1 FROM public.program_enrollments e
                     WHERE e.program_id = programs.id AND e.user_id = auth.uid()
                       AND e.status = 'active') );
DROP POLICY IF EXISTS programs_insert ON public.programs;
CREATE POLICY programs_insert ON public.programs FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, 'manage_programs'));
DROP POLICY IF EXISTS programs_update ON public.programs;
CREATE POLICY programs_update ON public.programs FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, 'manage_programs'))
  WITH CHECK (public.is_org_member(organization_id, 'manage_programs')); -- content-freeze: tg_no_edit_while_enrolled

-- program_versions: same readers as parent; append-only (insert via publish flow, IMMUT-BLOCK).
DROP POLICY IF EXISTS program_versions_select ON public.program_versions;
CREATE POLICY program_versions_select ON public.program_versions FOR SELECT TO authenticated
  USING (public.is_admin() OR public.can_read_program(program_id));

-- program_modules: inherit program read; manage_programs write.
DROP POLICY IF EXISTS program_modules_select ON public.program_modules;
CREATE POLICY program_modules_select ON public.program_modules FOR SELECT TO authenticated
  USING (public.is_admin() OR public.can_read_program(program_id));
DROP POLICY IF EXISTS program_modules_insert ON public.program_modules;
CREATE POLICY program_modules_insert ON public.program_modules FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_program(program_id));
DROP POLICY IF EXISTS program_modules_update ON public.program_modules;
CREATE POLICY program_modules_update ON public.program_modules FOR UPDATE TO authenticated
  USING (public.can_manage_program(program_id)) WITH CHECK (public.can_manage_program(program_id));
DROP POLICY IF EXISTS program_modules_delete ON public.program_modules;
CREATE POLICY program_modules_delete ON public.program_modules FOR DELETE TO authenticated
  USING (public.can_manage_program(program_id));

-- program_sessions: inherit program read; manage_programs write (program_id is denormalized).
DROP POLICY IF EXISTS program_sessions_select ON public.program_sessions;
CREATE POLICY program_sessions_select ON public.program_sessions FOR SELECT TO authenticated
  USING (public.is_admin() OR public.can_read_program(program_id));
DROP POLICY IF EXISTS program_sessions_insert ON public.program_sessions;
CREATE POLICY program_sessions_insert ON public.program_sessions FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_program(program_id));
DROP POLICY IF EXISTS program_sessions_update ON public.program_sessions;
CREATE POLICY program_sessions_update ON public.program_sessions FOR UPDATE TO authenticated
  USING (public.can_manage_program(program_id)) WITH CHECK (public.can_manage_program(program_id));
DROP POLICY IF EXISTS program_sessions_delete ON public.program_sessions;
CREATE POLICY program_sessions_delete ON public.program_sessions FOR DELETE TO authenticated
  USING (public.can_manage_program(program_id));

-- program_enrollments: enrolled user reads own. Writes via purchase RPC (Phase 5).
-- TODO(Phase 8): add grant-bearing org-member read branch — org member of enrollment's org with
--   an active access_grant on 'programs' for user_id (org_has_active_grant(organization_id,
--   user_id, 'programs')); arrives with new-shape access_grants.
DROP POLICY IF EXISTS program_enrollments_select_self ON public.program_enrollments;
CREATE POLICY program_enrollments_select_self ON public.program_enrollments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- session_watches: self read/write. (TODO Phase 8: grant-bearing org-member read branch.)
DROP POLICY IF EXISTS session_watches_select_self ON public.session_watches;
CREATE POLICY session_watches_select_self ON public.session_watches FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS session_watches_insert_self ON public.session_watches;
CREATE POLICY session_watches_insert_self ON public.session_watches FOR INSERT TO authenticated
  WITH CHECK ( user_id = auth.uid()
               AND EXISTS (SELECT 1 FROM public.program_enrollments e
                           WHERE e.id = enrollment_id AND e.user_id = auth.uid()) );
DROP POLICY IF EXISTS session_watches_update_self ON public.session_watches;
CREATE POLICY session_watches_update_self ON public.session_watches FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- food_items: public catalog read; admin (any source) or self (source user/coach) write.
DROP POLICY IF EXISTS food_items_select_public ON public.food_items;
CREATE POLICY food_items_select_public ON public.food_items FOR SELECT TO anon, authenticated
  USING (true);
DROP POLICY IF EXISTS food_items_insert ON public.food_items;
CREATE POLICY food_items_insert ON public.food_items FOR INSERT TO authenticated
  WITH CHECK ( public.is_admin()
               OR (source IN ('user','coach') AND created_by_user_id = auth.uid()) ); -- 'system' ⇒ admin only
DROP POLICY IF EXISTS food_items_update ON public.food_items;
CREATE POLICY food_items_update ON public.food_items FOR UPDATE TO authenticated
  USING ( public.is_admin()
          OR (source IN ('user','coach') AND created_by_user_id = auth.uid()) )
  WITH CHECK ( public.is_admin()
               OR (source IN ('user','coach') AND created_by_user_id = auth.uid()) );

-- recipes: public when is_public else org members + author read; author/org write.
DROP POLICY IF EXISTS recipes_select ON public.recipes;
CREATE POLICY recipes_select ON public.recipes FOR SELECT TO authenticated
  USING ( public.is_admin()
          OR is_public
          OR created_by_user_id = auth.uid()
          OR (organization_id IS NOT NULL AND public.is_active_org_member(organization_id)) );
DROP POLICY IF EXISTS recipes_insert ON public.recipes;
CREATE POLICY recipes_insert ON public.recipes FOR INSERT TO authenticated
  WITH CHECK ( created_by_user_id = auth.uid()
               AND (organization_id IS NULL OR public.is_active_org_member(organization_id)) );
DROP POLICY IF EXISTS recipes_update ON public.recipes;
CREATE POLICY recipes_update ON public.recipes FOR UPDATE TO authenticated
  USING ( created_by_user_id = auth.uid()
          OR (organization_id IS NOT NULL AND public.is_active_org_member(organization_id)) )
  WITH CHECK ( created_by_user_id = auth.uid()
               OR (organization_id IS NOT NULL AND public.is_active_org_member(organization_id)) );

-- recipe_ingredients: as recipe (read inherits; write = author/org via can_manage_recipe).
DROP POLICY IF EXISTS recipe_ingredients_select ON public.recipe_ingredients;
CREATE POLICY recipe_ingredients_select ON public.recipe_ingredients FOR SELECT TO authenticated
  USING (public.is_admin() OR public.can_read_recipe(recipe_id));
DROP POLICY IF EXISTS recipe_ingredients_insert ON public.recipe_ingredients;
CREATE POLICY recipe_ingredients_insert ON public.recipe_ingredients FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_recipe(recipe_id));
DROP POLICY IF EXISTS recipe_ingredients_update ON public.recipe_ingredients;
CREATE POLICY recipe_ingredients_update ON public.recipe_ingredients FOR UPDATE TO authenticated
  USING (public.can_manage_recipe(recipe_id)) WITH CHECK (public.can_manage_recipe(recipe_id));
DROP POLICY IF EXISTS recipe_ingredients_delete ON public.recipe_ingredients;
CREATE POLICY recipe_ingredients_delete ON public.recipe_ingredients FOR DELETE TO authenticated
  USING (public.can_manage_recipe(recipe_id));

-- diet_charts: org members + assigned customers read; manage_diet_charts write.
DROP POLICY IF EXISTS diet_charts_select ON public.diet_charts;
CREATE POLICY diet_charts_select ON public.diet_charts FOR SELECT TO authenticated
  USING ( public.is_admin()
          OR public.is_active_org_member(organization_id)
          OR EXISTS (SELECT 1 FROM public.diet_chart_assignments a
                     WHERE a.diet_chart_id = diet_charts.id AND a.user_id = auth.uid()
                       AND a.status = 'active') );
DROP POLICY IF EXISTS diet_charts_insert ON public.diet_charts;
CREATE POLICY diet_charts_insert ON public.diet_charts FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, 'manage_diet_charts'));
DROP POLICY IF EXISTS diet_charts_update ON public.diet_charts;
CREATE POLICY diet_charts_update ON public.diet_charts FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, 'manage_diet_charts'))
  WITH CHECK (public.is_org_member(organization_id, 'manage_diet_charts'));

-- diet_chart_meals: as chart (read inherits; write = manage_diet_charts via can_manage_diet_chart).
DROP POLICY IF EXISTS diet_chart_meals_select ON public.diet_chart_meals;
CREATE POLICY diet_chart_meals_select ON public.diet_chart_meals FOR SELECT TO authenticated
  USING (public.is_admin() OR public.can_read_diet_chart(diet_chart_id));
DROP POLICY IF EXISTS diet_chart_meals_insert ON public.diet_chart_meals;
CREATE POLICY diet_chart_meals_insert ON public.diet_chart_meals FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_diet_chart(diet_chart_id));
DROP POLICY IF EXISTS diet_chart_meals_update ON public.diet_chart_meals;
CREATE POLICY diet_chart_meals_update ON public.diet_chart_meals FOR UPDATE TO authenticated
  USING (public.can_manage_diet_chart(diet_chart_id)) WITH CHECK (public.can_manage_diet_chart(diet_chart_id));
DROP POLICY IF EXISTS diet_chart_meals_delete ON public.diet_chart_meals;
CREATE POLICY diet_chart_meals_delete ON public.diet_chart_meals FOR DELETE TO authenticated
  USING (public.can_manage_diet_chart(diet_chart_id));

-- diet_chart_assignments: subject (customer) reads own. Coach (org-member) read + the assign
-- write path land in Phase 8 (INSERT fires tg_assignment_grant → new-shape access_grants).
-- TODO(Phase 8): + grant-bearing org-member read; INSERT/UPDATE for manage_diet_charts; and
--   tg_assignment_grant / tg_assignment_end_cascade.
DROP POLICY IF EXISTS diet_chart_assignments_select_self ON public.diet_chart_assignments;
CREATE POLICY diet_chart_assignments_select_self ON public.diet_chart_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- diet_chart_versions: same readers as parent; append-only (insert via assign flow, IMMUT-BLOCK).
DROP POLICY IF EXISTS diet_chart_versions_select ON public.diet_chart_versions;
CREATE POLICY diet_chart_versions_select ON public.diet_chart_versions FOR SELECT TO authenticated
  USING (public.is_admin() OR public.can_read_diet_chart(diet_chart_id));

-- =============================================================================
-- DEFERRED — version-snapshot triggers. Emit once the snapshot JSON contract + version_number/
-- current_version increment protocol + actor/change_summary source are specified (they write the
-- append-only [B] tables, so the shape is permanent). Target intent from spec lines 282/323 + arch
-- lines 290-291/334-335:
--   tg_bump_program_version()  — programs, AFTER UPDATE "on publish": INSERT program_versions
--     (version_number, snapshot jsonb = program + modules + sessions at publish, created_by_user_id,
--      change_summary); keep programs.current_version pointing at the latest.
--   tg_bump_dietchart_version() — diet_charts, "on change/publish": INSERT diet_chart_versions
--     (version_number, snapshot jsonb, authored_by_user_id, change_summary); keep current_version
--      pointing at the latest. (diet_chart_assignments.diet_chart_version_id stamps the row that
--      was current at assignment — the as-delivered record.)
--
-- DEFERRED to Phase 8 (new-shape access_grants + tg_audit_grant_change):
--   tg_enrollment_grant (program_enrollments AFTER INSERT active → access_grant
--     source='program_enrollment'); tg_enrollment_complete_cascade (AFTER UPDATE→
--     completed/cancelled/expired → deactivate that grant unless another live source remains);
--   tg_assignment_grant (diet_chart_assignments AFTER INSERT → grant source='diet_assignment');
--     tg_assignment_end_cascade (AFTER UPDATE→ended → deactivate);
--   plus the grant-bearing org-member SELECT branches + the diet_chart_assignments coach write
--   path noted inline above.
--
-- DEFERRED to Phase 5 (plan_limits + coach_subscriptions):
--   tg_enforce_plan_limit (BEFORE INSERT, advisory-locked) on programs / diet_charts / active
--   program_enrollments (spec line 1004).
-- =============================================================================
