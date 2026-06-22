/**
 * D10 Notifications data layer for the coach + admin platform.
 *
 * The caller's own inbox only (RLS scopes every read/write to user_id =
 * auth.uid()). No fabricated counts or delivery/engagement metrics — the only
 * aggregate the backend exposes is the caller's unread badge count.
 *
 * Endpoints (verified):
 *   GET  /notification-types            → array (catalog: id, key, name, …)
 *   GET  /notifications?unread&limit&before → array (newest-first, keyset)
 *   GET  /notifications/unread-count    → { unread: number }
 *   POST /notifications/:id/read        → the updated row (idempotent)
 *   POST /notifications/read-all        → { updated: number }
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { apiGet, apiPost } from "./api";

// ── DTOs ────────────────────────────────────────────────────────────────────
export interface NotificationType {
  id: string;
  key: string;
  name: string;
  defaultPriority: string | null;
  isActive: boolean;
}

export interface AppNotification {
  id: string;
  createdDateIst: string;
  userId: string;
  notificationTypeId: string | null;
  typeKey: string | null;
  typeName: string | null;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  read: boolean;
  readAt: string | null;
  priority: string | null;
  createdAt: string;
}

// ── Query keys ──────────────────────────────────────────────────────────────
export const notificationKeys = {
  types: ["notification-types"] as const,
  list: (filter?: string) => (filter ? ["notifications", filter] : ["notifications"]) as readonly unknown[],
  unreadCount: ["notifications", "unread-count"] as const,
};

// ── Reads ─────────────────────────────────────────────────────────────────────
export function useNotificationTypes(options?: Partial<UseQueryOptions<NotificationType[]>>) {
  return useQuery({
    queryKey: notificationKeys.types,
    queryFn: () => apiGet<NotificationType[]>("/notification-types"),
    staleTime: 5 * 60_000,
    ...options,
  });
}

export interface NotificationListParams { unread?: boolean; limit?: number; before?: string }

export function useNotifications(params: NotificationListParams = {}, options?: Partial<UseQueryOptions<AppNotification[]>>) {
  const q = new URLSearchParams();
  if (params.unread != null) q.set("unread", String(params.unread));
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.before) q.set("before", params.before);
  const qs = q.toString();
  return useQuery({
    queryKey: notificationKeys.list(qs),
    queryFn: () => apiGet<AppNotification[]>(`/notifications${qs ? `?${qs}` : ""}`),
    staleTime: 15_000,
    ...options,
  });
}

export function useUnreadCount(options?: Partial<UseQueryOptions<number>>) {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: async () => (await apiGet<{ unread: number }>("/notifications/unread-count")).unread,
    staleTime: 15_000,
    ...options,
  });
}

// ── Writes ────────────────────────────────────────────────────────────────────
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<AppNotification>(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<{ updated: number }>("/notifications/read-all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
