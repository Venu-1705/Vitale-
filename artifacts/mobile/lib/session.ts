/**
 * Centralized session / identity seam (mobile).
 *
 * Production: the backend verifies a Supabase Auth JWT (see
 * api-server/src/middlewares/identity.ts) and maps its `sub` onto `auth.uid()`.
 * We attach the current access token as `Authorization: Bearer …`. The token +
 * user id are kept current by the onAuthStateChange listener in app/_layout.tsx.
 *
 * DEMO_MODE (EXPO_PUBLIC_DEMO_MODE=true, or EXPO_PUBLIC_DEMO_USER_ID set): falls
 * back to the legacy `x-user-id` header against a seeded UUID, for local dev.
 *
 * This is the single place the app decides "who am I" / "what do I send".
 */

const DEMO_MODE =
  process.env.EXPO_PUBLIC_DEMO_USER_ID != null || process.env.EXPO_PUBLIC_DEMO_MODE === "true";

// Demo fallback identity (a valid seeded UUID) — used only in DEMO_MODE.
const FALLBACK_DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

let currentUserId: string | null = DEMO_MODE
  ? process.env.EXPO_PUBLIC_DEMO_USER_ID?.trim() || FALLBACK_DEMO_USER_ID
  : null;

let currentAuthToken: string | null = null;

/** The acting user's id (Supabase `sub` = public.users.id), or the demo id. */
export function getUserId(): string {
  return currentUserId ?? FALLBACK_DEMO_USER_ID;
}

/** Set the acting user id (from the Supabase session) or clear it. */
export function setUserId(userId: string | null): void {
  currentUserId = userId;
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
 * Identity header(s) for every backend request. Prefers the current bearer token;
 * in DEMO_MODE falls back to the `x-user-id` seam; otherwise sends nothing
 * (authed routes 401 → the app routes to login).
 */
export function getAuthHeaders(): Record<string, string> {
  if (currentAuthToken) {
    return { authorization: `Bearer ${currentAuthToken}` };
  }
  if (DEMO_MODE) {
    return { "x-user-id": getUserId() };
  }
  return {};
}
