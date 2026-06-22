// =============================================================================
// Vitalé — D4 Nutrition & Diet (Phase 4) — catalog + plan half
// Ground truth: VITALE_DB_ARCHITECTURE §4 D4 (lines 312-336) + VITALE_IMPLEMENTATION_SPEC
// Part 2 D4 (lines 313-332) + Part 6 Phase 4 order (line 1113: ... diet_charts/diet_chart_meals/
// diet_chart_versions → ... → diet_chart_assignments → ... → food_items/recipes/recipe_ingredients).
//
// This module owns the seven NON-partitioned, PK-V7 D4 tables (food catalog + recipes + diet
// plans/assignments) — Drizzle can express them fully. NOT here: nutrition_logs /
// nutrition_log_items, which are [A, PARTITIONED] REVOKE-API and live in raw post-SQL
// (migrations/post/0105_nutrition_logs.sql). Those two FK INTO this module (food_item_id →
// food_items, source_diet_chart_id → diet_charts, source_meal_id → diet_chart_meals); 0105
// created them as plain nullable uuid and DEFERRED the FK constraints to Phase 4 — i.e. they are
// added in the Phase-4 raw companion now that these targets exist.
//
// Drizzle owns table DDL + drizzle-zod validators only. The raw post-companion carries:
//   • GIN pg_trgm on food_items.name (arch §9: trgm indexes are raw-owned)
//   • tg_touch_updated_at on food_items / recipes / diet_charts / diet_chart_assignments
//   • tg_bump_dietchart_version (diet_charts → diet_chart_versions snapshot on change)
//   • IMMUT-BLOCK on diet_chart_versions (append-only)
//   • RLS/grants for all
//   • DEFERRED to Phase 8: tg_assignment_grant / tg_assignment_end_cascade on
//     diet_chart_assignments — they INSERT/deactivate access_grants (new-shape D2, absent until
//     the Phase-8 access-core refactor), so wiring them now would fail at trigger-exec time.
//
// Timestamp convention (arch §2 / §9, mirrored from existing modules): tables with a
// tg_touch_updated_at trigger carry ...timestamps (created_at + updated_at); trigger-less child
// tables (recipe_ingredients, diet_chart_meals) and the immutable diet_chart_versions carry
// created_at only — same posture as organization_member_permissions / program_versions.
// =============================================================================
import { sql } from "drizzle-orm";
import { boolean, date, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { pkV7, timestamps } from "./_shared";
import { assignmentStatus, dietChartStatus, foodSource, mealType } from "./enums";
import { users } from "./identity";
import { coachOrganizations } from "./organizations";

// food_items — public nutrition catalog; fuzzy-searched by name (GIN pg_trgm, raw companion).
export const foodItems = pgTable(
  "food_items",
  {
    id: pkV7(),
    name: text("name").notNull(),
    brand: text("brand"),
    category: text("category"),
    servingSizeG: numeric("serving_size_g"),
    calories: numeric("calories"),
    proteinG: numeric("protein_g"),
    carbsG: numeric("carbs_g"),
    fatG: numeric("fat_g"),
    fiberG: numeric("fiber_g"),
    micronutrients: jsonb("micronutrients"),
    source: foodSource("source").notNull(), // system|coach|user (spec gives no default — caller supplies)
    isVerified: boolean("is_verified").notNull().default(false), // spec: DEFAULT false
    createdByUserId: uuid("created_by_user_id").references(() => users.id), // nullable (system items)
    ...timestamps,
  },
  (t) => [
    index("food_items_category_idx").on(t.category),
    // GIN pg_trgm on name → raw companion (arch §9: trgm indexes live in raw migrations).
  ],
);

// recipes — org-owned (nullable org = system) cookable recipe. [A]
export const recipes = pgTable(
  "recipes",
  {
    id: pkV7(),
    organizationId: uuid("organization_id").references(() => coachOrganizations.id), // nullable = system recipe
    createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id),
    title: text("title").notNull(),
    description: text("description"),
    instructions: jsonb("instructions"),
    servings: integer("servings"),
    prepMinutes: integer("prep_minutes"),
    totalCalories: numeric("total_calories"), // denorm
    isPublic: boolean("is_public").notNull().default(false), // conservative default (not public)
    ...timestamps,
  },
  (t) => [
    index("recipes_org_idx").on(t.organizationId),
    index("recipes_public_idx").on(t.isPublic),
  ],
);

// recipe_ingredients — ordered ingredient lines; food_item_id nullable (free-text allowed).
// Trigger-less child → created_at only (no updated_at).
export const recipeIngredients = pgTable(
  "recipe_ingredients",
  {
    id: pkV7(),
    recipeId: uuid("recipe_id").notNull().references(() => recipes.id),
    foodItemId: uuid("food_item_id").references(() => foodItems.id), // nullable
    name: text("name").notNull(),
    quantityG: numeric("quantity_g"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("recipe_ingredients_recipe_sort_idx").on(t.recipeId, t.sortOrder)],
);

// diet_charts — org-owned diet plan, versioned (tg_bump_dietchart_version, raw companion). [A]
export const dietCharts = pgTable(
  "diet_charts",
  {
    id: pkV7(),
    organizationId: uuid("organization_id").notNull().references(() => coachOrganizations.id),
    authoredByUserId: uuid("authored_by_user_id").notNull().references(() => users.id),
    title: text("title").notNull(),
    description: text("description"),
    totalDailyCalories: numeric("total_daily_calories"), // denorm
    status: dietChartStatus("status").notNull().default("draft"),
    currentVersion: integer("current_version").notNull().default(1), // spec: DEFAULT 1
    ...timestamps,
  },
  (t) => [index("diet_charts_org_status_idx").on(t.organizationId, t.status)],
);

// diet_chart_meals — meals within a chart. Trigger-less child → created_at only.
export const dietChartMeals = pgTable(
  "diet_chart_meals",
  {
    id: pkV7(),
    dietChartId: uuid("diet_chart_id").notNull().references(() => dietCharts.id),
    mealType: mealType("meal_type").notNull(),
    name: text("name"),
    timeOfDay: text("time_of_day"),
    items: jsonb("items"),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("diet_chart_meals_chart_sort_idx").on(t.dietChartId, t.sortOrder)],
);

// diet_chart_versions — assign-time snapshot; clinical/legal record of exactly what a customer
// followed. Append-only (IMMUT-BLOCK, raw) → created_at only. [B immutable]
export const dietChartVersions = pgTable(
  "diet_chart_versions",
  {
    id: pkV7(),
    dietChartId: uuid("diet_chart_id").notNull().references(() => dietCharts.id),
    versionNumber: integer("version_number").notNull(),
    snapshot: jsonb("snapshot").notNull(), // spec: NOT NULL
    authoredByUserId: uuid("authored_by_user_id").notNull().references(() => users.id),
    changeSummary: text("change_summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("diet_chart_versions_chart_version_key").on(t.dietChartId, t.versionNumber)],
);

// diet_chart_assignments — a chart assigned to a customer; diet_chart_version_id stamped at
// assignment for as-delivered history (parallel to program_enrollments.program_version_id). [C]
export const dietChartAssignments = pgTable(
  "diet_chart_assignments",
  {
    id: pkV7(),
    dietChartId: uuid("diet_chart_id").notNull().references(() => dietCharts.id),
    dietChartVersionId: uuid("diet_chart_version_id").notNull().references(() => dietChartVersions.id), // stamped (as-delivered)
    userId: uuid("user_id").notNull().references(() => users.id),
    organizationId: uuid("organization_id").notNull().references(() => coachOrganizations.id),
    assignedByUserId: uuid("assigned_by_user_id").notNull().references(() => users.id),
    status: assignmentStatus("status").notNull().default("active"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    ...timestamps,
  },
  (t) => [
    // partial-unique: at most one ACTIVE assignment per (chart, user); re-assign after ended.
    uniqueIndex("diet_chart_assignments_active_key").on(t.dietChartId, t.userId).where(sql`${t.status} = 'active'`),
    index("diet_chart_assignments_user_status_idx").on(t.userId, t.status),
  ],
);

// ----- drizzle-zod validators (arch §11) -------------------------------------
export const insertFoodItemSchema = createInsertSchema(foodItems);
export const selectFoodItemSchema = createSelectSchema(foodItems);
export const insertRecipeSchema = createInsertSchema(recipes);
export const selectRecipeSchema = createSelectSchema(recipes);
export const insertRecipeIngredientSchema = createInsertSchema(recipeIngredients);
export const selectRecipeIngredientSchema = createSelectSchema(recipeIngredients);
export const insertDietChartSchema = createInsertSchema(dietCharts);
export const selectDietChartSchema = createSelectSchema(dietCharts);
export const insertDietChartMealSchema = createInsertSchema(dietChartMeals);
export const selectDietChartMealSchema = createSelectSchema(dietChartMeals);
export const insertDietChartVersionSchema = createInsertSchema(dietChartVersions);
export const selectDietChartVersionSchema = createSelectSchema(dietChartVersions);
export const insertDietChartAssignmentSchema = createInsertSchema(dietChartAssignments);
export const selectDietChartAssignmentSchema = createSelectSchema(dietChartAssignments);
