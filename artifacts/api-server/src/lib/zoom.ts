// =============================================================================
// Vitalé — Zoom integration (per-coach OAuth + Meeting SDK signatures)
// -----------------------------------------------------------------------------
// Two separate OAuth apps are used:
//
//   A. General OAuth App (per-coach token flow)
//      ZOOM_OAUTH_CLIENT_ID / ZOOM_OAUTH_CLIENT_SECRET / ZOOM_OAUTH_REDIRECT_URI
//      Each coach connects their own Zoom account. We store access+refresh tokens
//      in coach_zoom_credentials and create meetings under their identity.
//
//   B. Meeting SDK App (embedded meeting UI)
//      ZOOM_SDK_KEY / ZOOM_SDK_SECRET
//      Used server-side to sign JWT tokens so the Zoom Meeting SDK (embedded in
//      the coach platform) can join/host meetings without a separate auth flow.
//
//   Legacy S2S (kept as fallback while transitioning)
//      ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET
//      Used when a coach hasn't connected their own account yet.
//
// No credentials are ever logged or returned to a client.
// =============================================================================
import { createHmac } from "crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

// ── Environment ───────────────────────────────────────────────────────────────
// Legacy S2S
const ACCOUNT_ID    = process.env["ZOOM_ACCOUNT_ID"]?.trim();
const S2S_CLIENT_ID = process.env["ZOOM_CLIENT_ID"]?.trim();
const S2S_SECRET    = process.env["ZOOM_CLIENT_SECRET"]?.trim();

// Per-coach OAuth (General App)
const OAUTH_CLIENT_ID     = process.env["ZOOM_OAUTH_CLIENT_ID"]?.trim();
const OAUTH_CLIENT_SECRET = process.env["ZOOM_OAUTH_CLIENT_SECRET"]?.trim();
export const OAUTH_REDIRECT_URI = process.env["ZOOM_OAUTH_REDIRECT_URI"]?.trim();

// Meeting SDK
const SDK_KEY    = process.env["ZOOM_SDK_KEY"]?.trim();
const SDK_SECRET = process.env["ZOOM_SDK_SECRET"]?.trim();

// State JWT signing — re-uses the Supabase JWT secret so no new secret is needed.
const STATE_SECRET_RAW = process.env["SUPABASE_JWT_SECRET"]?.trim() ?? "";
const STATE_SECRET = new TextEncoder().encode(STATE_SECRET_RAW);

// Coach platform base URL (where the OAuth callback redirect lands after success).
export const COACH_PLATFORM_URL =
  process.env["COACH_PLATFORM_URL"]?.trim() ?? "http://localhost:5173";

const ZOOM_TOKEN_URL = "https://zoom.us/oauth/token";
const ZOOM_API_BASE  = "https://api.zoom.us/v2";

// =============================================================================
// Feature guards
// =============================================================================

/** True only when all legacy S2S credentials are present. */
export function isZoomConfigured(): boolean {
  return Boolean(ACCOUNT_ID && S2S_CLIENT_ID && S2S_SECRET);
}

/** True when per-coach OAuth app credentials are present. */
export function isOAuthConfigured(): boolean {
  return Boolean(OAUTH_CLIENT_ID && OAUTH_CLIENT_SECRET && OAUTH_REDIRECT_URI);
}

/** True when Meeting SDK credentials are present (for embedding). */
export function isSdkConfigured(): boolean {
  return Boolean(SDK_KEY && SDK_SECRET);
}

// =============================================================================
// Legacy S2S — in-process token cache (kept for backward-compat fallback)
// =============================================================================
interface CachedToken { accessToken: string; expiresAt: number; }
let s2sCache: CachedToken | null = null;
const EXPIRY_SAFETY_MS = 60_000;

async function getS2SAccessToken(): Promise<string> {
  if (!ACCOUNT_ID || !S2S_CLIENT_ID || !S2S_SECRET) {
    throw new Error("Zoom S2S is not configured.");
  }
  if (s2sCache && Date.now() < s2sCache.expiresAt - EXPIRY_SAFETY_MS) {
    return s2sCache.accessToken;
  }
  const basic = Buffer.from(`${S2S_CLIENT_ID}:${S2S_SECRET}`).toString("base64");
  const url = `${ZOOM_TOKEN_URL}?grant_type=account_credentials&account_id=${encodeURIComponent(ACCOUNT_ID)}`;
  const res = await fetch(url, { method: "POST", headers: { Authorization: `Basic ${basic}` } });
  if (!res.ok) throw new Error(`Zoom S2S token request failed (${res.status}).`);
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("Zoom S2S token response missing access_token.");
  s2sCache = { accessToken: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return s2sCache.accessToken;
}

export interface CreateMeetingInput {
  topic: string;
  startTime: string;
  durationMinutes: number;
  hostEmail?: string;
}

export interface ZoomMeeting {
  meetingId: string;
  joinUrl: string;
  startUrl: string;
}

async function createMeetingWithToken(accessToken: string, input: CreateMeetingInput, userPath = "me"): Promise<ZoomMeeting> {
  const res = await fetch(`${ZOOM_API_BASE}/users/${userPath}/meetings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      topic: input.topic,
      type: 2,
      start_time: input.startTime,
      duration: input.durationMinutes,
      settings: { join_before_host: false, waiting_room: true },
    }),
  });
  if (!res.ok) throw new Error(`Zoom meeting creation failed (${res.status}).`);
  const body = (await res.json()) as { id?: number | string; join_url?: string; start_url?: string };
  if (!body.id || !body.join_url || !body.start_url) throw new Error("Zoom meeting response missing id/join_url/start_url.");
  return { meetingId: String(body.id), joinUrl: body.join_url, startUrl: body.start_url };
}

/** Create a meeting using the legacy S2S platform account (fallback). */
export async function createZoomMeeting(input: CreateMeetingInput): Promise<ZoomMeeting> {
  const token = await getS2SAccessToken();
  const userPath = input.hostEmail ? encodeURIComponent(input.hostEmail) : "me";
  return createMeetingWithToken(token, input, userPath);
}

// =============================================================================
// Per-coach OAuth flow
// =============================================================================

/** Build the Zoom OAuth authorization URL with a signed, short-lived state token. */
export async function buildOAuthUrl(userId: string): Promise<string> {
  if (!OAUTH_CLIENT_ID || !OAUTH_REDIRECT_URI) throw new Error("Zoom OAuth is not configured.");

  const state = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(STATE_SECRET);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: OAUTH_CLIENT_ID,
    redirect_uri: OAUTH_REDIRECT_URI,
    state,
  });
  return `https://zoom.us/oauth/authorize?${params.toString()}`;
}

/** Verify the state param returned by Zoom; returns the userId it was signed for. */
export async function verifyOAuthState(state: string): Promise<string> {
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(state, STATE_SECRET));
  } catch {
    throw new Error("Invalid or expired OAuth state parameter.");
  }
  const userId = payload["userId"];
  if (typeof userId !== "string") throw new Error("OAuth state payload missing userId.");
  return userId;
}

export interface CoachTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  zoomUserId: string;
  zoomUserEmail: string;
}

/** Exchange an authorization code for coach tokens and fetch the Zoom user profile. */
export async function exchangeCodeForTokens(code: string): Promise<CoachTokens> {
  if (!OAUTH_CLIENT_ID || !OAUTH_CLIENT_SECRET || !OAUTH_REDIRECT_URI) {
    throw new Error("Zoom OAuth is not configured.");
  }
  const basic = Buffer.from(`${OAUTH_CLIENT_ID}:${OAUTH_CLIENT_SECRET}`).toString("base64");
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: OAUTH_REDIRECT_URI,
  });
  const tokenRes = await fetch(`${ZOOM_TOKEN_URL}?${params.toString()}`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
  });
  if (!tokenRes.ok) throw new Error(`Zoom token exchange failed (${tokenRes.status}).`);
  const tokens = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error("Zoom token exchange response missing tokens.");
  }

  // Fetch coach's Zoom profile (user_id + email) using the fresh token.
  const profileRes = await fetch(`${ZOOM_API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileRes.ok) throw new Error(`Zoom profile fetch failed (${profileRes.status}).`);
  const profile = (await profileRes.json()) as { id?: string; email?: string };
  if (!profile.id || !profile.email) throw new Error("Zoom profile response missing id/email.");

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000),
    zoomUserId: profile.id,
    zoomUserEmail: profile.email,
  };
}

/** Refresh an expired coach access token using their stored refresh token. */
export async function refreshAccessToken(refreshToken: string): Promise<Pick<CoachTokens, "accessToken" | "refreshToken" | "expiresAt">> {
  if (!OAUTH_CLIENT_ID || !OAUTH_CLIENT_SECRET) throw new Error("Zoom OAuth is not configured.");
  const basic = Buffer.from(`${OAUTH_CLIENT_ID}:${OAUTH_CLIENT_SECRET}`).toString("base64");
  const params = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken });
  const res = await fetch(`${ZOOM_TOKEN_URL}?${params.toString()}`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
  });
  if (!res.ok) throw new Error(`Zoom token refresh failed (${res.status}).`);
  const body = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!body.access_token || !body.refresh_token) throw new Error("Zoom token refresh response missing tokens.");
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: new Date(Date.now() + (body.expires_in ?? 3600) * 1000),
  };
}

/** Create a Zoom meeting using a coach's own OAuth access token (meetings appear in their account). */
export async function createZoomMeetingForCoach(accessToken: string, input: CreateMeetingInput): Promise<ZoomMeeting> {
  return createMeetingWithToken(accessToken, input, "me");
}

// =============================================================================
// Meeting SDK — JWT signature for embedded meeting UI
// =============================================================================

/**
 * Generate the JWT signature Zoom Meeting SDK requires to join/host a meeting.
 * role: 1 = host (coach), 0 = attendee (client).
 * Uses HMAC-SHA256 — matches Zoom SDK signature spec (SDK v3+).
 */
export function generateSdkSignature(meetingNumber: string, role: 0 | 1): string {
  if (!SDK_KEY || !SDK_SECRET) throw new Error("Zoom SDK is not configured.");
  const iat = Math.round(Date.now() / 1000) - 30;
  const exp = iat + 60 * 60 * 2; // 2-hour signature

  const payload = {
    appKey: SDK_KEY,
    sdkKey: SDK_KEY,
    mn: meetingNumber,
    role,
    iat,
    exp,
    tokenExp: exp,
  };

  // Base64URL-encode header and payload
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body   = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const message = `${header}.${body}`;
  const sig = createHmac("sha256", SDK_SECRET).update(message).digest("base64url");

  return `${message}.${sig}`;
}

export { SDK_KEY as ZOOM_SDK_KEY };
