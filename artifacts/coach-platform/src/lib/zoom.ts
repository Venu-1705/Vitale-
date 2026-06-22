// =============================================================================
// Vitalé Coach Platform — Zoom integration data layer
// =============================================================================
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiDelete, API_BASE } from "./api";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ZoomStatus {
  connected: boolean;
  email?: string;
}

export interface ZoomSdkSignature {
  signature: string;
  sdkKey: string;
  meetingNumber: string;
  role: 0 | 1;
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const zoomKeys = {
  status: ["zoom-status"] as const,
  sdkSignature: (sessionId: string) => ["zoom-sdk-signature", sessionId] as const,
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

/** Whether the current coach has a connected Zoom account. */
export function useZoomStatus() {
  return useQuery({
    queryKey: zoomKeys.status,
    queryFn: () => apiGet<ZoomStatus>("/zoom/status"),
    staleTime: 60_000,
  });
}

/**
 * Initiates Zoom OAuth: redirects the browser to the Zoom consent screen.
 * Returns a function you call on button click.
 */
export function useZoomConnect() {
  return () => {
    window.location.href = `${API_BASE}/zoom/connect`;
  };
}

/** Disconnects the coach's Zoom account (deletes stored tokens). */
export function useZoomDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiDelete("/zoom/connection"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: zoomKeys.status });
    },
  });
}

/**
 * Fetches the Meeting SDK JWT signature needed to embed a session's Zoom meeting.
 * Only fetches when `sessionId` is provided and the session has a Zoom meeting.
 */
export function useZoomSdkSignature(sessionId: string | null) {
  return useQuery({
    queryKey: zoomKeys.sdkSignature(sessionId ?? ""),
    queryFn: () => apiGet<ZoomSdkSignature>(`/zoom/sdk-signature?sessionId=${sessionId}`),
    enabled: !!sessionId,
    staleTime: 90 * 60 * 1000, // signatures are valid 2h; refresh after 90 min
    retry: false,
  });
}
