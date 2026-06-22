/**
 * D0 Organizations & Membership data layer for the coach + admin platform.
 *
 * One module owns every D0 contract the app talks to — org discovery/CRUD, the
 * member roster + lifecycle, per-member capability grants, the org profile (KYC
 * ciphertext), invitations, and ownership transfer — expressed as React Query
 * hooks over the typed `lib/api` transport.
 *
 * Casing: the D0 router validates request bodies by *camelCase* field name
 * (`businessName`, `memberRole`, `userId`, `newOwnerId`), unlike the snake_case
 * domains — so bodies are written camelCase here. Responses are camelized by the
 * transport (idempotent on already-camel keys).
 *
 * Security notes mirrored from the backend (not enforced here — the DB is):
 *   • `owner_coach` is never assignable via the API; only `STAFF_ROLES` are.
 *   • PAN / bank details are app-layer ciphertext only — never raw, never logged.
 *   • razorpayLinkedAccountId is accepted non-null only when kycStatus='verified'
 *     (tg_guard_razorpay_account); surface the backend 4xx truthfully.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "./api";

// ── Enums (mirror the DB enums exactly) ─────────────────────────────────────
export type MemberRole = "owner_coach" | "nutritionist" | "community_manager";
/** Roles assignable via the API (owner_coach is provisioned, never granted). */
export type StaffRole = "nutritionist" | "community_manager";
export type MemberStatus = "invited" | "active" | "suspended" | "removed";
export type OrgStatus = "active" | "suspended" | "closed";
export type KycStatus = "pending" | "verified" | "rejected";
export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";
export type Capability =
  | "view_client_health"
  | "manage_programs"
  | "manage_diet_charts"
  | "message_clients"
  | "moderate_community"
  | "manage_staff"
  | "view_revenue"
  | "manage_lab_recommendations"
  | "manage_products"
  | "write_clinical_notes"
  | "manage_care_plans";

export const STAFF_ROLES: StaffRole[] = ["nutritionist", "community_manager"];
export const CAPABILITIES: Capability[] = [
  "view_client_health", "manage_programs", "manage_diet_charts", "message_clients",
  "moderate_community", "manage_staff", "view_revenue", "manage_lab_recommendations",
  "manage_products", "write_clinical_notes", "manage_care_plans",
];

// ── DTOs (camelized backend rows) ───────────────────────────────────────────
export interface Organization {
  id: string;
  ownerCoachId: string;
  businessName: string;
  slug: string;
  status: OrgStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  memberRole: MemberRole;
  status: MemberStatus;
  invitedBy: string | null;
  invitedAt: string | null;
  joinedAt: string | null;
  removedAt: string | null;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MemberPermission {
  id: string;
  memberId: string;
  capability: Capability;
  grantedBy: string | null;
  grantedAt: string;
  createdAt: string;
}

export interface OrganizationProfile {
  id: string;
  organizationId: string;
  legalName: string | null;
  logoAssetId: string | null;
  description: string | null;
  websiteUrl: string | null;
  socialLinks: Record<string, unknown> | null;
  gstin: string | null;
  businessAddress: Record<string, unknown> | null;
  kycStatus: KycStatus;
  razorpayLinkedAccountId: string | null;
  /** Ciphertext only — never render raw. */
  panEncrypted: string | null;
  bankDetailsEncrypted: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Invitation {
  id: string;
  organizationId: string;
  email: string;
  invitedRole: StaffRole;
  token: string;
  status: InvitationStatus;
  invitedBy: string | null;
  expiresAt: string;
  acceptedUserId: string | null;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// List endpoints wrap rows in a `{ count, <plural> }` envelope.
interface OrgListEnvelope { count: number; organizations: Organization[] }
interface MemberListEnvelope { count: number; members: OrganizationMember[] }
interface PermissionListEnvelope { count: number; permissions: MemberPermission[] }
interface InvitationListEnvelope { count: number; invitations: Invitation[] }

// ── Query keys ──────────────────────────────────────────────────────────────
export const orgKeys = {
  all: ["organizations"] as const,
  org: (id: string) => ["organization", id] as const,
  members: (id: string) => ["organization", id, "members"] as const,
  permissions: (id: string, memberId: string) =>
    ["organization", id, "members", memberId, "permissions"] as const,
  profile: (id: string) => ["organization", id, "profile"] as const,
  invitations: (id: string) => ["organization", id, "invitations"] as const,
};

// ── Reads ─────────────────────────────────────────────────────────────────────
export function useOrganizations(options?: Partial<UseQueryOptions<Organization[]>>) {
  return useQuery({
    queryKey: orgKeys.all,
    queryFn: async () => (await apiGet<OrgListEnvelope>("/organizations")).organizations,
    staleTime: 60_000,
    ...options,
  });
}

export function useOrganization(id: string | undefined, options?: Partial<UseQueryOptions<Organization>>) {
  return useQuery({
    queryKey: orgKeys.org(id ?? "unknown"),
    queryFn: () => apiGet<Organization>(`/organizations/${id}`),
    enabled: !!id,
    staleTime: 60_000,
    ...options,
  });
}

export function useOrgMembers(orgId: string | undefined, options?: Partial<UseQueryOptions<OrganizationMember[]>>) {
  return useQuery({
    queryKey: orgKeys.members(orgId ?? "unknown"),
    queryFn: async () => (await apiGet<MemberListEnvelope>(`/organizations/${orgId}/members`)).members,
    enabled: !!orgId,
    staleTime: 30_000,
    ...options,
  });
}

export function useMemberPermissions(
  orgId: string | undefined,
  memberId: string | undefined,
  options?: Partial<UseQueryOptions<MemberPermission[]>>,
) {
  return useQuery({
    queryKey: orgKeys.permissions(orgId ?? "unknown", memberId ?? "unknown"),
    queryFn: async () =>
      (await apiGet<PermissionListEnvelope>(`/organizations/${orgId}/members/${memberId}/permissions`)).permissions,
    enabled: !!orgId && !!memberId,
    staleTime: 30_000,
    ...options,
  });
}

export function useOrgProfile(orgId: string | undefined, options?: Partial<UseQueryOptions<OrganizationProfile | null>>) {
  return useQuery({
    queryKey: orgKeys.profile(orgId ?? "unknown"),
    queryFn: () => apiGet<OrganizationProfile | null>(`/organizations/${orgId}/profile`),
    enabled: !!orgId,
    staleTime: 60_000,
    ...options,
  });
}

export function useOrgInvitations(orgId: string | undefined, options?: Partial<UseQueryOptions<Invitation[]>>) {
  return useQuery({
    queryKey: orgKeys.invitations(orgId ?? "unknown"),
    queryFn: async () => (await apiGet<InvitationListEnvelope>(`/organizations/${orgId}/invitations`)).invitations,
    enabled: !!orgId,
    staleTime: 30_000,
    ...options,
  });
}

// ── Writes ────────────────────────────────────────────────────────────────────
export function useCreateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { businessName: string; slug: string }) =>
      apiPost<Organization>("/organizations", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.all }),
  });
}

export function useUpdateOrg(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { businessName?: string; slug?: string; status?: OrgStatus }) =>
      apiPatch<Organization>(`/organizations/${orgId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgKeys.all });
      qc.invalidateQueries({ queryKey: orgKeys.org(orgId) });
    },
  });
}

export function useCreateMember(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { userId: string; memberRole: StaffRole; status?: MemberStatus }) =>
      apiPost<OrganizationMember>(`/organizations/${orgId}/members`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.members(orgId) }),
  });
}

export function useUpdateMember(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, ...body }: { memberId: string; memberRole?: StaffRole; status?: MemberStatus }) =>
      apiPatch<OrganizationMember>(`/organizations/${orgId}/members/${memberId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.members(orgId) }),
  });
}

export function useRemoveMember(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => apiDelete(`/organizations/${orgId}/members/${memberId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.members(orgId) }),
  });
}

export function useGrantCapability(orgId: string, memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (capability: Capability) =>
      apiPost<MemberPermission>(`/organizations/${orgId}/members/${memberId}/permissions`, { capability }),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.permissions(orgId, memberId) }),
  });
}

export function useRevokeCapability(orgId: string, memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (capability: Capability) =>
      apiDelete(`/organizations/${orgId}/members/${memberId}/permissions/${capability}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.permissions(orgId, memberId) }),
  });
}

export interface ProfileInput {
  legalName?: string;
  description?: string;
  websiteUrl?: string;
  gstin?: string;
  kycStatus?: KycStatus;
  panEncrypted?: string;
  bankDetailsEncrypted?: string;
  razorpayLinkedAccountId?: string;
}

export function useUpsertOrgProfile(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfileInput) => apiPut<OrganizationProfile>(`/organizations/${orgId}/profile`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.profile(orgId) }),
  });
}

export function useCreateInvitation(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; invitedRole: StaffRole; token: string; expiresAt: string }) =>
      apiPost<Invitation>(`/organizations/${orgId}/invitations`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.invitations(orgId) }),
  });
}

export function useUpdateInvitation(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invitationId, status }: { invitationId: string; status: InvitationStatus }) =>
      apiPatch<Invitation>(`/organizations/${orgId}/invitations/${invitationId}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.invitations(orgId) }),
  });
}

export function useTransferOwnership(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (newOwnerId: string) =>
      apiPost<Organization>(`/organizations/${orgId}/transfer-ownership`, { newOwnerId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgKeys.org(orgId) });
      qc.invalidateQueries({ queryKey: orgKeys.members(orgId) });
    },
  });
}
