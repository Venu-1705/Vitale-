// =============================================================================
// Vitalé — Coaching sessions HTTP surface (coach ↔ client scheduled sessions + Zoom)
// -----------------------------------------------------------------------------
// Canonical pipeline (authedRoute → withUserContext): validate → user context → DB →
// map errors → respond. Authorization is owned by the coaching_sessions RLS policies
// (post/0142_coaching_sessions.sql), NOT re-implemented here:
//   • SELECT  — the client (client_user_id = auth.uid()) OR an org coach (manage_programs).
//   • INSERT/UPDATE — an org coach with manage_programs.
//
// Zoom: POST /sessions/:id/zoom creates a Zoom meeting (Server-to-Server OAuth, lib/zoom.ts)
// and persists meetingId/joinUrl/startUrl on the session. Coach-only and idempotent (a session
// that already has a meeting returns the existing one). Zoom credentials never reach the client;
// the client only receives the join/start URLs Zoom issued.
// =============================================================================
import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { uuidv7 } from "@workspace/db";
import { authedRoute } from "../lib/route";
import { ApiError } from "../lib/http";
import {
  createZoomMeeting,
  createZoomMeetingForCoach,
  isZoomConfigured,
  isOAuthConfigured,
  refreshAccessToken,
} from "../lib/zoom";
import { withServiceContext } from "@workspace/db";

const router: IRouter = Router();

const IdParam = z.object({ id: z.string().uuid() });

// Columns returned to clients — includes the Zoom URLs so the apps can join/start.
const SESSION_COLS = sql`
  id, organization_id, coach_user_id, client_user_id, title, description,
  scheduled_at, duration_minutes, status,
  zoom_meeting_id, zoom_join_url, zoom_start_url,
  created_by, created_at, updated_at
`;

// =============================================================================
// GET /sessions — the caller's visible sessions (RLS: own-as-client OR org coach).
// Optional ?scope=upcoming|past narrows by scheduled_at.
// =============================================================================
const ListQuery = z.object({
  scope: z.enum(["upcoming", "past", "all"]).default("all"),
});
router.get(
  "/",
  authedRoute({ query: ListQuery }, async ({ db, query }) => {
    const scopeClause =
      query.scope === "upcoming"
        ? sql`WHERE scheduled_at >= now()`
        : query.scope === "past"
          ? sql`WHERE scheduled_at < now()`
          : sql``;
    const rows = await db.execute(sql`
      SELECT ${SESSION_COLS}
        FROM public.coaching_sessions
        ${scopeClause}
       ORDER BY scheduled_at DESC
    `);
    return rows.rows;
  }),
);

// =============================================================================
// GET /sessions/:id — a single session (incl. zoom_join_url / zoom_start_url).
// RLS scopes visibility to the client or an org coach.
// =============================================================================
router.get(
  "/:id",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const rows = await db.execute(sql`
      SELECT ${SESSION_COLS}
        FROM public.coaching_sessions WHERE id = ${params.id}::uuid
    `);
    const session = rows.rows[0];
    if (!session) throw new ApiError(404, "not_found", "Session not found.");
    return session;
  }),
);

// =============================================================================
// POST /sessions — create a coaching session (coach-only via RLS insert policy).
// =============================================================================
const CreateBody = z.object({
  organizationId: z.string().uuid(),
  clientUserId: z.string().uuid(),
  /** Defaults to the caller (the creating coach) when omitted. */
  coachUserId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  /** ISO-8601 start time. */
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(5).max(600).default(30),
});
router.post(
  "/",
  authedRoute({ body: CreateBody }, async ({ db, body, userId, res }) => {
    const inserted = await db.execute(sql`
      INSERT INTO public.coaching_sessions
        (id, organization_id, coach_user_id, client_user_id, title, description,
         scheduled_at, duration_minutes, status, created_by)
      VALUES (
        ${uuidv7()}::uuid, ${body.organizationId}::uuid,
        ${body.coachUserId ?? userId}::uuid, ${body.clientUserId}::uuid,
        ${body.title}, ${body.description ?? null},
        ${body.scheduledAt}::timestamptz, ${body.durationMinutes}, 'scheduled',
        ${userId}::uuid
      )
      RETURNING ${SESSION_COLS}
    `);
    res.status(201);
    return inserted.rows[0];
  }),
);

// =============================================================================
// POST /sessions/:id/zoom — create (or return the existing) Zoom meeting for a
// session, persisting it on the row. Coach-only. 503 when Zoom is not configured.
// =============================================================================
router.post(
  "/:id/zoom",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const rows = await db.execute(sql`
      SELECT id, organization_id, coach_user_id, title, scheduled_at, duration_minutes,
             zoom_meeting_id, zoom_join_url, zoom_start_url
        FROM public.coaching_sessions WHERE id = ${params.id}::uuid
    `);
    const session = rows.rows[0] as
      | {
          id: string;
          organization_id: string;
          coach_user_id: string;
          title: string;
          scheduled_at: string | Date;
          duration_minutes: number;
          zoom_meeting_id: string | null;
          zoom_join_url: string | null;
          zoom_start_url: string | null;
        }
      | undefined;
    if (!session) throw new ApiError(404, "not_found", "Session not found.");

    // Coach-only: a client can SELECT the session but must not create its meeting.
    const auth = await db.execute(sql`
      SELECT public.is_org_member(${session.organization_id}::uuid, 'manage_programs') AS ok
    `);
    if (!(auth.rows[0] as { ok: boolean }).ok) {
      throw new ApiError(403, "forbidden", "Only a coach of this organization can create the meeting.");
    }

    // Idempotent: return the existing meeting if one was already created.
    if (session.zoom_meeting_id && session.zoom_join_url && session.zoom_start_url) {
      return {
        meetingId: session.zoom_meeting_id,
        joinUrl: session.zoom_join_url,
        startUrl: session.zoom_start_url,
      };
    }

    // Zoom meeting creation strategy:
    //   1. Per-coach OAuth tokens (preferred) — meeting appears in coach's own Zoom account.
    //   2. Legacy S2S platform account (fallback) — used while coaches haven't connected yet.
    //   3. Neither configured → 503.
    const creatingCoachId = (session as any).coach_user_id as string | undefined ?? "";
    const credRows = await db.execute(sql`
      SELECT access_token, refresh_token, token_expires_at
        FROM public.coach_zoom_credentials
       WHERE coach_user_id = ${creatingCoachId}::uuid
       LIMIT 1
    `);
    const cred = credRows.rows[0] as {
      access_token: string;
      refresh_token: string;
      token_expires_at: string;
    } | undefined;

    let meeting;
    try {
      if (cred && isOAuthConfigured()) {
        // Refresh token proactively if expiring within 60 s.
        let accessToken = cred.access_token;
        if (new Date(cred.token_expires_at).getTime() < Date.now() + 60_000) {
          const refreshed = await refreshAccessToken(cred.refresh_token);
          accessToken = refreshed.accessToken;
          // Persist refreshed tokens via service context (BYPASSRLS — server-initiated).
          await withServiceContext(async (svcDb) => {
            await svcDb.execute(sql`
              UPDATE public.coach_zoom_credentials
                 SET access_token     = ${refreshed.accessToken},
                     refresh_token    = ${refreshed.refreshToken},
                     token_expires_at = ${refreshed.expiresAt.toISOString()}::timestamptz,
                     updated_at       = now()
               WHERE coach_user_id = ${creatingCoachId}::uuid
            `);
          });
        }
        meeting = await createZoomMeetingForCoach(accessToken, {
          topic: session.title,
          startTime: new Date(session.scheduled_at).toISOString(),
          durationMinutes: session.duration_minutes,
        });
      } else if (isZoomConfigured()) {
        meeting = await createZoomMeeting({
          topic: session.title,
          startTime: new Date(session.scheduled_at).toISOString(),
          durationMinutes: session.duration_minutes,
        });
      } else {
        throw new ApiError(
          503,
          "zoom_unavailable",
          "No Zoom account connected. Visit Zoom Integration in Settings to connect your account.",
        );
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(502, "zoom_error", "Could not create the Zoom meeting. Please try again later.");
    }

    await db.execute(sql`
      UPDATE public.coaching_sessions
         SET zoom_meeting_id = ${meeting.meetingId},
             zoom_join_url   = ${meeting.joinUrl},
             zoom_start_url  = ${meeting.startUrl}
       WHERE id = ${params.id}::uuid
    `);

    return meeting;
  }),
);

export default router;
