/**
 * Coaching sessions data layer (coach + admin platform).
 *
 * Talks to the real backend (`/sessions`) over the typed `lib/api` transport.
 * A coach sees their org's sessions (RLS); creating a session and attaching a Zoom
 * meeting are coach-only (manage_programs). Request bodies are validated by the API
 * in camelCase, so they are written camelCase here; responses are camelized.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "./api";

/** Camelized `coaching_sessions` row. */
export interface CoachingSession {
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
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** The `{ meetingId, joinUrl, startUrl }` returned by POST /sessions/:id/zoom. */
export interface ZoomMeetingResult {
  meetingId: string;
  joinUrl: string;
  startUrl: string;
}

export interface CreateSessionInput {
  organizationId: string;
  clientUserId: string;
  title: string;
  scheduledAt: string; // ISO-8601
  durationMinutes?: number;
  description?: string;
  coachUserId?: string;
}

export const sessionKeys = {
  all: ["coaching-sessions"] as const,
};

/** The caller's visible sessions (a coach sees the org's). */
export function useSessions(scope: "upcoming" | "past" | "all" = "all") {
  return useQuery({
    queryKey: [...sessionKeys.all, scope],
    queryFn: () => apiGet<CoachingSession[]>(`/sessions?scope=${scope}`),
    staleTime: 15_000,
  });
}

/** Create a coaching session (coach-only via RLS). */
export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSessionInput) => apiPost<CoachingSession>("/sessions", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionKeys.all }),
  });
}

/** Create (or fetch the existing) Zoom meeting for a session and persist it. */
export function useCreateSessionZoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => apiPost<ZoomMeetingResult>(`/sessions/${sessionId}/zoom`),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionKeys.all }),
  });
}
