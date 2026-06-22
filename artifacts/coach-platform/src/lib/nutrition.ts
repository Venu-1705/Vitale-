/**
 * D4 Nutrition & Diet data layer for the coach + admin platform.
 *
 * Access shapes (authorization is the backend's RLS + capability grants):
 *   • food_items / recipes — catalog, public-read. Writes gated by ownership/admin.
 *   • diet_charts — ORG TEMPLATES (no client column). GET /diet-charts → { count,
 *     dietCharts }; /diet-charts/:id adds `meals`; /:id/versions lists the ledger.
 *     Writes require `manage_diet_charts`. A chart reaches a client only via a
 *     diet_chart_assignment (stamps the delivered version).
 *   • nutrition_logs — REVOKE-API, audited. GET /nutrition-logs?subjectUserId&
 *     fromDate&toDate delegates to `rpc_read_nutrition_logs` (self unaudited;
 *     coach/admin reads audited + grant-gated). subjectUserId defaults to the
 *     caller when omitted. Admins get NO ambient access (RPC denies without grant).
 *
 * Casing: D4 query keys + bodies are camelCase (`organizationId`, `subjectUserId`,
 * `mealType`, `totalDailyCalories`). Responses camelized by the transport.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { apiGet, apiPost } from "./api";

// ── Enums ───────────────────────────────────────────────────────────────────
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type DietChartStatus = "draft" | "active" | "archived";
export type AssignmentStatus = "active" | "paused" | "ended";
export type NutritionSource = "manual" | "diet_chart" | "recipe";
export type FoodSource = "system" | "coach" | "user";

// ── DTOs ────────────────────────────────────────────────────────────────────
export interface FoodItem {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  servingSizeG: string | null;
  calories: string | null;
  proteinG: string | null;
  carbsG: string | null;
  fatG: string | null;
  fiberG: string | null;
  isVerified: boolean;
  source: FoodSource;
  createdByUserId: string | null;
}

export interface Recipe {
  id: string;
  organizationId: string | null;
  createdByUserId: string;
  title: string;
  description: string | null;
  instructions: unknown | null;
  servings: number | null;
  prepMinutes: number | null;
  totalCalories: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeIngredient {
  id: string;
  recipeId: string;
  foodItemId: string | null;
  name: string;
  quantityG: string | null;
  sortOrder: number;
}

export interface RecipeDetail extends Recipe {
  ingredients: RecipeIngredient[];
}

export interface DietChart {
  id: string;
  organizationId: string;
  authoredByUserId: string;
  title: string;
  description: string | null;
  totalDailyCalories: string | null;
  status: DietChartStatus;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface DietChartMeal {
  id: string;
  dietChartId: string;
  mealType: MealType;
  name: string | null;
  timeOfDay: string | null;
  items: unknown | null;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface DietChartDetail extends DietChart {
  meals: DietChartMeal[];
}

export interface DietChartVersion {
  id: string;
  dietChartId: string;
  versionNumber: number;
  snapshot: Record<string, unknown>;
  authoredByUserId: string;
  changeSummary: string | null;
  createdAt: string;
}

export interface DietChartAssignment {
  id: string;
  dietChartId: string;
  dietChartVersionId: string;
  userId: string;
  organizationId: string;
  assignedByUserId: string;
  status: AssignmentStatus;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A row from the audited rpc_read_nutrition_logs (camelized; shape is read-only). */
export interface NutritionLog {
  id: string;
  userId: string;
  loggedAt: string;
  loggedDateIst: string;
  mealType: MealType;
  totalCalories: string | null;
  note: string | null;
  source: NutritionSource;
}

interface FoodEnvelope { count: number; foodItems: FoodItem[] }
interface RecipesEnvelope { count: number; recipes: Recipe[] }
interface ChartsEnvelope { count: number; dietCharts: DietChart[] }
interface ChartVersionsEnvelope { count: number; versions: DietChartVersion[] }
interface AssignmentsEnvelope { count: number; assignments: DietChartAssignment[] }
interface LogsEnvelope { count: number; logs: NutritionLog[] }

// ── Query keys ──────────────────────────────────────────────────────────────
export const nutritionKeys = {
  foodItems: (filter?: string) => (filter ? ["food-items", filter] : ["food-items"]) as readonly unknown[],
  recipes: (filter?: string) => (filter ? ["recipes", filter] : ["recipes"]) as readonly unknown[],
  recipe: (id: string) => ["recipe", id] as const,
  dietCharts: (filter?: string) => (filter ? ["diet-charts", filter] : ["diet-charts"]) as readonly unknown[],
  dietChart: (id: string) => ["diet-chart", id] as const,
  dietChartVersions: (id: string) => ["diet-chart", id, "versions"] as const,
  assignments: ["diet-chart-assignments"] as const,
  logs: (subjectUserId: string, fromDate: string, toDate: string) =>
    ["nutrition-logs", subjectUserId, fromDate, toDate] as const,
};

// ── Food items (catalog) ────────────────────────────────────────────────────
export function useFoodItems(search?: string, options?: Partial<UseQueryOptions<FoodItem[]>>) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  return useQuery({
    queryKey: nutritionKeys.foodItems(qs),
    queryFn: async () => (await apiGet<FoodEnvelope>(`/food-items${qs}`)).foodItems,
    staleTime: 5 * 60_000,
    ...options,
  });
}

// ── Recipes ─────────────────────────────────────────────────────────────────
export function useRecipes(options?: Partial<UseQueryOptions<Recipe[]>>) {
  return useQuery({
    queryKey: nutritionKeys.recipes(),
    queryFn: async () => (await apiGet<RecipesEnvelope>("/recipes")).recipes,
    staleTime: 60_000,
    ...options,
  });
}

export function useRecipe(id: string | undefined, options?: Partial<UseQueryOptions<RecipeDetail>>) {
  return useQuery({
    queryKey: nutritionKeys.recipe(id ?? "unknown"),
    queryFn: () => apiGet<RecipeDetail>(`/recipes/${id}`),
    enabled: !!id,
    staleTime: 60_000,
    ...options,
  });
}

export interface CreateRecipeInput {
  title: string;
  organizationId?: string;
  description?: string;
  instructions?: unknown[];
  servings?: number;
  prepMinutes?: number;
  totalCalories?: number;
}
export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateRecipeInput) => apiPost<Recipe>("/recipes", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: nutritionKeys.recipes() }),
  });
}

export interface RecipeIngredientInput {
  name: string;
  foodItemId?: string;
  quantityG?: number;
  sortOrder?: number;
}
export function useAddRecipeIngredient(recipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RecipeIngredientInput) => apiPost<RecipeIngredient>(`/recipes/${recipeId}/ingredients`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: nutritionKeys.recipe(recipeId) }),
  });
}

// ── Diet charts (org templates) ─────────────────────────────────────────────
export interface DietChartListParams { organizationId?: string; status?: DietChartStatus }

function chartQuery(params: DietChartListParams): string {
  const q = new URLSearchParams();
  if (params.organizationId) q.set("organizationId", params.organizationId);
  if (params.status) q.set("status", params.status);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function useDietCharts(params: DietChartListParams = {}, options?: Partial<UseQueryOptions<DietChart[]>>) {
  const key = chartQuery(params);
  return useQuery({
    queryKey: nutritionKeys.dietCharts(key),
    queryFn: async () => (await apiGet<ChartsEnvelope>(`/diet-charts${key}`)).dietCharts,
    staleTime: 30_000,
    ...options,
  });
}

export function useDietChart(id: string | undefined, options?: Partial<UseQueryOptions<DietChartDetail>>) {
  return useQuery({
    queryKey: nutritionKeys.dietChart(id ?? "unknown"),
    queryFn: () => apiGet<DietChartDetail>(`/diet-charts/${id}`),
    enabled: !!id,
    staleTime: 30_000,
    ...options,
  });
}

export function useDietChartVersions(id: string | undefined, options?: Partial<UseQueryOptions<DietChartVersion[]>>) {
  return useQuery({
    queryKey: nutritionKeys.dietChartVersions(id ?? "unknown"),
    queryFn: async () => (await apiGet<ChartVersionsEnvelope>(`/diet-charts/${id}/versions`)).versions,
    enabled: !!id,
    staleTime: 60_000,
    ...options,
  });
}

export interface AssignDietChartInput {
  dietChartId: string;
  userId: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}

export interface DietChartAssignmentResult {
  id: string;
  dietChartId: string;
  dietChartVersionId: string;
  userId: string;
  organizationId: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
}

/** Assign a diet chart to a client (coach-only; manage_diet_charts enforced by RLS). */
export function useAssignDietChart() {
  return useMutation({
    mutationFn: (body: AssignDietChartInput) =>
      apiPost<DietChartAssignmentResult>("/diet-chart-assignments", body),
  });
}

export interface CreateDietChartInput {
  organizationId: string;
  title: string;
  description?: string;
  totalDailyCalories?: number;
  status?: DietChartStatus;
}
export function useCreateDietChart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDietChartInput) => apiPost<DietChart>("/diet-charts", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: nutritionKeys.dietCharts() }),
  });
}

export interface CreateMealInput {
  mealType: MealType;
  name?: string;
  timeOfDay?: string;
  items?: unknown[];
  notes?: string;
  sortOrder?: number;
}
export function useCreateDietChartMeal(dietChartId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateMealInput) => apiPost<DietChartMeal>(`/diet-charts/${dietChartId}/meals`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: nutritionKeys.dietChart(dietChartId) }),
  });
}

// ── Diet chart assignments ──────────────────────────────────────────────────
export function useDietChartAssignments(options?: Partial<UseQueryOptions<DietChartAssignment[]>>) {
  return useQuery({
    queryKey: nutritionKeys.assignments,
    queryFn: async () => (await apiGet<AssignmentsEnvelope>("/diet-chart-assignments")).assignments,
    staleTime: 30_000,
    ...options,
  });
}

// ── Nutrition logs (audited, consent-gated) ─────────────────────────────────
export interface NutritionLogQuery {
  subjectUserId?: string;
  fromDate?: string;
  toDate?: string;
}

/**
 * Read a client's meal logs over an optional window. `subjectUserId` omitted ⇒
 * the caller's own logs (unaudited). A coach reading a client's logs is audited
 * and grant-gated; the backend 403s without a grant. Enabled once a subject is set.
 */
export function useNutritionLogs(params: NutritionLogQuery, options?: Partial<UseQueryOptions<NutritionLog[]>>) {
  const { subjectUserId, fromDate, toDate } = params;
  return useQuery({
    queryKey: nutritionKeys.logs(subjectUserId ?? "self", fromDate ?? "", toDate ?? ""),
    queryFn: async () => {
      const q = new URLSearchParams();
      if (subjectUserId) q.set("subjectUserId", subjectUserId);
      if (fromDate) q.set("fromDate", fromDate);
      if (toDate) q.set("toDate", toDate);
      const s = q.toString();
      return (await apiGet<LogsEnvelope>(`/nutrition-logs${s ? `?${s}` : ""}`)).logs;
    },
    enabled: !!subjectUserId,
    staleTime: 30_000,
    ...options,
  });
}
