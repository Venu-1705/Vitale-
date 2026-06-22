/**
 * D4 Nutrition layer (mobile / client = data SUBJECT).
 *
 * The client logs their OWN meals and reads their own logs + any diet chart
 * assigned to them. Self-reads of nutrition logs are unaudited (served by the
 * audited RPC to the subject). Writes carry the caller as the logging user.
 *
 * Casing: query keys + bodies are camelCase.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { apiGet, apiPost } from "./api";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type AssignmentStatus = "active" | "paused" | "ended";
export type NutritionSource = "manual" | "diet_chart" | "recipe";

export interface DietChartAssignment {
  id: string;
  dietChartId: string;
  dietChartVersionId: string;
  userId: string;
  organizationId: string;
  status: AssignmentStatus;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

export interface DietChartMeal {
  id: string;
  dietChartId: string;
  mealType: MealType;
  name: string | null;
  timeOfDay: string | null;
  notes: string | null;
  sortOrder: number;
}

export interface DietChartDetail {
  id: string;
  title: string;
  description: string | null;
  totalDailyCalories: string | null;
  status: "draft" | "active" | "archived";
  currentVersion: number;
  meals: DietChartMeal[];
}

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

interface AssignmentsEnvelope { count: number; assignments: DietChartAssignment[] }
interface LogsEnvelope { count: number; logs: NutritionLog[] }

export const nutritionKeys = {
  assignments: ["diet-chart-assignments"] as const,
  dietChart: (id: string) => ["diet-chart", id] as const,
  logs: (from: string, to: string) => ["nutrition-logs", "self", from, to] as const,
};

/** Diet charts assigned to the caller. */
export function useMyDietChartAssignments(options?: Partial<UseQueryOptions<DietChartAssignment[]>>) {
  return useQuery({
    queryKey: nutritionKeys.assignments,
    queryFn: async () => (await apiGet<AssignmentsEnvelope>("/diet-chart-assignments")).assignments,
    staleTime: 60_000,
    ...options,
  });
}

export function useDietChart(id: string | undefined, options?: Partial<UseQueryOptions<DietChartDetail>>) {
  return useQuery({
    queryKey: nutritionKeys.dietChart(id ?? "unknown"),
    queryFn: () => apiGet<DietChartDetail>(`/diet-charts/${id}`),
    enabled: !!id,
    staleTime: 60_000,
    ...options,
  });
}

/** The caller's own meal logs over an optional window. */
export function useMyNutritionLogs(
  params: { fromDate?: string; toDate?: string } = {},
  options?: Partial<UseQueryOptions<NutritionLog[]>>,
) {
  const { fromDate, toDate } = params;
  return useQuery({
    queryKey: nutritionKeys.logs(fromDate ?? "", toDate ?? ""),
    queryFn: async () => {
      const q = new URLSearchParams();
      if (fromDate) q.set("fromDate", fromDate);
      if (toDate) q.set("toDate", toDate);
      const s = q.toString();
      return (await apiGet<LogsEnvelope>(`/nutrition-logs${s ? `?${s}` : ""}`)).logs;
    },
    staleTime: 30_000,
    ...options,
  });
}

export interface LogMealInput {
  mealType: MealType;
  totalCalories?: number;
  note?: string;
  loggedAt?: string;
  items?: unknown[];
}

/**
 * Persist a meal log outside a React component (e.g. from a context callback).
 * Mirrors useLogMeal's body but is callable anywhere.
 */
export async function persistMealLog(input: LogMealInput): Promise<{ id: string }> {
  return apiPost<{ id: string }>("/nutrition-logs", {
    mealType: input.mealType,
    ...(input.totalCalories != null ? { totalCalories: input.totalCalories } : {}),
    ...(input.note ? { note: input.note } : {}),
    ...(input.loggedAt ? { loggedAt: input.loggedAt } : {}),
    ...(input.items ? { items: input.items } : {}),
    source: "manual",
  });
}

/**
 * Read the caller's own meal logs over an optional window, outside a component
 * (e.g. from a context effect). Returns the audited self-read rows.
 */
export async function fetchMealLogs(fromDate?: string, toDate?: string): Promise<NutritionLog[]> {
  const q = new URLSearchParams();
  if (fromDate) q.set("fromDate", fromDate);
  if (toDate) q.set("toDate", toDate);
  const s = q.toString();
  return (await apiGet<LogsEnvelope>(`/nutrition-logs${s ? `?${s}` : ""}`)).logs;
}

/** Log one of the caller's own meals. */
export function useLogMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LogMealInput) =>
      apiPost<{ id: string; itemCount: number }>("/nutrition-logs", {
        mealType: input.mealType,
        ...(input.totalCalories != null ? { totalCalories: input.totalCalories } : {}),
        ...(input.note ? { note: input.note } : {}),
        ...(input.loggedAt ? { loggedAt: input.loggedAt } : {}),
        ...(input.items ? { items: input.items } : {}),
        source: "manual",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nutrition-logs", "self"] }),
  });
}
