/**
 * D2 Access / Consent layer (coach side) for the coach + admin platform.
 *
 * The onboarding linkage: a client (data subject) grants the coach's ORGANIZATION
 * a source-bound access grant. Grantee-org members with `view_client_health` can
 * read those grants (RLS `access_grants_select`), which is how a newly-consented
 * client "appears" in the coach dashboard — no separate client-invitation entity
 * exists (D0 invitations are staff-only), so the invite is just sharing the org id.
 *
 * Casing: D2 bodies are camelCase. GET /access-grants returns `{ count, grants }`.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { apiGet, apiPatch } from "./api";

export type GrantDataCategory =
  | "health_data" | "meals" | "programs" | "lab_results" | "community" | "orders" | "messages" | "clinical";
export type GrantType = "primary" | "collaborating";
export type AccessLevel = "view_only" | "full";
export type AccessSourceType =
  | "program_enrollment" | "diet_assignment" | "lab_review" | "care_plan" | "collaboration_agreement" | "manual_consent";
export type GrantStatus = "active" | "revoked" | "expired" | "pending";

export interface AccessGrant {
  id: string;
  organizationId: string; // grantee org
  userId: string; // data subject (the client)
  sourceType: AccessSourceType;
  sourceId: string;
  dataCategoriesGranted: GrantDataCategory[];
  grantType: GrantType;
  accessLevel: AccessLevel;
  status: GrantStatus;
  grantedAt: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface GrantsEnvelope { count: number; grants: AccessGrant[] }

export const accessKeys = {
  grants: ["access-grants"] as const,
};

/** All grants visible to the caller — for a coach/org member, the grants naming their org. */
export function useAccessGrants(options?: Partial<UseQueryOptions<AccessGrant[]>>) {
  return useQuery({
    queryKey: accessKeys.grants,
    queryFn: async () => (await apiGet<GrantsEnvelope>("/access-grants")).grants,
    staleTime: 30_000,
    ...options,
  });
}

/** Subject-only action (revokes their own grant); exposed for completeness. */
export function useRevokeGrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPatch<AccessGrant>(`/access-grants/${id}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: accessKeys.grants }),
  });
}
