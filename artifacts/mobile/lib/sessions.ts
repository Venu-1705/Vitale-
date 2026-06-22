/**
 * Coaching sessions data layer (mobile).
 *
 * Talks to the real backend (`/sessions`) over the typed `lib/api` transport, which
 * already injects the Supabase identity headers (see lib/session.ts) and camelizes
 * snake_case payloads. This is the SOLE source of session data — the old mock
 * `context/SessionsContext` has been removed; the shared display types live here now.
 */
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api";

/**
 * The session-card display shape the screens render. (Formerly defined in the
 * removed mock `context/SessionsContext`; kept here so the API mappers have a
 * single shared type.)
 */
export type SessionType = "1-on-1" | "Group" | "Workshop" | "Webinar" | "In-Person";

export type Session = {
  id: string;
  title: string;
  type: SessionType;
  dateTs: number;
  durationMins: number;
  timezone: string;
  coachName: string;
  description: string;
  maxParticipants?: number;
  registeredCount?: number;
  zoomLink?: string;
  materials: { name: string; size: string }[];
  isPast: boolean;
  attended?: boolean;
  recordingLink?: string;
  sessionNotes?: string;
};

/** Camelized `coaching_sessions` row as returned by the API. */
export interface ApiCoachingSession {
  id: string;
  organizationId: string;
  coachUserId: string;
  clientUserId: string;
  title: string;
  description: string | null;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  zoomMeetingId: string | null;
  zoomJoinUrl: string | null;
  zoomStartUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export const sessionKeys = {
  all: ["coaching-sessions"] as const,
  one: (id: string) => ["coaching-session", id] as const,
};

/** A single session by id. `retry: false` so a 404 (mock id) falls back fast. */
export function useApiSession(id: string | undefined) {
  return useQuery({
    queryKey: sessionKeys.one(id ?? "unknown"),
    queryFn: () => apiGet<ApiCoachingSession>(`/sessions/${id}`),
    enabled: !!id,
    retry: false,
  });
}

/** The caller's visible sessions (client sees own; coach sees the org's). */
export function useApiSessions(scope: "upcoming" | "past" | "all" = "all") {
  return useQuery({
    queryKey: [...sessionKeys.all, scope],
    queryFn: () => apiGet<ApiCoachingSession[]>(`/sessions?scope=${scope}`),
    staleTime: 30_000,
  });
}
