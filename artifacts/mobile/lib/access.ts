/**
 * D2 Access / Consent layer (client/subject side) for the mobile app.
 *
 * This is the client half of coach→client onboarding: the subject grants their
 * coach's ORGANIZATION a source-bound access grant so the coach can see the
 * consented data categories. Two real, append-only D2 writes, in order:
 *
 *   1) POST /consents       → records a `coach_access` consent event, returns { id }
 *   2) POST /access-grants  → the grant, source-bound to that consent id
 *      (sourceType='manual_consent'; tg_require_consent_on_activate enforces it)
 *
 * The subject reads their own grants via GET /access-grants and can revoke any
 * grant via PATCH /access-grants/:id (RLS scopes both to auth.uid()).
 *
 * Casing: D2 bodies are camelCase. GET returns `{ count, grants }`.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { apiGet, apiPost, apiPatch } from "./api";

export type GrantDataCategory =
  | "health_data" | "meals" | "programs" | "lab_results" | "community" | "orders" | "messages" | "clinical";
export type GrantStatus = "active" | "revoked" | "expired" | "pending";

export interface AccessGrant {
  id: string;
  organizationId: string;
  userId: string;
  sourceType: string;
  sourceId: string;
  dataCategoriesGranted: GrantDataCategory[];
  grantType: "primary" | "collaborating";
  accessLevel: "view_only" | "full";
  status: GrantStatus;
  grantedAt: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ConsentResult {
  id: string;
  consentType: string;
  granted: boolean;
}

interface GrantsEnvelope {
  count: number;
  grants: AccessGrant[];
}

export const accessKeys = {
  grants: ["access-grants"] as const,
};

/** The subject's own grants. */
export function useMyGrants(options?: Partial<UseQueryOptions<AccessGrant[]>>) {
  return useQuery({
    queryKey: accessKeys.grants,
    queryFn: async () => (await apiGet<GrantsEnvelope>("/access-grants")).grants,
    staleTime: 30_000,
    ...options,
  });
}

const CONSENT_TEXT =
  "I consent to share the selected data categories with this coaching " +
  "organization so they can support my health journey. I can revoke this access " +
  "at any time. (DPDP — purpose-limited, revocable.)";

export interface GrantCoachAccessInput {
  organizationId: string;
  dataCategoriesGranted: GrantDataCategory[];
}

/**
 * Grant a coaching org access: append a `coach_access` consent, then create a
 * `manual_consent`-sourced access grant referencing it. Both are real D2 writes;
 * the backend rejects the grant if the consent isn't present (422).
 */
export function useGrantCoachAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: GrantCoachAccessInput): Promise<AccessGrant> => {
      const consent = await apiPost<ConsentResult>("/consents", {
        consentType: "coach_access",
        consentVersion: "1.0",
        consentTextSnapshot: CONSENT_TEXT,
        granted: true,
      });
      return apiPost<AccessGrant>("/access-grants", {
        organizationId: input.organizationId,
        sourceType: "manual_consent",
        sourceId: consent.id,
        dataCategoriesGranted: input.dataCategoriesGranted,
        grantType: "primary",
        accessLevel: "view_only",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: accessKeys.grants }),
  });
}

/** Revoke one of the subject's own grants. */
export function useRevokeGrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPatch<AccessGrant>(`/access-grants/${id}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: accessKeys.grants }),
  });
}

export { CONSENT_TEXT };
