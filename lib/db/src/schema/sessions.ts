// =============================================================================
// Vitalé — Coaching Sessions (coach ↔ client 1:1 / scheduled video sessions)
// -----------------------------------------------------------------------------
// The dedicated backend for the coaching-session calendar that the mobile app
// previously rendered from a client-side mock (context/SessionsContext). A session
// is owned by a coaching org, scheduled between a coach and a client, and may carry
// a Zoom meeting (created on demand from the coach platform). The three zoom_* columns
// persist the Zoom meeting so the coach can re-open it as host (start_url) and the
// client can join (join_url) across app restarts.
//
// Drizzle owns the table DDL (non-partitioned, PK-V7). RLS, grants, and the
// updated_at touch trigger live in the raw companion migrations/post/0142_coaching_sessions.sql:
//   • SELECT  — the client (client_user_id = auth.uid()) OR an org coach with manage_programs.
//   • INSERT/UPDATE — org coach with manage_programs (creates the session, attaches Zoom).
// status is a plain text column with a CHECK (scheduled|confirmed|completed|cancelled) so no
// new enum type is introduced.
// =============================================================================
import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { pkV7, timestamps } from "./_shared";
import { users } from "./identity";
import { coachOrganizations } from "./organizations";

// coach_zoom_credentials — per-coach Zoom OAuth tokens (one row per coach).
// Created when a coach connects their Zoom account via OAuth; deleted on disconnect.
// Access/refresh tokens are stored in plain text, protected by RLS + TLS.
export const coachZoomCredentials = pgTable("coach_zoom_credentials", {
  id: pkV7(),
  coachUserId: uuid("coach_user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull().references(() => coachOrganizations.id, { onDelete: "cascade" }),
  zoomUserId: text("zoom_user_id").notNull(),
  zoomUserEmail: text("zoom_user_email").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
});

// coaching_sessions [C] — a scheduled coach↔client session, optionally backed by Zoom.
export const coachingSessions = pgTable(
  "coaching_sessions",
  {
    id: pkV7(),
    organizationId: uuid("organization_id").notNull().references(() => coachOrganizations.id),
    coachUserId: uuid("coach_user_id").notNull().references(() => users.id),
    clientUserId: uuid("client_user_id").notNull().references(() => users.id),
    title: text("title").notNull(),
    description: text("description"), // nullable
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(30),
    // scheduled | confirmed | completed | cancelled — CHECK lives in the raw companion.
    status: text("status").notNull().default("scheduled"),
    // Zoom meeting (nullable until a meeting is created for the session).
    zoomMeetingId: text("zoom_meeting_id"),
    zoomJoinUrl: text("zoom_join_url"),
    zoomStartUrl: text("zoom_start_url"),
    createdByUserId: uuid("created_by").notNull().references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index("coaching_sessions_client_scheduled_idx").on(t.clientUserId, t.scheduledAt),
    index("coaching_sessions_org_scheduled_idx").on(t.organizationId, t.scheduledAt),
    index("coaching_sessions_coach_scheduled_idx").on(t.coachUserId, t.scheduledAt),
  ],
);

export const insertCoachingSessionSchema = createInsertSchema(coachingSessions);
export const selectCoachingSessionSchema = createSelectSchema(coachingSessions);
