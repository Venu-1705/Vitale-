// =============================================================================
// Vitalé — Zoom integration routes
// -----------------------------------------------------------------------------
// Per-coach OAuth flow + Meeting SDK signature generation.
//
//   GET  /zoom/status        — { connected, email? } for the calling coach.
//   GET  /zoom/connect       — initiate OAuth (redirect to Zoom consent screen).
//   GET  /zoom/callback      — OAuth callback: exchange code, store tokens, redirect.
//   DELETE /zoom/connection  — disconnect (delete stored tokens).
//   GET  /zoom/sdk-signature — JWT signature for embedding a session via Meeting SDK.
//
// All routes require a verified identity (mounted after requireAuth in index.ts).
// The callback uses withServiceContext (BYPASSRLS) because the OAuth server
// redirects to it without a user token in the request — the userId is embedded
// in the signed state parameter.
// =============================================================================
import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { withServiceContext } from "@workspace/db";
import { authedRoute } from "../lib/route";
import { ApiError } from "../lib/http";
import {
  isOAuthConfigured,
  isSdkConfigured,
  buildOAuthUrl,
  verifyOAuthState,
  exchangeCodeForTokens,
  generateSdkSignature,
  COACH_PLATFORM_URL,
  ZOOM_SDK_KEY,
} from "../lib/zoom";
import type { Request, Response } from "express";

// Authed routes (status, connect, disconnect, sdk-signature)
const router: IRouter = Router();

// Public route — Zoom redirects here with the auth code; no Bearer token present.
// Exported separately so it can be mounted BEFORE the requireAuth gate in index.ts.
export const zoomCallbackRouter: IRouter = Router();

// =============================================================================
// GET /zoom/status — { connected: boolean, email?: string }
// =============================================================================
router.get(
  "/zoom/status",
  authedRoute({}, async ({ db, userId }) => {
    const rows = await db.execute(sql`
      SELECT zoom_user_email FROM public.coach_zoom_credentials
       WHERE coach_user_id = ${userId}::uuid
       LIMIT 1
    `);
    const cred = rows.rows[0] as { zoom_user_email?: string } | undefined;
    if (!cred) return { connected: false };
    return { connected: true, email: cred.zoom_user_email };
  }),
);

// =============================================================================
// GET /zoom/connect — redirect to Zoom OAuth consent screen.
// State = short-lived JWT(userId) to survive the round-trip CSRF-safely.
// =============================================================================
router.get("/zoom/connect", async (req: Request, res: Response) => {
  const user = (req as any).user as { id: string } | undefined;
  if (!user?.id) { res.status(401).json({ error: { code: "unauthenticated" } }); return; }
  if (!isOAuthConfigured()) {
    res.status(503).json({ error: { code: "zoom_unconfigured", message: "Zoom OAuth is not configured on this server." } });
    return;
  }
  try {
    const url = await buildOAuthUrl(user.id);
    res.redirect(url);
  } catch {
    res.status(500).json({ error: { code: "internal", message: "Failed to build Zoom OAuth URL." } });
  }
});

// =============================================================================
// GET /zoom/callback — Zoom redirects here with ?code=...&state=...
// Public (no requireAuth) — mounted on zoomCallbackRouter before the auth gate.
// Identity comes from the signed state JWT, not a Bearer token.
// =============================================================================
zoomCallbackRouter.get("/zoom/callback", async (req: Request, res: Response) => {
  const { code, state, error: oauthError } = req.query as Record<string, string | undefined>;

  if (oauthError) {
    res.redirect(`${COACH_PLATFORM_URL}/coach/zoom-integration?error=${encodeURIComponent(oauthError)}`);
    return;
  }
  if (!code || !state) {
    res.redirect(`${COACH_PLATFORM_URL}/coach/zoom-integration?error=missing_params`);
    return;
  }

  let userId: string;
  try {
    userId = await verifyOAuthState(state);
  } catch {
    res.redirect(`${COACH_PLATFORM_URL}/coach/zoom-integration?error=invalid_state`);
    return;
  }

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code);
  } catch {
    res.redirect(`${COACH_PLATFORM_URL}/coach/zoom-integration?error=token_exchange_failed`);
    return;
  }

  try {
    // Look up the coach's primary organization (needed for the FK).
    await withServiceContext(async (db) => {
      const orgRows = await db.execute(sql`
        SELECT organization_id FROM public.organization_members
         WHERE user_id = ${userId}::uuid
           AND status = 'active'
         ORDER BY joined_at ASC LIMIT 1
      `);
      const orgRow = orgRows.rows[0] as { organization_id?: string } | undefined;
      if (!orgRow?.organization_id) throw new Error("No active organization for this coach.");

      // Upsert: on conflict (one per coach) update the tokens.
      await db.execute(sql`
        INSERT INTO public.coach_zoom_credentials
          (coach_user_id, organization_id, zoom_user_id, zoom_user_email,
           access_token, refresh_token, token_expires_at)
        VALUES (
          ${userId}::uuid, ${orgRow.organization_id}::uuid,
          ${tokens.zoomUserId}, ${tokens.zoomUserEmail},
          ${tokens.accessToken}, ${tokens.refreshToken},
          ${tokens.expiresAt.toISOString()}::timestamptz
        )
        ON CONFLICT (coach_user_id) DO UPDATE SET
          zoom_user_id     = EXCLUDED.zoom_user_id,
          zoom_user_email  = EXCLUDED.zoom_user_email,
          access_token     = EXCLUDED.access_token,
          refresh_token    = EXCLUDED.refresh_token,
          token_expires_at = EXCLUDED.token_expires_at,
          updated_at       = now()
      `);
    });
  } catch {
    res.redirect(`${COACH_PLATFORM_URL}/coach/zoom-integration?error=store_failed`);
    return;
  }

  res.redirect(`${COACH_PLATFORM_URL}/coach/zoom-integration?connected=true`);
});

// =============================================================================
// DELETE /zoom/connection — remove stored tokens (disconnect Zoom account).
// =============================================================================
router.delete(
  "/zoom/connection",
  authedRoute({}, async ({ db, userId }) => {
    await db.execute(sql`
      DELETE FROM public.coach_zoom_credentials
       WHERE coach_user_id = ${userId}::uuid
    `);
    return { disconnected: true };
  }),
);

// =============================================================================
// GET /zoom/sdk-signature?sessionId= — Meeting SDK JWT signature.
// role=1 (host) for the coach, role=0 (attendee) for the client.
// =============================================================================
const SdkQuery = z.object({ sessionId: z.string().uuid() });
router.get(
  "/zoom/sdk-signature",
  authedRoute({ query: SdkQuery }, async ({ db, query, userId }) => {
    if (!isSdkConfigured()) {
      throw new ApiError(503, "zoom_sdk_unavailable", "Zoom Meeting SDK is not configured.");
    }

    const rows = await db.execute(sql`
      SELECT id, coach_user_id, client_user_id, zoom_meeting_id
        FROM public.coaching_sessions
       WHERE id = ${query.sessionId}::uuid
    `);
    const session = rows.rows[0] as {
      id: string;
      coach_user_id: string;
      client_user_id: string;
      zoom_meeting_id: string | null;
    } | undefined;

    if (!session) throw new ApiError(404, "not_found", "Session not found.");
    if (!session.zoom_meeting_id) {
      throw new ApiError(409, "no_zoom_meeting", "This session doesn't have a Zoom meeting yet. Create one first.");
    }

    const isCoach  = session.coach_user_id  === userId;
    const isClient = session.client_user_id === userId;
    if (!isCoach && !isClient) {
      throw new ApiError(403, "forbidden", "You are not a participant in this session.");
    }

    const role = isCoach ? (1 as const) : (0 as const);
    const signature = generateSdkSignature(session.zoom_meeting_id, role);

    return {
      signature,
      sdkKey: ZOOM_SDK_KEY,
      meetingNumber: session.zoom_meeting_id,
      role,
    };
  }),
);

export default router;
