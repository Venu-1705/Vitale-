/**
 * D13 Messaging data layer (mobile / client side).
 *
 * The client converses 1:1 with their coach. Conversations are directed (caller +
 * a subject); creating one needs `conversationType` + `subjectUserId` (+ org for
 * non-peer types). No broadcast, no recipient directory — mirrors the backend.
 *
 * Casing: bodies camelCase; list endpoints return arrays; messages page by keyset
 * (`limit` + `before` = created_at ISO, newest-first).
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { apiDelete, apiGet, apiPatch, apiPost } from "./api";
import { getUserId } from "./session";

export type ConversationType = "coach_user" | "staff_user" | "care_team" | "community_peer";
export type ConversationStatus = "active" | "archived";

export interface Conversation {
  id: string;
  organizationId: string | null;
  conversationType: ConversationType;
  subjectUserId: string | null;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
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

export const messagingKeys = {
  conversations: ["conversations"] as const,
  conversation: (id: string) => ["conversation", id] as const,
  messages: (id: string) => ["conversation", id, "messages"] as const,
};

export function useConversations(options?: Partial<UseQueryOptions<Conversation[]>>) {
  return useQuery({
    queryKey: messagingKeys.conversations,
    queryFn: () => apiGet<Conversation[]>("/conversations"),
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

export function useMessages(
  conversationId: string | undefined,
  params: { limit?: number; before?: string } = {},
  options?: Partial<UseQueryOptions<Message[]>>,
) {
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

export function useMarkConversationRead(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost(`/conversations/${conversationId}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: messagingKeys.conversations }),
  });
}

/**
 * Additively persist an outgoing message to the client's REAL coach conversation
 * (resolved from their first active access grant's org), creating that
 * `coach_user` conversation on first use. Callable from a context callback.
 * No-ops silently if the client has no coaching org yet (message stays local).
 * The mock multi-coach display is unaffected; this just makes the message reach
 * the actual coach via D13.
 */
let cachedCoachConversationId: string | null = null;
export async function persistMessageToCoach(text: string): Promise<void> {
  if (!cachedCoachConversationId) {
    const grantsEnv = await apiGet<{ grants: Array<{ organizationId: string; status: string }> }>("/access-grants");
    const org = grantsEnv.grants.find((g) => g.status === "active")?.organizationId;
    if (!org) return; // no coaching org granted yet → local-only
    const convs = await apiGet<Conversation[]>("/conversations");
    const existing = convs.find((c) => c.conversationType === "coach_user" && c.organizationId === org);
    if (existing) {
      cachedCoachConversationId = existing.id;
    } else {
      const created = await apiPost<Conversation>("/conversations", {
        conversationType: "coach_user",
        subjectUserId: getUserId(),
        organizationId: org,
      });
      cachedCoachConversationId = created.id;
    }
  }
  await apiPost(`/conversations/${cachedCoachConversationId}/messages`, { body: text });
}

export interface CoachThreadMessage {
  id: string;
  sentByUser: boolean;
  text: string;
  timestamp: number;
}
export interface CoachThread {
  conversationId: string;
  messages: CoachThreadMessage[]; // chronological (oldest first)
}

/**
 * Read the client's real coach conversation + its messages, mapped to a simple
 * display shape. Resolves the org from the first active access grant. Returns
 * null when there's no coaching org or no conversation yet.
 */
export async function fetchCoachThread(): Promise<CoachThread | null> {
  const grantsEnv = await apiGet<{ grants: Array<{ organizationId: string; status: string }> }>("/access-grants");
  const org = grantsEnv.grants.find((g) => g.status === "active")?.organizationId;
  if (!org) return null;
  const convs = await apiGet<Conversation[]>("/conversations");
  const conv = convs.find((c) => c.conversationType === "coach_user" && c.organizationId === org);
  if (!conv) return null;
  cachedCoachConversationId = conv.id;
  const msgs = await apiGet<Message[]>(`/conversations/${conv.id}/messages?limit=100`);
  const me = getUserId();
  return {
    conversationId: conv.id,
    messages: msgs
      .slice()
      .reverse() // API is newest-first → chronological
      .map((m) => ({ id: m.id, sentByUser: m.senderUserId === me, text: m.body, timestamp: Date.parse(m.createdAt) })),
  };
}

export function useDeleteMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => apiDelete(`/messages/${messageId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: messagingKeys.messages(conversationId) }),
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
