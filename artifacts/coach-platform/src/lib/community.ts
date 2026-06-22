/**
 * D11 Community data layer for the coach + admin platform.
 *
 * Posts (text/image/recipe/poll/announcement), threaded comments, likes, poll
 * votes, org memberships, and a moderation flag queue. Authorization is the
 * backend's: the feed is RLS-scoped to viewable orgs; hidden/removed posts and
 * the flag queue are moderator-only (`moderate_community`). Like/comment counts
 * are server-denormalized — we never fabricate engagement, moderators, trending,
 * or analytics.
 *
 * Casing: D11 bodies + queries are camelCase (`organizationId`, `postType`,
 * `parentCommentId`, `optionIndex`). List endpoints return `{ count, <plural> }`.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { apiDelete, apiGet, apiPatch, apiPost } from "./api";

// ── Enums ───────────────────────────────────────────────────────────────────
export type PostType = "text" | "image" | "recipe" | "poll" | "announcement";
export type PostStatus = "active" | "hidden" | "removed";
export type FlagReason = "spam" | "abuse" | "misinformation" | "inappropriate" | "other";
export type FlagStatus = "open" | "reviewed" | "actioned" | "dismissed";

// ── DTOs ────────────────────────────────────────────────────────────────────
export interface CommunityPost {
  id: string;
  organizationId: string;
  authorUserId: string;
  postType: PostType;
  body: string | null;
  media: Record<string, unknown> | null;
  recipeId: string | null;
  likeCount: number;
  commentCount: number;
  status: PostStatus;
  isPinned: boolean;
  deletedAt: string | null;
  deletedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PostComment {
  id: string;
  postId: string;
  authorUserId: string;
  parentCommentId: string | null;
  body: string;
  likeCount: number;
  status: PostStatus;
  deletedAt: string | null;
  deletedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityMember {
  id: string;
  organizationId: string;
  userId: string;
  joinedAt: string;
  status: string;
  leftAt: string | null;
  updatedAt: string;
}

export interface PostFlag {
  id: string;
  postId: string | null;
  commentId: string | null;
  reporterUserId: string;
  reason: FlagReason;
  status: FlagStatus;
  reviewedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PostsEnvelope { count: number; posts: CommunityPost[] }
interface CommentsEnvelope { count: number; comments: PostComment[] }
interface MembersEnvelope { count: number; members: CommunityMember[] }
interface FlagsEnvelope { count: number; flags: PostFlag[] }

// ── Query keys ──────────────────────────────────────────────────────────────
export const communityKeys = {
  posts: (filter?: string) => (filter ? ["community-posts", filter] : ["community-posts"]) as readonly unknown[],
  post: (id: string) => ["community-post", id] as const,
  comments: (postId: string) => ["community-post", postId, "comments"] as const,
  members: (orgId: string) => ["community-members", orgId] as const,
  flags: (filter?: string) => (filter ? ["post-flags", filter] : ["post-flags"]) as readonly unknown[],
};

// ── Posts ─────────────────────────────────────────────────────────────────────
export interface FeedParams { organizationId?: string; status?: PostStatus }

function feedQuery(params: FeedParams): string {
  const q = new URLSearchParams();
  if (params.organizationId) q.set("organizationId", params.organizationId);
  if (params.status) q.set("status", params.status);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function useCommunityPosts(params: FeedParams = {}, options?: Partial<UseQueryOptions<CommunityPost[]>>) {
  const key = feedQuery(params);
  return useQuery({
    queryKey: communityKeys.posts(key),
    queryFn: async () => (await apiGet<PostsEnvelope>(`/community-posts${key}`)).posts,
    staleTime: 20_000,
    ...options,
  });
}

export function useCommunityPost(id: string | undefined, options?: Partial<UseQueryOptions<CommunityPost>>) {
  return useQuery({
    queryKey: communityKeys.post(id ?? "unknown"),
    queryFn: () => apiGet<CommunityPost>(`/community-posts/${id}`),
    enabled: !!id,
    staleTime: 20_000,
    ...options,
  });
}

export interface CreatePostInput {
  organizationId: string;
  postType: PostType;
  body?: string;
  media?: Record<string, unknown>;
  recipeId?: string;
  isPinned?: boolean;
}
export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePostInput) => apiPost<CommunityPost>("/community-posts", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: communityKeys.posts() }),
  });
}

export function useUpdatePost(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { body?: string; media?: Record<string, unknown>; status?: PostStatus; isPinned?: boolean }) =>
      apiPatch<CommunityPost>(`/community-posts/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: communityKeys.posts() });
      qc.invalidateQueries({ queryKey: communityKeys.post(id) });
    },
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ deleted: boolean; postId: string }>(`/community-posts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: communityKeys.posts() }),
  });
}

// ── Comments ────────────────────────────────────────────────────────────────
export function usePostComments(postId: string | undefined, options?: Partial<UseQueryOptions<PostComment[]>>) {
  return useQuery({
    queryKey: communityKeys.comments(postId ?? "unknown"),
    queryFn: async () => (await apiGet<CommentsEnvelope>(`/community-posts/${postId}/comments`)).comments,
    enabled: !!postId,
    staleTime: 20_000,
    ...options,
  });
}

export function useCreateComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { body: string; parentCommentId?: string }) =>
      apiPost<PostComment>(`/community-posts/${postId}/comments`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: communityKeys.comments(postId) });
      qc.invalidateQueries({ queryKey: communityKeys.post(postId) });
    },
  });
}

export function useModerateComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, ...body }: { commentId: string; body?: string; status?: PostStatus }) =>
      apiPatch<PostComment>(`/post-comments/${commentId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: communityKeys.comments(postId) }),
  });
}

export function useDeleteComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => apiDelete(`/post-comments/${commentId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: communityKeys.comments(postId) }),
  });
}

// ── Likes & poll votes ──────────────────────────────────────────────────────
export function useLikePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, liked }: { postId: string; liked: boolean }) =>
      liked ? apiDelete(`/community-posts/${postId}/like`) : apiPost(`/community-posts/${postId}/like`),
    onSuccess: () => qc.invalidateQueries({ queryKey: communityKeys.posts() }),
  });
}

export function useVotePost(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (optionIndex: number | null) =>
      optionIndex == null
        ? apiDelete(`/community-posts/${postId}/vote`)
        : apiPost(`/community-posts/${postId}/vote`, { optionIndex }),
    onSuccess: () => qc.invalidateQueries({ queryKey: communityKeys.post(postId) }),
  });
}

// ── Memberships ─────────────────────────────────────────────────────────────
export function useCommunityMembers(orgId: string | undefined, options?: Partial<UseQueryOptions<CommunityMember[]>>) {
  return useQuery({
    queryKey: communityKeys.members(orgId ?? "unknown"),
    queryFn: async () => (await apiGet<MembersEnvelope>(`/communities/${orgId}/members`)).members,
    enabled: !!orgId,
    staleTime: 30_000,
    ...options,
  });
}

export function useJoinCommunity(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<CommunityMember>(`/communities/${orgId}/join`),
    onSuccess: () => qc.invalidateQueries({ queryKey: communityKeys.members(orgId) }),
  });
}

export function useLeaveCommunity(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost(`/communities/${orgId}/leave`),
    onSuccess: () => qc.invalidateQueries({ queryKey: communityKeys.members(orgId) }),
  });
}

// ── Moderation flags ────────────────────────────────────────────────────────
export function usePostFlags(status?: FlagStatus, options?: Partial<UseQueryOptions<PostFlag[]>>) {
  const qs = status ? `?status=${status}` : "";
  return useQuery({
    queryKey: communityKeys.flags(qs),
    queryFn: async () => (await apiGet<FlagsEnvelope>(`/post-flags${qs}`)).flags,
    staleTime: 20_000,
    ...options,
  });
}

export function useCreateFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { postId?: string; commentId?: string; reason: FlagReason }) =>
      apiPost<PostFlag>("/post-flags", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: communityKeys.flags() }),
  });
}

export function useTriageFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: FlagStatus }) =>
      apiPatch<PostFlag>(`/post-flags/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: communityKeys.flags() }),
  });
}
