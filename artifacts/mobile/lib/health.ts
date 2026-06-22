/**
 * D5 Health Data layer (mobile / client = data SUBJECT).
 *
 * The client logs and reads their OWN observations. Self-reads are not audited;
 * the read is per-metric over a closed [from,to] window (the only read path is
 * the audited RPC, which still serves the subject their own data). Writes carry
 * `subjectUserId = self` and `source` defaults to manual.
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
import { getUserId } from "./session";

export type MetricCategory =
  | "vital" | "body_composition" | "activity" | "sleep" | "nutrition_derived" | "lab" | "wearable";
export type MetricValueType = "numeric" | "integer" | "boolean" | "enum";
export type HealthObsSource = "manual" | "wearable" | "lab" | "coach_entered";

export interface MetricDefinition {
  id: string;
  code: string;
  displayName: string;
  category: MetricCategory;
  valueType: MetricValueType;
  canonicalUnit: string | null;
  isActive: boolean;
}

export interface HealthObservation {
  id: string;
  subjectUserId: string;
  metricDefinitionId: string;
  measuredAt: string;
  measuredDateIst: string;
  valueNumeric: number | null;
  valueBool: boolean | null;
  valueText: string | null;
  unit: string | null;
  source: HealthObsSource;
}

interface MetricsEnvelope { count: number; metrics: MetricDefinition[] }
interface ObservationsEnvelope { count: number; observations: HealthObservation[] }

export const healthKeys = {
  metrics: ["metric-definitions"] as const,
  observations: (metricId: string, from: string, to: string) =>
    ["health-observations", "self", metricId, from, to] as const,
};

export function useMetricDefinitions(options?: Partial<UseQueryOptions<MetricDefinition[]>>) {
  return useQuery({
    queryKey: healthKeys.metrics,
    queryFn: async () => (await apiGet<MetricsEnvelope>("/metric-definitions?activeOnly=true")).metrics,
    staleTime: 5 * 60_000,
    ...options,
  });
}

/** The caller's own readings for one metric over [fromDate, toDate]. */
export function useMyObservations(
  params: { metricDefinitionId?: string; fromDate?: string; toDate?: string },
  options?: Partial<UseQueryOptions<HealthObservation[]>>,
) {
  const { metricDefinitionId, fromDate, toDate } = params;
  const enabled = !!metricDefinitionId && !!fromDate && !!toDate;
  return useQuery({
    queryKey: healthKeys.observations(metricDefinitionId ?? "", fromDate ?? "", toDate ?? ""),
    queryFn: async () => {
      const q = new URLSearchParams({
        subjectUserId: getUserId(),
        metricDefinitionId: metricDefinitionId!,
        fromDate: fromDate!,
        toDate: toDate!,
      });
      return (await apiGet<ObservationsEnvelope>(`/health-observations?${q.toString()}`)).observations;
    },
    enabled,
    staleTime: 30_000,
    ...options,
  });
}

export interface LogObservationInput {
  metricDefinitionId: string;
  valueNumeric?: number;
  valueBool?: boolean;
  valueText?: string;
  unit?: string;
  measuredAt?: string;
}

/**
 * Stable metric ids seeded in scripts/src/seed.ts. The mobile client maps its
 * typed health logs onto these. Keep in sync with the seed.
 */
export const METRIC_IDS = {
  weight_kg: "00000000-0000-0000-0000-0000000005a1",
  water_glasses: "00000000-0000-0000-0000-0000000005a2",
  sleep_hours: "00000000-0000-0000-0000-0000000005a3",
  energy_level: "00000000-0000-0000-0000-0000000005a4",
  mood_level: "00000000-0000-0000-0000-0000000005a5",
} as const;

/**
 * Fire-and-await a single observation write outside a React component (e.g. from
 * a context callback). Mirrors useLogObservation's body but is callable anywhere.
 */
export async function persistObservation(input: LogObservationInput): Promise<{ id: string }> {
  return apiPost<{ id: string }>("/health-observations", {
    subjectUserId: getUserId(),
    ...input,
    source: "manual",
  });
}

export type MetricKey = keyof typeof METRIC_IDS;
export interface HistoryEntry {
  metric: MetricKey;
  value: number;
  measuredAt: string;
}

/**
 * Aggregate the caller's own numeric history across all mapped metrics over the
 * last `days`. One audited read per metric (the only read shape D5 offers), run
 * in parallel. Callable outside a component (e.g. from a context effect).
 */
export async function fetchHealthHistory(days = 120): Promise<HistoryEntry[]> {
  const toDate = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const subjectUserId = getUserId();
  const out: HistoryEntry[] = [];
  await Promise.all(
    (Object.keys(METRIC_IDS) as MetricKey[]).map(async (metric) => {
      try {
        const q = new URLSearchParams({ subjectUserId, metricDefinitionId: METRIC_IDS[metric], fromDate, toDate });
        const env = await apiGet<ObservationsEnvelope>(`/health-observations?${q.toString()}`);
        for (const o of env.observations) {
          if (o.valueNumeric != null) out.push({ metric, value: o.valueNumeric, measuredAt: o.measuredAt });
        }
      } catch {
        /* skip this metric on failure (e.g. no grant / no rows) */
      }
    }),
  );
  return out;
}

/** Log one of the caller's own readings (subjectUserId = self). */
export function useLogObservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LogObservationInput) =>
      apiPost<{ id: string }>("/health-observations", {
        subjectUserId: getUserId(),
        ...input,
        source: "manual",
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["health-observations", "self", vars.metricDefinitionId] });
    },
  });
}
