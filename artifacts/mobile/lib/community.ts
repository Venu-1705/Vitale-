/**
 * D7 Community data layer (mobile) — wires the feed to the real backend.
 *
 * The backend (`/community-posts`) is org-scoped and RLS-governed; a member sees
 * the posts of orgs whose community they can view. The mobile `organizationId` is
 * resolved from the user's first active access grant (see CommunityContext).
 *
 * Casing: request bodies are camelCase; responses are camelized by the transport.
 * List endpoints wrap rows in `{ count, posts }` / `{ count, comments }`.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { apiGet, apiPost, apiDelete } from "./api";

export type ApiPostType = "text" | "image" | "recipe" | "poll" | "announcement";
export type ApiPostStatus = "active" | "hidden" | "removed";

/** Camelized `community_posts` row. */
export interface ApiCommunityPost {
  id: string;
  organizationId: string;
  authorUserId: string;
  postType: ApiPostType;
  body: string | null;
  media: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  recipeId: string | null;
  isPinned: boolean;
  status: ApiPostStatus;
  likeCount: number;
  commentCount: number;
  /** Server truth: did the calling user like this post? (from the feed subquery) */
  likedByMe: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Camelized `post_comments` row. */
export interface ApiComment {
  id: string;
  postId: string;
  authorUserId: string;
  parentCommentId: string | null;
  body: string;
  status: ApiPostStatus;
  createdAt: string;
  updatedAt: string;
}

interface PostsEnvelope { count: number; posts: ApiCommunityPost[] }
interface CommentsEnvelope { count: number; comments: ApiComment[] }

export const communityKeys = {
  posts: (orgId?: string) => (orgId ? (["community-posts", orgId] as const) : (["community-posts"] as const)),
  comments: (postId: string) => ["post-comments", postId] as const,
};

/** Feed for an org. Disabled (empty) until an organizationId is known. */
export function useCommunityPosts(
  organizationId?: string,
  options?: Partial<UseQueryOptions<ApiCommunityPost[]>>,
) {
  return useQuery({
    queryKey: communityKeys.posts(organizationId),
    queryFn: async () => {
      const qs = organizationId ? `?organizationId=${organizationId}` : "";
      return (await apiGet<PostsEnvelope>(`/community-posts${qs}`)).posts;
    },
    enabled: !!organizationId,
    staleTime: 15_000,
    ...options,
  });
}

export interface CreatePostInput {
  organizationId: string;
  postType: ApiPostType;
  body?: string;
  /** Structured payload (recipe ingredients/steps, poll options, …). */
  metadata?: Record<string, unknown>;
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePostInput) => apiPost<ApiCommunityPost>("/community-posts", input),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: communityKeys.posts(vars.organizationId) }),
  });
}

/**
 * Like / unlike a post (`liked` = desired next state). Optimistically flips `likedByMe`
 * and the count on the cached feed via setQueryData (rolled back on error); onSettled
 * invalidates so the next fetch reflects server truth (no session-local overlay).
 */
export function useToggleLike(organizationId?: string) {
  const qc = useQueryClient();
  const key = communityKeys.posts(organizationId);
  return useMutation({
    mutationFn: async ({ postId, liked }: { postId: string; liked: boolean }) => {
      if (liked) await apiPost(`/community-posts/${postId}/like`, {});
      else await apiDelete(`/community-posts/${postId}/like`);
    },
    onMutate: async ({ postId, liked }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ApiCommunityPost[]>(key);
      if (prev) {
        qc.setQueryData<ApiCommunityPost[]>(
          key,
          prev.map((p) =>
            p.id === postId
              ? { ...p, likedByMe: liked, likeCount: Math.max(0, p.likeCount + (liked ? 1 : -1)) }
              : p,
          ),
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useAddComment(organizationId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, body, parentCommentId }: { postId: string; body: string; parentCommentId?: string }) =>
      apiPost<ApiComment>(`/community-posts/${postId}/comments`, {
        body,
        ...(parentCommentId ? { parentCommentId } : {}),
      }),
    onSuccess: (_d, vars) => {
      // Refetch the feed so the parent post's commentCount reflects the new comment,
      // and the comment list for this post.
      qc.invalidateQueries({ queryKey: communityKeys.posts(organizationId) });
      qc.invalidateQueries({ queryKey: communityKeys.comments(vars.postId) });
    },
  });
}

export function usePostComments(postId: string | undefined) {
  return useQuery({
    queryKey: communityKeys.comments(postId ?? "unknown"),
    queryFn: async () => (await apiGet<CommentsEnvelope>(`/community-posts/${postId}/comments`)).comments,
    enabled: !!postId,
    staleTime: 15_000,
  });
}
