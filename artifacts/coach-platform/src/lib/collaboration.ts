/**
 * D9 Collaboration & Care data layer for the coach + admin platform.
 *
 * One module owns every D9 contract: cross-org collaboration requests, meetings,
 * revenue-share agreements, and care plans (with their care-team roster and the
 * append-only version ledger). Over the typed `lib/api` transport.
 *
 * Casing: D9 request bodies are validated by *camelCase* field name
 * (`fromOrganizationId`, `memberUserId`, `roleInTeam`, …) — written camelCase
 * here. Responses are camelized by the transport. List endpoints wrap rows in a
 * `{ count, <plural> }` envelope.
 *
 * Authorization is the backend's (RLS + capability grants). Notably:
 *   • `userId` on requests/agreements/care-plans is THE SHARED CUSTOMER.
 *   • Care-plan create needs `manage_care_plans`; team-add of a cross-org
 *     specialist requires a `collaborationAgreementId` (trigger-enforced); a
 *     member's capabilities must be ⊆ their org permissions (trigger-enforced).
 *   • Self/illegal writes are rejected by the DB (422) — surface truthfully.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { apiGet, apiPatch, apiPost } from "./api";

// ── Enums (mirror the DB enums exactly) ─────────────────────────────────────
export type CollabRequestStatus = "pending" | "accepted" | "declined" | "cancelled";
export type CollabMeetingStatus = "scheduled" | "completed" | "cancelled";
export type CollabAgreementStatus = "active" | "ended";
export type CarePlanStatus = "active" | "completed" | "archived";
export type CareTeamRole = "lead" | "nutritionist" | "community_manager" | "collaborating_specialist";
export type CareMemberStatus = "active" | "removed";
export type Capability =
  | "view_client_health" | "manage_programs" | "manage_diet_charts" | "message_clients"
  | "moderate_community" | "manage_staff" | "view_revenue" | "manage_lab_recommendations"
  | "manage_products" | "write_clinical_notes" | "manage_care_plans";

// ── DTOs (camelized backend rows) ───────────────────────────────────────────
export interface CollaborationRequest {
  id: string;
  fromOrganizationId: string;
  toOrganizationId: string;
  userId: string;
  status: CollabRequestStatus;
  message: string | null;
  requestedByUserId: string;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CollaborationMeeting {
  id: string;
  collaborationRequestId: string | null;
  organizationId: string;
  userId: string | null;
  title: string;
  scheduledAt: string;
  durationMinutes: number | null;
  meetingUrl: string | null;
  status: CollabMeetingStatus;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollaborationAgreement {
  id: string;
  primaryOrganizationId: string;
  collaboratingOrganizationId: string;
  userId: string;
  terms: Record<string, unknown> | null;
  revenueSharePct: string | null; // numeric → string over the wire
  status: CollabAgreementStatus;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CarePlan {
  id: string;
  organizationId: string;
  userId: string;
  title: string;
  description: string | null;
  status: CarePlanStatus;
  createdByUserId: string;
  currentVersion: number;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CareTeamMember {
  id: string;
  carePlanId: string;
  memberUserId: string;
  organizationId: string;
  roleInTeam: CareTeamRole;
  status: CareMemberStatus;
  capabilities: Capability[];
  collaborationAgreementId: string | null;
  addedByUserId: string;
  addedAt: string;
  removedAt: string | null;
  updatedAt: string;
}

export interface CarePlanVersion {
  id: string;
  carePlanId: string;
  versionNumber: number;
  snapshot: Record<string, unknown>;
  authoredByUserId: string;
  changeSummary: string | null;
  createdAt: string;
}

// envelopes
interface RequestsEnvelope { count: number; requests: CollaborationRequest[] }
interface MeetingsEnvelope { count: number; meetings: CollaborationMeeting[] }
interface AgreementsEnvelope { count: number; agreements: CollaborationAgreement[] }
interface CarePlansEnvelope { count: number; carePlans: CarePlan[] }
interface CareTeamEnvelope { count: number; members: CareTeamMember[] }
interface VersionsEnvelope { count: number; versions: CarePlanVersion[] }

// ── Query keys ──────────────────────────────────────────────────────────────
export const collabKeys = {
  requests: ["collaboration-requests"] as const,
  meetings: ["collaboration-meetings"] as const,
  agreements: ["collaboration-agreements"] as const,
  carePlans: ["care-plans"] as const,
  carePlan: (id: string) => ["care-plan", id] as const,
  careTeam: (id: string) => ["care-plan", id, "team"] as const,
  carePlanVersions: (id: string) => ["care-plan", id, "versions"] as const,
};

// ── Collaboration requests ──────────────────────────────────────────────────
export function useCollaborationRequests(options?: Partial<UseQueryOptions<CollaborationRequest[]>>) {
  return useQuery({
    queryKey: collabKeys.requests,
    queryFn: async () => (await apiGet<RequestsEnvelope>("/collaboration-requests")).requests,
    staleTime: 30_000,
    ...options,
  });
}

export function useCreateCollaborationRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { fromOrganizationId: string; toOrganizationId: string; userId: string; message?: string }) =>
      apiPost<CollaborationRequest>("/collaboration-requests", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: collabKeys.requests }),
  });
}

export function useUpdateCollaborationRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "accepted" | "declined" | "cancelled" }) =>
      apiPatch<CollaborationRequest>(`/collaboration-requests/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: collabKeys.requests }),
  });
}

// ── Collaboration meetings ──────────────────────────────────────────────────
export function useCollaborationMeetings(options?: Partial<UseQueryOptions<CollaborationMeeting[]>>) {
  return useQuery({
    queryKey: collabKeys.meetings,
    queryFn: async () => (await apiGet<MeetingsEnvelope>("/collaboration-meetings")).meetings,
    staleTime: 30_000,
    ...options,
  });
}

export interface CreateMeetingInput {
  organizationId: string;
  collaborationRequestId?: string;
  userId?: string;
  title: string;
  scheduledAt: string;
  durationMinutes?: number;
  meetingUrl?: string;
}
export function useCreateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateMeetingInput) => apiPost<CollaborationMeeting>("/collaboration-meetings", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: collabKeys.meetings }),
  });
}

export function useUpdateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status?: CollabMeetingStatus; scheduledAt?: string; meetingUrl?: string }) =>
      apiPatch<CollaborationMeeting>(`/collaboration-meetings/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: collabKeys.meetings }),
  });
}

// ── Collaboration agreements ────────────────────────────────────────────────
export function useCollaborationAgreements(options?: Partial<UseQueryOptions<CollaborationAgreement[]>>) {
  return useQuery({
    queryKey: collabKeys.agreements,
    queryFn: async () => (await apiGet<AgreementsEnvelope>("/collaboration-agreements")).agreements,
    staleTime: 30_000,
    ...options,
  });
}

export interface CreateAgreementInput {
  primaryOrganizationId: string;
  collaboratingOrganizationId: string;
  userId: string;
  terms?: Record<string, unknown>;
  revenueSharePct?: number;
  startDate: string;
  endDate?: string;
}
export function useCreateAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAgreementInput) => apiPost<CollaborationAgreement>("/collaboration-agreements", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: collabKeys.agreements }),
  });
}

export function useUpdateAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status?: CollabAgreementStatus; endDate?: string }) =>
      apiPatch<CollaborationAgreement>(`/collaboration-agreements/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: collabKeys.agreements }),
  });
}

// ── Care plans ──────────────────────────────────────────────────────────────
export function useCarePlans(options?: Partial<UseQueryOptions<CarePlan[]>>) {
  return useQuery({
    queryKey: collabKeys.carePlans,
    queryFn: async () => (await apiGet<CarePlansEnvelope>("/care-plans")).carePlans,
    staleTime: 30_000,
    ...options,
  });
}

export function useCarePlan(id: string | undefined, options?: Partial<UseQueryOptions<CarePlan>>) {
  return useQuery({
    queryKey: collabKeys.carePlan(id ?? "unknown"),
    queryFn: () => apiGet<CarePlan>(`/care-plans/${id}`),
    enabled: !!id,
    staleTime: 30_000,
    ...options,
  });
}

export interface CreateCarePlanInput {
  organizationId: string;
  userId: string;
  title: string;
  description?: string;
  startDate?: string;
  endDate?: string;
}
export function useCreateCarePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCarePlanInput) => apiPost<CarePlan>("/care-plans", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: collabKeys.carePlans }),
  });
}

export function useUpdateCarePlan(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title?: string; description?: string; status?: CarePlanStatus; startDate?: string; endDate?: string }) =>
      apiPatch<CarePlan>(`/care-plans/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: collabKeys.carePlans });
      qc.invalidateQueries({ queryKey: collabKeys.carePlan(id) });
    },
  });
}

// ── Care team ───────────────────────────────────────────────────────────────
export function useCareTeam(carePlanId: string | undefined, options?: Partial<UseQueryOptions<CareTeamMember[]>>) {
  return useQuery({
    queryKey: collabKeys.careTeam(carePlanId ?? "unknown"),
    queryFn: async () => (await apiGet<CareTeamEnvelope>(`/care-plans/${carePlanId}/team`)).members,
    enabled: !!carePlanId,
    staleTime: 30_000,
    ...options,
  });
}

export interface AddCareTeamMemberInput {
  memberUserId: string;
  organizationId: string;
  roleInTeam: CareTeamRole;
  capabilities?: Capability[];
  collaborationAgreementId?: string;
}
export function useAddCareTeamMember(carePlanId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AddCareTeamMemberInput) => apiPost<CareTeamMember>(`/care-plans/${carePlanId}/team`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: collabKeys.careTeam(carePlanId) }),
  });
}

export function useUpdateCareTeamMember(carePlanId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, ...body }: { memberId: string; status?: CareMemberStatus; capabilities?: Capability[] }) =>
      apiPatch<CareTeamMember>(`/care-team-members/${memberId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: collabKeys.careTeam(carePlanId) }),
  });
}

// ── Care plan versions (append-only ledger) ─────────────────────────────────
export function useCarePlanVersions(carePlanId: string | undefined, options?: Partial<UseQueryOptions<CarePlanVersion[]>>) {
  return useQuery({
    queryKey: collabKeys.carePlanVersions(carePlanId ?? "unknown"),
    queryFn: async () => (await apiGet<VersionsEnvelope>(`/care-plans/${carePlanId}/versions`)).versions,
    enabled: !!carePlanId,
    staleTime: 60_000,
    ...options,
  });
}

export function useCreateCarePlanVersion(carePlanId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { snapshot: Record<string, unknown>; changeSummary?: string; versionNumber?: number }) =>
      apiPost<CarePlanVersion>(`/care-plans/${carePlanId}/versions`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: collabKeys.carePlanVersions(carePlanId) });
      qc.invalidateQueries({ queryKey: collabKeys.carePlan(carePlanId) });
    },
  });
}
