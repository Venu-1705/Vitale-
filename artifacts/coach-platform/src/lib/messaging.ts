/**
 * D13 Messaging data layer for the coach + admin platform.
 *
 * Conversations are DIRECTED (1:1): the caller plus a subject. Creating one needs
 * `conversationType` + `subjectUserId` (the customer or community peer), and
 * `organizationId` for non-peer types. The DB basis gate decides whether the
 * caller may open that conversation shape (422 on an unmet basis). There is NO
 * group-broadcast endpoint and NO recipient directory — participants are added
 * by explicit user id only.
 *
 * Casing: D13 bodies are camelCase (`conversationType`, `subjectUserId`, `body`).
 * List endpoints return raw arrays (no envelope); messages page by keyset
 * (`limit` + `before` = created_at ISO, newest-first).
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { apiDelete, apiGet, apiPatch, apiPost } from "./api";

// ── Enums ───────────────────────────────────────────────────────────────────
export type ConversationType = "coach_user" | "staff_user" | "care_team" | "community_peer";
export type ConversationStatus = "active" | "archived";

// ── DTOs ────────────────────────────────────────────────────────────────────
export interface Conversation {
  id: string;
  organizationId: string | null;
  conversationType: ConversationType;
  subjectUserId: string | null;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  joinedAt: string;
  leftAt: string | null;
  lastReadAt: string | null;
}

export interface Message {
  id: string;
  createdDateIst: string;
  conversationId: string;
  senderUserId: string;
  body: string;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

// ── Query keys ──────────────────────────────────────────────────────────────
export const messagingKeys = {
  conversations: ["conversations"] as const,
  conversation: (id: string) => ["conversation", id] as const,
  participants: (id: string) => ["conversation", id, "participants"] as const,
  messages: (id: string) => ["conversation", id, "messages"] as const,
};

// ── Conversations ───────────────────────────────────────────────────────────
export function useConversations(options?: Partial<UseQueryOptions<Conversation[]>>) {
  return useQuery({
    queryKey: messagingKeys.conversations,
    queryFn: () => apiGet<Conversation[]>("/conversations"),
    staleTime: 20_000,
    ...options,
  });
}

export function useConversation(id: string | undefined, options?: Partial<UseQueryOptions<Conversation>>) {
  return useQuery({
    queryKey: messagingKeys.conversation(id ?? "unknown"),
    queryFn: () => apiGet<Conversation>(`/conversations/${id}`),
    enabled: !!id,
    staleTime: 20_000,
    ...options,
  });
}

export interface CreateConversationInput {
  conversationType: ConversationType;
  subjectUserId: string;
  organizationId?: string;
}
export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateConversationInput) => apiPost<Conversation>("/conversations", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: messagingKeys.conversations }),
  });
}

export function useUpdateConversation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: ConversationStatus) => apiPatch<Conversation>(`/conversations/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: messagingKeys.conversations });
      qc.invalidateQueries({ queryKey: messagingKeys.conversation(id) });
    },
  });
}

// ── Participants ────────────────────────────────────────────────────────────
export function useConversationParticipants(id: string | undefined, options?: Partial<UseQueryOptions<ConversationParticipant[]>>) {
  return useQuery({
    queryKey: messagingKeys.participants(id ?? "unknown"),
    queryFn: () => apiGet<ConversationParticipant[]>(`/conversations/${id}/participants`),
    enabled: !!id,
    staleTime: 30_000,
    ...options,
  });
}

export function useAddParticipant(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => apiPost<ConversationParticipant>(`/conversations/${conversationId}/participants`, { userId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: messagingKeys.participants(conversationId) }),
  });
}

export function useLeaveConversation(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost(`/conversations/${conversationId}/leave`),
    onSuccess: () => qc.invalidateQueries({ queryKey: messagingKeys.conversations }),
  });
}

/** Mark the conversation read up to now (advances the caller's last_read_at). */
export function useMarkConversationRead(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost(`/conversations/${conversationId}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: messagingKeys.participants(conversationId) });
      qc.invalidateQueries({ queryKey: messagingKeys.conversations });
    },
  });
}

// ── Messages ────────────────────────────────────────────────────────────────
export interface MessagePageParams { limit?: number; before?: string }

export function useMessages(conversationId: string | undefined, params: MessagePageParams = {}, options?: Partial<UseQueryOptions<Message[]>>) {
  const q = new URLSearchParams();
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.before) q.set("before", params.before);
  const qs = q.toString();
  return useQuery({
    queryKey: [...messagingKeys.messages(conversationId ?? "unknown"), qs],
    queryFn: () => apiGet<Message[]>(`/conversations/${conversationId}/messages${qs ? `?${qs}` : ""}`),
    enabled: !!conversationId,
    staleTime: 10_000,
    ...options,
  });
}

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => apiPost<Message>(`/conversations/${conversationId}/messages`, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: messagingKeys.messages(conversationId) });
      qc.invalidateQueries({ queryKey: messagingKeys.conversations });
    },
  });
}

export function useEditMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, body }: { messageId: string; body: string }) =>
      apiPatch<Message>(`/messages/${messageId}`, { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: messagingKeys.messages(conversationId) }),
  });
}

export function useDeleteMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => apiDelete(`/messages/${messageId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: messagingKeys.messages(conversationId) }),
  });
}
