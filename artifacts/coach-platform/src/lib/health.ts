/**
 * D5 Health Data layer for the coach + admin platform.
 *
 * Two access shapes, mirrored from the backend (authorization is the DB's):
 *   • metric_definitions — public catalog. GET /metric-definitions → { count, metrics }.
 *   • health_observations — REVOKE-API, audited. The ONLY read path is
 *       GET /health-observations?subjectUserId&metricDefinitionId&fromDate&toDate
 *     which delegates to the SECURITY DEFINER `rpc_read_health_observations`: it
 *     re-enforces the ho_select predicate and writes a coach_data_access_audit row
 *     in the same transaction. A coach can read a client's readings ONLY with an
 *     active org membership + an active `health_data` grant on that subject +
 *     `view_client_health`. Self-reads are unaudited. Admins get NO ambient access
 *     — without a grant the RPC denies, so this layer is DPDP-safe by construction.
 *
 * IMPORTANT: the read is per-metric over a closed date window — there is NO
 * "all observations for a client" endpoint. Callers pick a metric + [from,to].
 *
 * Casing: D5 query keys + bodies are camelCase (`subjectUserId`, `activeOnly`).
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { apiGet, apiPost } from "./api";

// ── Enums ───────────────────────────────────────────────────────────────────
export type MetricCategory =
  | "vital" | "body_composition" | "activity" | "sleep" | "nutrition_derived" | "lab" | "wearable";
export type MetricValueType = "numeric" | "integer" | "boolean" | "enum";
export type HealthObsSource = "manual" | "wearable" | "lab" | "coach_entered";

// ── DTOs ────────────────────────────────────────────────────────────────────
export interface MetricDefinition {
  id: string;
  code: string;
  displayName: string;
  category: MetricCategory;
  valueType: MetricValueType;
  canonicalUnit: string | null;
  unitConversions: Record<string, number> | null;
  compoundGroup: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A row returned by the audited rpc_read_health_observations (camelized). */
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
  readingGroupId: string | null;
}

interface MetricsEnvelope { count: number; metrics: MetricDefinition[] }
interface ObservationsEnvelope { count: number; observations: HealthObservation[] }

// ── Query keys ──────────────────────────────────────────────────────────────
export const healthKeys = {
  metrics: (filter?: string) => (filter ? ["metric-definitions", filter] : ["metric-definitions"]) as readonly unknown[],
  observations: (subjectUserId: string, metricDefinitionId: string, fromDate: string, toDate: string) =>
    ["health-observations", subjectUserId, metricDefinitionId, fromDate, toDate] as const,
};

// ── Metric definitions (public catalog) ─────────────────────────────────────
export interface MetricListParams { category?: MetricCategory; activeOnly?: boolean }

function metricQuery(params: MetricListParams): string {
  const q = new URLSearchParams();
  if (params.category) q.set("category", params.category);
  if (params.activeOnly != null) q.set("activeOnly", String(params.activeOnly));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function useMetricDefinitions(params: MetricListParams = {}, options?: Partial<UseQueryOptions<MetricDefinition[]>>) {
  const key = metricQuery(params);
  return useQuery({
    queryKey: healthKeys.metrics(key),
    queryFn: async () => (await apiGet<MetricsEnvelope>(`/metric-definitions${key}`)).metrics,
    staleTime: 5 * 60_000,
    ...options,
  });
}

// ── Health observations (audited, consent-gated, per-metric window) ─────────
export interface ObservationQuery {
  subjectUserId?: string;
  metricDefinitionId?: string;
  fromDate?: string; // YYYY-MM-DD
  toDate?: string; // YYYY-MM-DD
}

/**
 * Read a client's readings for ONE metric over [fromDate, toDate]. Disabled
 * until all four params are present. Triggers a server-side access-audit row
 * (coach reads). Surfaces the backend 403 truthfully if no grant exists.
 */
export function useHealthObservations(params: ObservationQuery, options?: Partial<UseQueryOptions<HealthObservation[]>>) {
  const { subjectUserId, metricDefinitionId, fromDate, toDate } = params;
  const enabled = !!subjectUserId && !!metricDefinitionId && !!fromDate && !!toDate;
  return useQuery({
    queryKey: healthKeys.observations(subjectUserId ?? "", metricDefinitionId ?? "", fromDate ?? "", toDate ?? ""),
    queryFn: async () => {
      const q = new URLSearchParams({
        subjectUserId: subjectUserId!,
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

// ── Write (coach_entered / manual reading) ──────────────────────────────────
export interface LogObservationInput {
  subjectUserId: string;
  metricDefinitionId: string;
  valueNumeric?: number;
  valueBool?: boolean;
  valueText?: string;
  unit?: string;
  measuredAt?: string;
  source?: HealthObsSource;
  recordedByUserId?: string;
}

export function useLogObservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LogObservationInput) =>
      apiPost<{ id: string; subjectUserId: string; metricDefinitionId: string }>("/health-observations", body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["health-observations", vars.subjectUserId, vars.metricDefinitionId] });
    },
  });
}

// ── Display helpers (no fabricated data) ────────────────────────────────────
export function observationValue(o: HealthObservation): string {
  if (o.valueNumeric != null) return `${o.valueNumeric}${o.unit ? ` ${o.unit}` : ""}`;
  if (o.valueBool != null) return o.valueBool ? "Yes" : "No";
  return o.valueText ?? "—";
}
