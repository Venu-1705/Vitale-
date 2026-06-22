/**
 * D3 Programs data layer for the learner app.
 *
 * One module owns every D3 contract the app talks to — program discovery, the
 * caller's enrollments, the published-version curriculum snapshot, and session
 * watch/progress — expressed as React Query hooks over the typed `lib/api`
 * transport (identity headers + snake→camel normalization happen there).
 *
 * Read-path notes (these mirror the backend's deliberate design, not a gap):
 *   • Curriculum content is NOT exposed as a live modules/sessions GET. The
 *     learner read-path is the immutable PUBLISHED VERSION SNAPSHOT:
 *       GET /programs/:id/versions/:n  →  snapshot = { program, modules:[{…,sessions:[…]}] }
 *     The program row carries `currentVersion`; an enrollment stamps
 *     `programVersionId` (NOT NULL). We read the snapshot at the program's
 *     current version (content is frozen while an active enrollment exists).
 *   • Enrollment WRITES go through SECURITY DEFINER RPCs (POST enroll / cancel).
 *     Paid enrollment is DEFERRED to D8 — the backend returns 422
 *     `payment_required`; callers must surface that truthfully, never simulate.
 *
 * Types mirror the *camelized* backend payloads (the server is uniformly
 * snake_case; `apiRequest` rewrites keys before they reach these hooks), so a
 * column like `price_paise` is read as `pricePaise`. Query-string and request
 * bodies, however, are sent verbatim — so anything the backend Zod validates by
 * snake_case name (`watched_seconds`, `organization_id`) is written snake_case.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { apiGet, apiPost, apiPut } from "./api";

// ── Shared query keys ──────────────────────────────────────────────────────
export const programKeys = {
  programs: (filter?: string) =>
    (filter ? ["programs", filter] : ["programs"]) as readonly unknown[],
  program: (id: string) => ["program", id] as const,
  version: (id: string, n: number) => ["program-version", id, n] as const,
  myEnrollments: ["my-enrollments"] as const,
  watches: (enrollmentId: string) =>
    ["enrollment-watches", enrollmentId] as const,
};

// ── DTOs (camelized backend rows) ───────────────────────────────────────────

export type ProgramStatus = "draft" | "published" | "archived";
export type ProgramVisibility = "private" | "unlisted" | "public";
export type EnrollmentStatus = "active" | "completed" | "cancelled" | "expired";
export type SessionContentType = "video" | "article" | "live" | "task";

/** A row from `public.programs` (SELECT *). */
export interface Program {
  id: string;
  organizationId: string;
  createdByUserId: string;
  title: string;
  slug: string;
  description: string | null;
  coverAssetId: string | null;
  pricePaise: number;
  currency: string;
  durationDays: number | null;
  status: ProgramStatus;
  visibility: ProgramVisibility;
  maxEnrollments: number | null;
  publishedAt: string | null;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

/** A row from `public.program_enrollments`. `/my/enrollments` adds the joins. */
export interface Enrollment {
  id: string;
  programId: string;
  programVersionId: string;
  organizationId: string;
  userId: string;
  status: EnrollmentStatus;
  enrolledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  expiresAt: string | null;
  progressPct: number;
  paymentId: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present only on `GET /my/enrollments` (joined from programs). */
  programTitle?: string;
  programSlug?: string;
}

/** A leaf within a published curriculum snapshot. */
export interface SnapshotSession {
  id: string;
  title: string;
  contentType: SessionContentType;
  videoUrl: string | null;
  content: unknown | null;
  durationSeconds: number | null;
  sortOrder: number;
}

/** A module within a published curriculum snapshot. */
export interface SnapshotModule {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  sessions: SnapshotSession[];
}

/** The self-contained `build_program_snapshot` artifact (camelized). */
export interface ProgramSnapshot {
  program: {
    id: string;
    organizationId: string;
    title: string;
    slug: string;
    description: string | null;
    coverAssetId: string | null;
    pricePaise: number;
    currency: string;
    durationDays: number | null;
    visibility: ProgramVisibility;
    maxEnrollments: number | null;
  };
  modules: SnapshotModule[];
}

/** A row from `public.program_versions` (SELECT *). */
export interface ProgramVersion {
  id: string;
  programId: string;
  versionNumber: number;
  snapshot: ProgramSnapshot;
  createdByUserId: string;
  changeSummary: string | null;
  createdAt: string;
}

/** A row from `public.session_watches`. */
export interface SessionWatch {
  id: string;
  enrollmentId: string;
  sessionId: string;
  userId: string;
  watchedSeconds: number;
  completed: boolean;
  lastWatchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Discovery ───────────────────────────────────────────────────────────────

export interface ProgramListParams {
  visibility?: ProgramVisibility;
  status?: ProgramStatus;
  organizationId?: string;
  limit?: number;
}

/** Backend ListPrograms validates snake_case query keys — build them verbatim. */
function programQuery(params: ProgramListParams): string {
  const q = new URLSearchParams();
  if (params.visibility) q.set("visibility", params.visibility);
  if (params.status) q.set("status", params.status);
  if (params.organizationId) q.set("organization_id", params.organizationId);
  if (params.limit != null) q.set("limit", String(params.limit));
  const s = q.toString();
  return s ? `?${s}` : "";
}

/**
 * Discoverable programs. Defaults to the public storefront slice
 * (published + public) — the only programs an anonymous-tier learner can list.
 */
export function usePrograms(params: ProgramListParams = {}) {
  const effective: ProgramListParams = {
    visibility: "public",
    status: "published",
    ...params,
  };
  const key = programQuery(effective);
  return useQuery({
    queryKey: programKeys.programs(key),
    queryFn: () => apiGet<Program[]>(`/programs${key}`),
    staleTime: 60_000,
  });
}

export function useProgram(
  id: string | undefined,
  options?: Partial<UseQueryOptions<Program>>,
) {
  return useQuery({
    queryKey: programKeys.program(id ?? "unknown"),
    queryFn: () => apiGet<Program>(`/programs/${id}`),
    enabled: !!id,
    staleTime: 60_000,
    ...options,
  });
}

/**
 * The published curriculum snapshot at a given version. Use the program's
 * `currentVersion` (an enrolled learner sees frozen content). Disabled until
 * both the program id and a positive version number are known.
 */
export function useProgramVersion(
  id: string | undefined,
  versionNumber: number | undefined,
  options?: Partial<UseQueryOptions<ProgramVersion>>,
) {
  const enabled = !!id && !!versionNumber && versionNumber > 0;
  return useQuery({
    queryKey: programKeys.version(id ?? "unknown", versionNumber ?? 0),
    queryFn: () => apiGet<ProgramVersion>(`/programs/${id}/versions/${versionNumber}`),
    enabled,
    staleTime: 5 * 60_000,
    ...options,
  });
}

// ── Enrollments ───────────────────────────────────────────────────────────────

export function useMyEnrollments(options?: Partial<UseQueryOptions<Enrollment[]>>) {
  return useQuery({
    queryKey: programKeys.myEnrollments,
    queryFn: () => apiGet<Enrollment[]>("/my/enrollments"),
    staleTime: 30_000,
    ...options,
  });
}

export function useEnrollmentWatches(
  enrollmentId: string | undefined,
  options?: Partial<UseQueryOptions<SessionWatch[]>>,
) {
  return useQuery({
    queryKey: programKeys.watches(enrollmentId ?? "unknown"),
    queryFn: () => apiGet<SessionWatch[]>(`/enrollments/${enrollmentId}/watches`),
    enabled: !!enrollmentId,
    staleTime: 15_000,
    ...options,
  });
}

/**
 * Enroll in a program. FREE programs only — `rpc_enroll_in_program` returns a
 * 422 `payment_required` ApiError for paid programs (D8 deferred). Callers must
 * gate on `program.pricePaise === 0` and surface the paid case truthfully.
 */
export function useEnroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (programId: string) =>
      apiPost<Enrollment>(`/programs/${programId}/enroll`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: programKeys.myEnrollments });
    },
  });
}

export function useCancelEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enrollmentId: string) =>
      apiPost<Enrollment>(`/enrollments/${enrollmentId}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: programKeys.myEnrollments });
    },
  });
}

/**
 * Upsert a session watch. The backend body is validated by snake_case name, so
 * send `watched_seconds` verbatim. The watch drives `tg_rollup_progress`
 * (enrollment.progressPct + auto-completion at 100), so we invalidate both the
 * watch list and the enrollments cache.
 */
export function useMarkWatched() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      enrollmentId,
      sessionId,
      watchedSeconds,
      completed,
    }: {
      enrollmentId: string;
      sessionId: string;
      watchedSeconds?: number;
      completed?: boolean;
    }) =>
      apiPut<SessionWatch>(
        `/enrollments/${enrollmentId}/sessions/${sessionId}/watch`,
        {
          ...(watchedSeconds != null ? { watched_seconds: watchedSeconds } : {}),
          ...(completed != null ? { completed } : {}),
        },
      ),
    onSuccess: (_data, { enrollmentId }) => {
      qc.invalidateQueries({ queryKey: programKeys.watches(enrollmentId) });
      qc.invalidateQueries({ queryKey: programKeys.myEnrollments });
    },
  });
}
