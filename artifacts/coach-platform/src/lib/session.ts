/**
 * Centralized session / identity seam (coach + admin platform).
 *
 * Production: the backend verifies a Supabase Auth JWT (see
 * api-server/src/middlewares/identity.ts) and maps its `sub` onto `auth.uid()`.
 * This module attaches the CURRENT access token as `Authorization: Bearer …` to
 * every request. The token is kept fresh by the `onAuthStateChange` listener in
 * App.tsx (which calls `setAuthToken` on sign-in and every token refresh).
 *
 * This is the single place the app decides "who am I" / "what do I send".
 */
import { useAuthStore } from "@/stores/auth-store";

// The live access token, updated by App.tsx's auth-state listener (sign-in,
// TOKEN_REFRESHED, sign-out). Read synchronously so getAuthHeaders() stays sync.
let currentAuthToken: string | null = null;

/** The acting user's id (Supabase `sub` = public.users.id), if signed in. */
export function getUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

/** The acting organization for the signed-in coach, if resolved. */
export function getOrganizationId(): string | null {
  return useAuthStore.getState().user?.organizationId ?? null;
}

/** The current bearer token, if a session is established. */
export function getAuthToken(): string | null {
  return currentAuthToken;
}

/** Set/clear the current access token. Called by the auth-state listener. */
export function setAuthToken(token: string | null): void {
  currentAuthToken = token;
}

/**
 * Identity header(s) for every backend request. Attaches the current bearer
 * token; sends nothing when unauthenticated (authed routes then 401 → the app
 * redirects to /login). No demo header in production.
 */
export function getAuthHeaders(): Record<string, string> {
  return currentAuthToken ? { authorization: `Bearer ${currentAuthToken}` } : {};
}
