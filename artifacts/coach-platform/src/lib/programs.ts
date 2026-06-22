/**
 * D3 Programs & Enrollment data layer for the coach + admin platform.
 *
 * Mirrors the mobile app's `lib/programs` but adds the AUTHORING write-path the
 * learner app never needed: program create/update, the publish/version workflow,
 * module + session CRUD, and the coach's enrollment roster. Over the typed
 * `lib/api` transport (identity + snake→camel normalization happen there).
 *
 * Casing: D3 request bodies + query strings are validated by *snake_case* name
 * (`organization_id`, `price_paise`, `sort_order`, `content_type`, `video_url`,
 * `duration_seconds`) — written snake_case at the call site. Responses are
 * camelized by the transport.
 *
 * Backend read-path facts (mirror the design, not gaps to fix here):
 *   • Discovery/detail: GET /programs, GET /programs/:id (live program row).
 *   • Curriculum READ is the immutable PUBLISHED snapshot:
 *       GET /programs/:id/versions/:n  →  { snapshot: { program, modules:[…sessions] } }
 *   • DOCUMENTED GAP: there is NO GET for *live/draft* modules+sessions. Module
 *     and session writes return the created row, but a draft program's curriculum
 *     cannot be re-read over HTTP until it is published (which freezes a snapshot
 *     via tg_bump_program_version). Authoring UIs must treat writes optimistically
 *     and rely on the published snapshot for an authoritative curriculum view.
 *   • Publish = PATCH /programs/:id { status: "published" } (no separate route).
 *   • Paid enrollment is DEFERRED to D8 — backend returns 422 `payment_required`.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "./api";

// ── Enums ───────────────────────────────────────────────────────────────────
export type ProgramStatus = "draft" | "published" | "archived";
export type ProgramVisibility = "private" | "unlisted" | "public";
export type EnrollmentStatus = "active" | "completed" | "cancelled" | "expired";
export type SessionContentType = "video" | "article" | "live" | "task";

// ── DTOs (camelized backend rows) ───────────────────────────────────────────
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

export interface SnapshotSession {
  id: string;
  title: string;
  contentType: SessionContentType;
  videoUrl: string | null;
  content: unknown | null;
  durationSeconds: number | null;
  sortOrder: number;
}

export interface SnapshotModule {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  sessions: SnapshotSession[];
}

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

export interface ProgramVersion {
  id: string;
  programId: string;
  versionNumber: number;
  snapshot: ProgramSnapshot;
  createdByUserId: string;
  changeSummary: string | null;
  createdAt: string;
}

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
  programTitle?: string;
  programSlug?: string;
}

// ── Authoring input shapes (sent snake_case) ────────────────────────────────
export interface CreateProgramInput {
  organization_id: string;
  title: string;
  slug: string;
  description?: string;
  price_paise?: number;
  currency?: string;
  duration_days?: number;
  visibility?: ProgramVisibility;
  max_enrollments?: number;
}

export interface UpdateProgramInput {
  title?: string;
  slug?: string;
  description?: string | null;
  price_paise?: number;
  currency?: string;
  duration_days?: number | null;
  visibility?: ProgramVisibility;
  max_enrollments?: number | null;
  status?: ProgramStatus;
}

export interface ModuleInput {
  title: string;
  description?: string | null;
  sort_order?: number;
}

export interface SessionInput {
  title: string;
  content_type?: SessionContentType;
  video_url?: string | null;
  content?: unknown;
  duration_seconds?: number | null;
  sort_order?: number;
}

// ── Discovery params ─────────────────────────────────────────────────────────
export interface ProgramListParams {
  organizationId?: string;
  status?: ProgramStatus;
  visibility?: ProgramVisibility;
  limit?: number;
}

/** ListPrograms validates snake_case query keys — build them verbatim. */
function programQuery(params: ProgramListParams): string {
  const q = new URLSearchParams();
  if (params.organizationId) q.set("organization_id", params.organizationId);
  if (params.status) q.set("status", params.status);
  if (params.visibility) q.set("visibility", params.visibility);
  if (params.limit != null) q.set("limit", String(params.limit));
  const s = q.toString();
  return s ? `?${s}` : "";
}

// ── Query keys ──────────────────────────────────────────────────────────────
export const programKeys = {
  programs: (filter?: string) => (filter ? ["programs", filter] : ["programs"]) as readonly unknown[],
  program: (id: string) => ["program", id] as const,
  versions: (id: string) => ["program-versions", id] as const,
  version: (id: string, n: number) => ["program-version", id, n] as const,
  roster: (id: string) => ["program-roster", id] as const,
  myEnrollments: ["my-enrollments"] as const,
};

// ── Reads ─────────────────────────────────────────────────────────────────────
/**
 * Programs for the coach console. Unlike the mobile storefront, this defaults to
 * the caller's organization across ALL statuses/visibilities (RLS still scopes
 * to what the caller may see) — pass `organizationId` from the auth store.
 */
export function usePrograms(params: ProgramListParams = {}, options?: Partial<UseQueryOptions<Program[]>>) {
  const key = programQuery(params);
  return useQuery({
    queryKey: programKeys.programs(key),
    queryFn: () => apiGet<Program[]>(`/programs${key}`),
    staleTime: 30_000,
    ...options,
  });
}

export function useProgram(id: string | undefined, options?: Partial<UseQueryOptions<Program>>) {
  return useQuery({
    queryKey: programKeys.program(id ?? "unknown"),
    queryFn: () => apiGet<Program>(`/programs/${id}`),
    enabled: !!id,
    staleTime: 30_000,
    ...options,
  });
}

export function useProgramVersions(id: string | undefined, options?: Partial<UseQueryOptions<ProgramVersion[]>>) {
  return useQuery({
    queryKey: programKeys.versions(id ?? "unknown"),
    queryFn: () => apiGet<ProgramVersion[]>(`/programs/${id}/versions`),
    enabled: !!id,
    staleTime: 60_000,
    ...options,
  });
}

/** The published curriculum snapshot at a version. Disabled until id + n>0 known. */
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

/** Coach's enrollment roster for one program (GET /programs/:id/enrollments). */
export function useProgramRoster(id: string | undefined, options?: Partial<UseQueryOptions<Enrollment[]>>) {
  return useQuery({
    queryKey: programKeys.roster(id ?? "unknown"),
    queryFn: () => apiGet<Enrollment[]>(`/programs/${id}/enrollments`),
    enabled: !!id,
    staleTime: 30_000,
    ...options,
  });
}

// ── Program writes ─────────────────────────────────────────────────────────────
export function useCreateProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProgramInput) => apiPost<Program>("/programs", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: programKeys.programs() }),
  });
}

export function useUpdateProgram(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProgramInput) => apiPatch<Program>(`/programs/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: programKeys.programs() });
      qc.invalidateQueries({ queryKey: programKeys.program(id) });
      qc.invalidateQueries({ queryKey: programKeys.versions(id) });
    },
  });
}

/** Set a program's status by id at call time (list-level archive/publish). */
export function useSetProgramStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProgramStatus }) =>
      apiPatch<Program>(`/programs/${id}`, { status }),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: programKeys.programs() });
      qc.invalidateQueries({ queryKey: programKeys.program(id) });
    },
  });
}

/** Publish = flip status to "published" (backend snapshots the curriculum). */
export function usePublishProgram(id: string) {
  const update = useUpdateProgram(id);
  return {
    ...update,
    publish: () => update.mutate({ status: "published" }),
    archive: () => update.mutate({ status: "archived" }),
  };
}

// ── Composite create (program → modules → sessions → optional publish) ─────────
export interface NewSessionDraft {
  title: string;
  content_type: SessionContentType;
  video_url?: string;
  duration_seconds?: number;
}
export interface NewModuleDraft {
  title: string;
  description?: string;
  sessions: NewSessionDraft[];
}
export interface NewProgramDraft {
  program: CreateProgramInput;
  modules: NewModuleDraft[];
  publish?: boolean;
}

/**
 * Author a whole program in one call: create the program, then its modules and
 * their sessions in order, then optionally publish (which snapshots the
 * curriculum). Centralizes the multi-write sequence so pages stay declarative.
 * Module/session ids come from each write's RETURNING row (camelized).
 */
export function useCreateProgramWithCurriculum() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draft: NewProgramDraft): Promise<Program> => {
      const program = await apiPost<Program>("/programs", draft.program);
      for (let mi = 0; mi < draft.modules.length; mi++) {
        const m = draft.modules[mi];
        const mod = await apiPost<{ id: string }>(`/programs/${program.id}/modules`, {
          title: m.title,
          ...(m.description ? { description: m.description } : {}),
          sort_order: mi,
        });
        for (let si = 0; si < m.sessions.length; si++) {
          const s = m.sessions[si];
          await apiPost(`/programs/${program.id}/modules/${mod.id}/sessions`, {
            title: s.title,
            content_type: s.content_type,
            ...(s.video_url ? { video_url: s.video_url } : {}),
            ...(s.duration_seconds != null ? { duration_seconds: s.duration_seconds } : {}),
            sort_order: si,
          });
        }
      }
      if (draft.publish) {
        await apiPatch<Program>(`/programs/${program.id}`, { status: "published" });
      }
      return program;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: programKeys.programs() }),
  });
}

// ── Module writes ──────────────────────────────────────────────────────────────
export function useCreateModule(programId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ModuleInput) => apiPost<SnapshotModule>(`/programs/${programId}/modules`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: programKeys.program(programId) }),
  });
}

export function useUpdateModule(programId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, ...body }: ModuleInput & { moduleId: string }) =>
      apiPatch<SnapshotModule>(`/programs/${programId}/modules/${moduleId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: programKeys.program(programId) }),
  });
}

export function useDeleteModule(programId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (moduleId: string) => apiDelete(`/programs/${programId}/modules/${moduleId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: programKeys.program(programId) }),
  });
}

// ── Session writes ─────────────────────────────────────────────────────────────
export function useCreateSession(programId: string, moduleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SessionInput) =>
      apiPost<SnapshotSession>(`/programs/${programId}/modules/${moduleId}/sessions`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: programKeys.program(programId) }),
  });
}

export function useUpdateSession(programId: string, moduleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, ...body }: SessionInput & { sessionId: string }) =>
      apiPatch<SnapshotSession>(`/programs/${programId}/modules/${moduleId}/sessions/${sessionId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: programKeys.program(programId) }),
  });
}

export function useDeleteSession(programId: string, moduleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiDelete(`/programs/${programId}/modules/${moduleId}/sessions/${sessionId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: programKeys.program(programId) }),
  });
}

// ── Presentation helpers (no fabricated data) ──────────────────────────────────
export function rupeesFromPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export function isFree(p: Pick<Program, "pricePaise">): boolean {
  return p.pricePaise === 0;
}
