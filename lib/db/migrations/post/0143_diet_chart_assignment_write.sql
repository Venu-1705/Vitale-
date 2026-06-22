-- =============================================================================
-- Vitalé — Migration post/0143: diet_chart_assignments coach WRITE path
-- -----------------------------------------------------------------------------
-- 0106 shipped diet_chart_assignments with only diet_chart_assignments_select_self
-- (the subject reads their own). The coach assign-WRITE path was deferred. This adds it:
--   • A coach with manage_diet_charts in the chart's org may INSERT an assignment.
--   • Because no version-snapshot trigger exists yet, the assign handler resolve-or-creates
--     the diet_chart_versions row for the chart's current_version (the "as-delivered" record),
--     so diet_chart_versions also needs a manager INSERT path.
-- Authorization reuses public.can_manage_diet_chart(diet_chart_id) (0106) — is_org_member with
-- manage_diet_charts on the chart's org. A non-manager INSERT is RLS-denied → 403.
-- Idempotent: GRANT is additive; DROP POLICY IF EXISTS before CREATE.
-- =============================================================================

-- diet_chart_assignments — manager INSERT (subject SELECT stays select_self from 0106).
GRANT INSERT ON public.diet_chart_assignments TO authenticated;
DROP POLICY IF EXISTS diet_chart_assignments_insert ON public.diet_chart_assignments;
CREATE POLICY diet_chart_assignments_insert ON public.diet_chart_assignments FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_diet_chart(diet_chart_id));

-- diet_chart_versions — manager INSERT (append-only; IMMUT-BLOCK from 0106 still bars UPDATE/DELETE).
GRANT INSERT ON public.diet_chart_versions TO authenticated;
DROP POLICY IF EXISTS diet_chart_versions_insert ON public.diet_chart_versions;
CREATE POLICY diet_chart_versions_insert ON public.diet_chart_versions FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_diet_chart(diet_chart_id));
