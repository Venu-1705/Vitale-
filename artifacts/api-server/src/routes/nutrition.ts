// =============================================================================
// Vitalé — D4 Nutrition & Diet HTTP surface (CORE: catalog + plans + self meal-logs)
// -----------------------------------------------------------------------------
// Canonical pipeline (authedRoute → withUserContext): validate → user context → DB →
// map errors → respond. Authorization is owned by the D4 RLS policies + grants (migrations
// post/0106 catalog/plan RLS, post/0134 nutrition-logs + audited read RPC), NOT re-implemented here.
//
// Access shapes by table:
//   • food_items [catalog, public-read] — RLS food_items_select_public USING(true); SELECT granted to
//     anon+authenticated. INSERT/UPDATE gated by food_items_insert/_update (is_admin OR
//     source∈{user,coach} AND created_by_user_id=auth.uid()). SELECT grant → .returning() safe.
//   • recipes / recipe_ingredients [A] — recipes_select (public|author|org); write = author/org
//     (can_manage_recipe). recipe_ingredients inherits via can_read_recipe/can_manage_recipe.
//     SELECT grants exist → .returning() safe.
//   • diet_charts / diet_chart_meals [A] — diet_charts_select (org members + active assignee);
//     write = manage_diet_charts (is_org_member(org,'manage_diet_charts')). meals via
//     can_manage_diet_chart. SELECT grants exist → .returning() safe.
//   • diet_chart_versions [B, immutable] — SELECT only (same readers as parent). Created by the
//     DEFERRED tg_bump_dietchart_version (snapshot contract unspecified) → none exist yet; read-only.
//   • diet_chart_assignments [C] — self-select only this phase (diet_chart_assignments_select_self
//     USING user_id=auth.uid()). The coach assign-write path fires tg_assignment_grant (new-shape
//     access_grants) and is DEFERRED to Phase 8 — NOT exposed here.
//   • nutrition_logs / nutrition_log_items [A, PARTITIONED, REVOKE-API, RLS-FORCE] — authenticated
//     holds INSERT only, NO SELECT grant (0134). Self-log writes the partition key explicitly
//     (logged_date_ist = (logged_at AT TIME ZONE 'Asia/Kolkata')::date) because PG routes the tuple
//     BEFORE the tg_set_logged_date_ist BEFORE-trigger fires (D5-1/D11-4 routing trap). Reads go
//     EXCLUSIVELY through the audited rpc_read_nutrition_logs (0134): self unaudited; coach
//     (can_read_health) / admin (admin_has_support_access) audited (one coach_data_access_audit row);
//     else 42501→403. A raw SELECT would be denied (no grant). UPDATE/DELETE deferred (D5-3 class:
//     needs a SECURITY-DEFINER correction RPC) — the nl_update_owner/nl_delete_owner policies exist
//     but carry no grant.
//
// Error-code discipline (uniform with D5/D11): RLS denial / RPC access-denied → 42501 → 403;
// CHECK/FK/NOT-NULL/business-rule → 422; unique → 409; RPC not-found (P0002) → 404.
// =============================================================================
import { Router, type IRouter } from "express";
import { and, eq, desc, ilike, sql } from "drizzle-orm";
import {
  foodItems,
  recipes,
  recipeIngredients,
  dietCharts,
  dietChartMeals,
  dietChartVersions,
  dietChartAssignments,
  uuidv7,
} from "@workspace/db";
import { z } from "zod";
import { authedRoute } from "../lib/route";
import { ApiError } from "../lib/http";

const router: IRouter = Router();

// ----- enum mirrors (exact DB values) ----------------------------------------
const FOOD_SOURCE = ["system", "coach", "user"] as const;
const MEAL_TYPE = ["breakfast", "lunch", "dinner", "snack"] as const;
const NUTRITION_SOURCE = ["manual", "diet_chart", "recipe"] as const;

const IdParam = z.object({ id: z.string().uuid() });

// =============================================================================
// Food catalog — food_items [public read; self/admin write]
// =============================================================================
const ListFoodQuery = z.object({
  q: z.string().min(1).optional(),        // fuzzy name search (GIN pg_trgm food_items_name_trgm_idx)
  category: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// GET /food-items — public catalog search. RLS USING(true) → any authenticated caller. The trgm
// index backs ILIKE '%q%'; an unfiltered list is capped (default 50) and newest-first.
router.get(
  "/food-items",
  authedRoute({ query: ListFoodQuery }, async ({ db, query }) => {
    const conds = [];
    if (query.q) conds.push(ilike(foodItems.name, `%${query.q}%`));
    if (query.category) conds.push(eq(foodItems.category, query.category));
    const limit = query.limit ?? 50;
    const rows = conds.length
      ? await db.select().from(foodItems).where(and(...conds)).orderBy(desc(foodItems.createdAt)).limit(limit)
      : await db.select().from(foodItems).orderBy(desc(foodItems.createdAt)).limit(limit);
    return { count: rows.length, foodItems: rows };
  }),
);

const CreateFoodBody = z.object({
  name: z.string().min(1),
  source: z.enum(FOOD_SOURCE).default("user"), // 'system' ⇒ admin-only (RLS food_items_insert)
  brand: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  servingSizeG: z.number().optional(),
  calories: z.number().optional(),
  proteinG: z.number().optional(),
  carbsG: z.number().optional(),
  fatG: z.number().optional(),
  fiberG: z.number().optional(),
  micronutrients: z.record(z.string(), z.unknown()).optional(),
});

// POST /food-items — add a user/coach food item. RLS food_items_insert pins created_by_user_id =
// auth.uid() for source∈{user,coach}; source='system' requires is_admin() (else 403). SELECT grant
// exists → .returning() safe. numeric columns are sent as strings (pg numeric) to preserve precision.
router.post(
  "/food-items",
  authedRoute({ body: CreateFoodBody }, async ({ db, body, userId }) => {
    const rows = await db
      .insert(foodItems)
      .values({
        id: uuidv7(),
        name: body.name,
        source: body.source,
        createdByUserId: userId,
        ...(body.brand ? { brand: body.brand } : {}),
        ...(body.category ? { category: body.category } : {}),
        ...(body.servingSizeG !== undefined ? { servingSizeG: String(body.servingSizeG) } : {}),
        ...(body.calories !== undefined ? { calories: String(body.calories) } : {}),
        ...(body.proteinG !== undefined ? { proteinG: String(body.proteinG) } : {}),
        ...(body.carbsG !== undefined ? { carbsG: String(body.carbsG) } : {}),
        ...(body.fatG !== undefined ? { fatG: String(body.fatG) } : {}),
        ...(body.fiberG !== undefined ? { fiberG: String(body.fiberG) } : {}),
        ...(body.micronutrients ? { micronutrients: body.micronutrients } : {}),
      })
      .returning();
    return rows[0];
  }),
);

// =============================================================================
// Recipes — recipes / recipe_ingredients [A]
// =============================================================================
const ListRecipesQuery = z.object({
  mineOnly: z.coerce.boolean().optional(),  // author = caller (RLS still applies)
  publicOnly: z.coerce.boolean().optional(),
});

// GET /recipes — RLS recipes_select decides visibility (public OR author OR active org member).
router.get(
  "/recipes",
  authedRoute({ query: ListRecipesQuery }, async ({ db, query, userId }) => {
    const conds = [];
    if (query.mineOnly) conds.push(eq(recipes.createdByUserId, userId));
    if (query.publicOnly) conds.push(eq(recipes.isPublic, true));
    const rows = conds.length
      ? await db.select().from(recipes).where(and(...conds)).orderBy(desc(recipes.createdAt))
      : await db.select().from(recipes).orderBy(desc(recipes.createdAt));
    return { count: rows.length, recipes: rows };
  }),
);

// GET /recipes/:id — recipe + its ingredients (both RLS-gated; not visible → 404).
router.get(
  "/recipes/:id",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const rs = await db.select().from(recipes).where(eq(recipes.id, params.id)).limit(1);
    if (!rs[0]) {
      throw new ApiError(404, "not_found", "Recipe not found.");
    }
    const ings = await db
      .select()
      .from(recipeIngredients)
      .where(eq(recipeIngredients.recipeId, params.id))
      .orderBy(recipeIngredients.sortOrder);
    return { ...rs[0], ingredients: ings };
  }),
);

const CreateRecipeBody = z.object({
  title: z.string().min(1),
  organizationId: z.string().uuid().optional(), // null = personal recipe; if set → must be a member
  description: z.string().min(1).optional(),
  instructions: z.array(z.unknown()).optional(),
  servings: z.number().int().positive().optional(),
  prepMinutes: z.number().int().nonnegative().optional(),
  totalCalories: z.number().optional(),
  isPublic: z.boolean().optional(),
});

// POST /recipes — RLS recipes_insert: created_by_user_id = auth.uid() AND (org NULL OR member).
router.post(
  "/recipes",
  authedRoute({ body: CreateRecipeBody }, async ({ db, body, userId }) => {
    const rows = await db
      .insert(recipes)
      .values({
        id: uuidv7(),
        createdByUserId: userId,
        title: body.title,
        ...(body.organizationId ? { organizationId: body.organizationId } : {}),
        ...(body.description ? { description: body.description } : {}),
        ...(body.instructions ? { instructions: body.instructions } : {}),
        ...(body.servings !== undefined ? { servings: body.servings } : {}),
        ...(body.prepMinutes !== undefined ? { prepMinutes: body.prepMinutes } : {}),
        ...(body.totalCalories !== undefined ? { totalCalories: String(body.totalCalories) } : {}),
        ...(body.isPublic !== undefined ? { isPublic: body.isPublic } : {}),
      })
      .returning();
    return rows[0];
  }),
);

const CreateIngredientBody = z.object({
  name: z.string().min(1),
  foodItemId: z.string().uuid().optional(),
  quantityG: z.number().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

// POST /recipes/:id/ingredients — add an ingredient line. RLS recipe_ingredients_insert →
// can_manage_recipe(recipe_id) (author/org). A non-manager insert is denied → 403.
router.post(
  "/recipes/:id/ingredients",
  authedRoute({ params: IdParam, body: CreateIngredientBody }, async ({ db, params, body }) => {
    const rows = await db
      .insert(recipeIngredients)
      .values({
        id: uuidv7(),
        recipeId: params.id,
        name: body.name,
        ...(body.foodItemId ? { foodItemId: body.foodItemId } : {}),
        ...(body.quantityG !== undefined ? { quantityG: String(body.quantityG) } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      })
      .returning();
    return rows[0];
  }),
);

// =============================================================================
// Diet charts — diet_charts / diet_chart_meals [A]; diet_chart_versions [B]
// =============================================================================
const ListChartsQuery = z.object({
  organizationId: z.string().uuid().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
});

// GET /diet-charts — RLS diet_charts_select (org members + active assignees). Optional filters.
router.get(
  "/diet-charts",
  authedRoute({ query: ListChartsQuery }, async ({ db, query }) => {
    const conds = [];
    if (query.organizationId) conds.push(eq(dietCharts.organizationId, query.organizationId));
    if (query.status) conds.push(eq(dietCharts.status, query.status));
    const rows = conds.length
      ? await db.select().from(dietCharts).where(and(...conds)).orderBy(desc(dietCharts.createdAt))
      : await db.select().from(dietCharts).orderBy(desc(dietCharts.createdAt));
    return { count: rows.length, dietCharts: rows };
  }),
);

// GET /diet-charts/:id — chart + meals (RLS-gated; not visible → 404).
router.get(
  "/diet-charts/:id",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const cs = await db.select().from(dietCharts).where(eq(dietCharts.id, params.id)).limit(1);
    if (!cs[0]) {
      throw new ApiError(404, "not_found", "Diet chart not found.");
    }
    const meals = await db
      .select()
      .from(dietChartMeals)
      .where(eq(dietChartMeals.dietChartId, params.id))
      .orderBy(dietChartMeals.sortOrder);
    return { ...cs[0], meals };
  }),
);

// GET /diet-charts/:id/versions — append-only snapshot history (read-only; SELECT granted).
router.get(
  "/diet-charts/:id/versions",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const rows = await db
      .select()
      .from(dietChartVersions)
      .where(eq(dietChartVersions.dietChartId, params.id))
      .orderBy(desc(dietChartVersions.versionNumber));
    return { count: rows.length, versions: rows };
  }),
);

const CreateChartBody = z.object({
  organizationId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  totalDailyCalories: z.number().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
});

// POST /diet-charts — RLS diet_charts_insert → is_org_member(org,'manage_diet_charts'). authored_by
// pinned to the caller. Non-member / lacking capability → 403.
router.post(
  "/diet-charts",
  authedRoute({ body: CreateChartBody }, async ({ db, body, userId }) => {
    const rows = await db
      .insert(dietCharts)
      .values({
        id: uuidv7(),
        organizationId: body.organizationId,
        authoredByUserId: userId,
        title: body.title,
        ...(body.description ? { description: body.description } : {}),
        ...(body.totalDailyCalories !== undefined ? { totalDailyCalories: String(body.totalDailyCalories) } : {}),
        ...(body.status ? { status: body.status } : {}),
      })
      .returning();
    return rows[0];
  }),
);

const CreateMealBody = z.object({
  mealType: z.enum(MEAL_TYPE),
  name: z.string().min(1).optional(),
  timeOfDay: z.string().min(1).optional(),
  items: z.array(z.unknown()).optional(),
  notes: z.string().min(1).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

// POST /diet-charts/:id/meals — add a meal. RLS diet_chart_meals_insert → can_manage_diet_chart
// (manage_diet_charts in the chart's org). Non-manager → 403.
router.post(
  "/diet-charts/:id/meals",
  authedRoute({ params: IdParam, body: CreateMealBody }, async ({ db, params, body }) => {
    const rows = await db
      .insert(dietChartMeals)
      .values({
        id: uuidv7(),
        dietChartId: params.id,
        mealType: body.mealType,
        ...(body.name ? { name: body.name } : {}),
        ...(body.timeOfDay ? { timeOfDay: body.timeOfDay } : {}),
        ...(body.items ? { items: body.items } : {}),
        ...(body.notes ? { notes: body.notes } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      })
      .returning();
    return rows[0];
  }),
);

// GET /diet-chart-assignments — the caller's OWN assignments (RLS select_self USING user_id=
// auth.uid()). The coach assign-write path (fires tg_assignment_grant) is deferred to Phase 8.
router.get(
  "/diet-chart-assignments",
  authedRoute({}, async ({ db }) => {
    const rows = await db
      .select()
      .from(dietChartAssignments)
      .orderBy(desc(dietChartAssignments.createdAt));
    return { count: rows.length, assignments: rows };
  }),
);

// POST /diet-chart-assignments — a coach (manage_diet_charts in the chart's org) assigns a
// chart to a client. RLS diet_chart_assignments_insert WITH CHECK can_manage_diet_chart →
// non-manager is denied (403); chart not visible → 404; a second ACTIVE assignment for the
// same (chart,user) hits the partial-unique index → 409.
//
// Because the version-snapshot trigger is still deferred, we resolve-or-create the
// diet_chart_versions row for the chart's current_version (the as-delivered record) and stamp
// the assignment with it. REVOKE-API for the assigning coach (select_self → no RETURNING for
// them), so the row is app-generated and echoed.
const AssignBody = z.object({
  dietChartId: z.string().uuid(),
  userId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD").optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD").optional(),
});
router.post(
  "/diet-chart-assignments",
  authedRoute({ body: AssignBody }, async ({ db, body, userId, res }) => {
    // 1. Resolve the chart (RLS: org members can read). Not visible → 404.
    const chartRows = await db
      .select({
        organizationId: dietCharts.organizationId,
        currentVersion: dietCharts.currentVersion,
        title: dietCharts.title,
        description: dietCharts.description,
        totalDailyCalories: dietCharts.totalDailyCalories,
      })
      .from(dietCharts)
      .where(eq(dietCharts.id, body.dietChartId))
      .limit(1);
    const chart = chartRows[0];
    if (!chart) throw new ApiError(404, "not_found", "Chart not found.");

    // 2. Resolve-or-create the as-delivered version row.
    const existingVersion = await db
      .select({ id: dietChartVersions.id })
      .from(dietChartVersions)
      .where(
        and(
          eq(dietChartVersions.dietChartId, body.dietChartId),
          eq(dietChartVersions.versionNumber, chart.currentVersion),
        ),
      )
      .limit(1);
    let versionId = existingVersion[0]?.id;
    if (!versionId) {
      const meals = await db
        .select()
        .from(dietChartMeals)
        .where(eq(dietChartMeals.dietChartId, body.dietChartId));
      versionId = uuidv7();
      await db.insert(dietChartVersions).values({
        id: versionId,
        dietChartId: body.dietChartId,
        versionNumber: chart.currentVersion,
        snapshot: {
          title: chart.title,
          description: chart.description,
          totalDailyCalories: chart.totalDailyCalories,
          meals,
        },
        authoredByUserId: userId,
        changeSummary: "As-delivered snapshot captured at assignment.",
      });
    }

    // 3. Insert the assignment (no RETURNING — coach cannot SELECT it under select_self).
    const id = uuidv7();
    await db.insert(dietChartAssignments).values({
      id,
      dietChartId: body.dietChartId,
      dietChartVersionId: versionId,
      userId: body.userId,
      organizationId: chart.organizationId,
      assignedByUserId: userId,
      status: "active",
      ...(body.startDate ? { startDate: body.startDate } : {}),
      ...(body.endDate ? { endDate: body.endDate } : {}),
    });

    res.status(201);
    return {
      id,
      dietChartId: body.dietChartId,
      dietChartVersionId: versionId,
      userId: body.userId,
      organizationId: chart.organizationId,
      status: "active",
      startDate: body.startDate ?? null,
      endDate: body.endDate ?? null,
    };
  }),
);

// =============================================================================
// Nutrition logs — nutrition_logs / nutrition_log_items [REVOKE-API]: write self; read via RPC
// =============================================================================
const LogItemInput = z.object({
  name: z.string().min(1).optional(),
  foodItemId: z.string().uuid().optional(),
  sourceDietChartId: z.string().uuid().optional(),
  sourceMealId: z.string().uuid().optional(),
  quantityG: z.number().optional(),
  calories: z.number().optional(),
  proteinG: z.number().optional(),
  carbsG: z.number().optional(),
  fatG: z.number().optional(),
});
const CreateLogBody = z.object({
  mealType: z.enum(MEAL_TYPE),
  loggedAt: z.string().datetime().optional(), // defaults to now() at the DB
  totalCalories: z.number().optional(),
  note: z.string().min(1).optional(),
  source: z.enum(NUTRITION_SOURCE).optional(), // default 'manual'
  items: z.array(LogItemInput).optional(),
});

// POST /nutrition-logs — the subject logs their OWN meal (RLS nl_insert_self / nli_insert_self
// WITH CHECK user_id = auth.uid()). REVOKE-API: no SELECT grant → no RETURNING; insert app-generated
// ids and echo. Parent + items land in ONE transaction (authedRoute wraps the handler).
//
// Partition-routing (D5-1/D11-4): supply logged_date_ist = (logged_at AT TIME ZONE 'Asia/Kolkata')
// ::date so routing lands in the right partition (the BEFORE trigger fires AFTER routing). logged_at
// and the derived date are resolved in ONE round-trip up front; now() is transaction-constant, so
// parent and every child share the identical instant + partition key (composite FK enforces match).
router.post(
  "/nutrition-logs",
  authedRoute({ body: CreateLogBody }, async ({ db, body, userId }) => {
    const loggedAtExpr = body.loggedAt ? sql`${body.loggedAt}::timestamptz` : sql`now()`;
    // Resolve the instant + IST partition key once (single source for parent + all items).
    const resolved = await db.execute(
      sql`SELECT ${loggedAtExpr} AS l_at, (${loggedAtExpr} AT TIME ZONE 'Asia/Kolkata')::date AS d`,
    );
    const { l_at: loggedAt, d: loggedDate } = resolved.rows[0] as { l_at: string; d: string };

    const logId = uuidv7();
    await db.execute(sql`
      INSERT INTO public.nutrition_logs
        (id, logged_date_ist, user_id, logged_at, meal_type, total_calories, note, source)
      VALUES (${logId}::uuid, ${loggedDate}::date, ${userId}::uuid, ${loggedAt}::timestamptz,
              ${body.mealType}::public.meal_type, ${body.totalCalories ?? null}, ${body.note ?? null},
              ${body.source ?? "manual"}::public.nutrition_source)
    `);

    const items = body.items ?? [];
    const itemIds: string[] = [];
    for (const it of items) {
      const itemId = uuidv7();
      itemIds.push(itemId);
      await db.execute(sql`
        INSERT INTO public.nutrition_log_items
          (id, logged_date_ist, nutrition_log_id, user_id, food_item_id, source_diet_chart_id,
           source_meal_id, name, quantity_g, calories, protein_g, carbs_g, fat_g)
        VALUES (${itemId}::uuid, ${loggedDate}::date, ${logId}::uuid, ${userId}::uuid,
                ${it.foodItemId ?? null}::uuid, ${it.sourceDietChartId ?? null}::uuid,
                ${it.sourceMealId ?? null}::uuid, ${it.name ?? null},
                ${it.quantityG ?? null}, ${it.calories ?? null}, ${it.proteinG ?? null},
                ${it.carbsG ?? null}, ${it.fatG ?? null})
      `);
    }
    return { id: logId, loggedDateIst: loggedDate, itemIds, itemCount: itemIds.length };
  }),
);

// GET /nutrition-logs — the ONLY read path. Delegates to the SECURITY DEFINER, audited
// rpc_read_nutrition_logs (0134): re-enforces the nl_select gate (self unaudited; coach/admin
// audited), returns each log header + its items (nested jsonb). Default subject = caller; optional
// [from, to] filter the partition key inclusive. RPC raises 42501 → 403 on a disallowed subject.
const ReadLogsQuery = z.object({
  subjectUserId: z.string().uuid().optional(),
  fromDate: z.string().date().optional(),
  toDate: z.string().date().optional(),
});
router.get(
  "/nutrition-logs",
  authedRoute({ query: ReadLogsQuery }, async ({ db, query, userId }) => {
    const subject = query.subjectUserId ?? userId;
    const result = await db.execute(
      sql`select * from public.rpc_read_nutrition_logs(
        ${subject}::uuid,
        ${query.fromDate ?? null}::date,
        ${query.toDate ?? null}::date)`,
    );
    return { count: result.rows.length, logs: result.rows };
  }),
);

export default router;
