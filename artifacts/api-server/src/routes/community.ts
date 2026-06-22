// =============================================================================
// Vitalé — D7 Community HTTP surface
// -----------------------------------------------------------------------------
// Canonical pipeline (authedRoute → withUserContext): validate → user context →
// DB → map errors → respond. Authorization is NOT re-implemented here — it is owned
// by the D7 RLS policies + triggers + grants (migration post/0109, D7 subset):
//
//   • community_memberships [C, RLS-ON] — who joined which org community (the community
//     half of shares_active_context). INSERT WITH CHECK pins user_id=auth.uid() (or a
//     moderator adding). The partial-unique active key (org,user) WHERE status='active'
//     yields 23505→409 on a double-join; re-join after leaving is allowed. Leave = UPDATE
//     status→'left' (own row or moderator). SELECT = community member + moderator + admin.
//   • community_posts [A, RLS-ON] — org-scoped feed. INSERT WITH CHECK pins
//     author_user_id=auth.uid() AND can_view_org_community(org). UPDATE = author OR
//     moderate_community (edits + moderation status + soft-delete). like_count/comment_count
//     are DENORM counters maintained by tg_like_count/tg_comment_count — never written here.
//   • post_comments [A, RLS-ON] — threaded comments; comment_count on the parent maintained
//     by tg_comment_count (AFTER INSERT/DELETE only → soft-delete via UPDATE does NOT
//     decrement, so the count includes moderated rows by design). Reads exclude hidden/
//     removed comments at the app layer (status='active').
//   • post_likes [RLS-ON, grants S/I/D] — one like per (post,user). Like = INSERT (23505→409
//     on a double-like); unlike = real DELETE (policy USING user_id=auth.uid()).
//   • post_poll_votes [RLS-ON, grants S/I/U/D] — one vote per (post,user); changing a vote is
//     an upsert (onConflictDoUpdate on the (post,user) unique key).
//   • post_flags [C, RLS-ON] — the moderation queue. Blocker-5 CHECK ((post_id IS NULL) !=
//     (comment_id IS NULL)) → exactly one target (422 on breach). INSERT WITH CHECK pins
//     reporter_user_id=auth.uid() AND can_view_org_community(target's org). SELECT = reporter
//     OR moderate_community. UPDATE (triage) = moderate_community only.
//
// Soft-delete: community_posts/post_comments carry NO DELETE grant — removal is an UPDATE that
// sets status='removed' + deleted_at + deleted_by, leaving the row (and its counters) intact.
// =============================================================================
import { Router, type IRouter } from "express";
import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import {
  communityPosts,
  postComments,
  postLikes,
  postPollVotes,
  postFlags,
  communityMemberships,
  uuidv7,
} from "@workspace/db";
import { z } from "zod";
import { authedRoute } from "../lib/route";
import { ApiError } from "../lib/http";

const router: IRouter = Router();

// ----- enum mirrors (exact DB values) ----------------------------------------
const POST_TYPE = ["text", "image", "recipe", "poll", "announcement"] as const;
const POST_STATUS = ["active", "hidden", "removed"] as const;
const FLAG_REASON = ["spam", "abuse", "misinformation", "inappropriate", "other"] as const;
const FLAG_STATUS = ["open", "reviewed", "actioned", "dismissed"] as const;

const IdParam = z.object({ id: z.string().uuid() });
const OrgIdParam = z.object({ orgId: z.string().uuid() });

// =============================================================================
// Community memberships — join / leave / member roster
// =============================================================================

// POST /communities/:orgId/join — caller joins the org community (WITH CHECK pins
// user_id=auth.uid()). A second active join trips the partial-unique active key → 23505 → 409.
//
// NO .returning(): the community_memberships SELECT policy is is_community_member(org) — a
// SECURITY DEFINER re-query of THIS table. During INSERT...RETURNING the new membership row is
// not yet visible to that sub-query (MVCC command visibility), so the RETURNING SELECT-policy
// check fails → spurious 42501. Insert, then read back in a SECOND statement (same txn) where
// the row is visible and the caller is now an active member (same trap/cure as care_plans, D9).
router.post(
  "/communities/:orgId/join",
  authedRoute({ params: OrgIdParam }, async ({ db, params, userId }) => {
    const id = uuidv7();
    await db.insert(communityMemberships).values({ id, organizationId: params.orgId, userId });
    const rows = await db
      .select()
      .from(communityMemberships)
      .where(eq(communityMemberships.id, id));
    return rows[0];
  }),
);

// POST /communities/:orgId/leave — caller leaves (status→'left', stamps left_at). UPDATE policy
// allows own row or a moderator. No active membership → 0 rows → 404.
//
// SELECT-first, then UPDATE without .returning(): once status='left' the leaver is no longer a
// member, so a RETURNING SELECT-policy check on the updated row would fail (is_community_member →
// false). We resolve the active row first (still visible to the active member), 404 if none, then
// UPDATE by id and echo the new state locally — no post-update SELECT under the now-failing policy.
router.post(
  "/communities/:orgId/leave",
  authedRoute({ params: OrgIdParam }, async ({ db, params, userId }) => {
    const existing = await db
      .select({ id: communityMemberships.id })
      .from(communityMemberships)
      .where(
        and(
          eq(communityMemberships.organizationId, params.orgId),
          eq(communityMemberships.userId, userId),
          eq(communityMemberships.status, "active"),
        ),
      );
    if (existing.length === 0 || !existing[0]) {
      throw new ApiError(404, "not_found", "No active membership in this community.");
    }
    const now = new Date();
    await db
      .update(communityMemberships)
      .set({ status: "left", leftAt: now, updatedAt: now })
      .where(eq(communityMemberships.id, existing[0].id));
    return {
      id: existing[0].id,
      organizationId: params.orgId,
      userId,
      status: "left" as const,
      leftAt: now,
    };
  }),
);

// GET /communities/:orgId/members — roster (RLS: community member + moderator + admin).
router.get(
  "/communities/:orgId/members",
  authedRoute({ params: OrgIdParam }, async ({ db, params }) => {
    const rows = await db
      .select()
      .from(communityMemberships)
      .where(eq(communityMemberships.organizationId, params.orgId))
      .orderBy(desc(communityMemberships.joinedAt));
    return { count: rows.length, members: rows };
  }),
);

// =============================================================================
// Community posts — feed CRUD with soft-delete
// =============================================================================
const CreatePostBody = z.object({
  organizationId: z.string().uuid(),
  postType: z.enum(POST_TYPE),
  body: z.string().optional(),
  media: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(), // structured payload (recipe/poll)
  recipeId: z.string().uuid().optional(),
  isPinned: z.boolean().optional(),
});
const UpdatePostBody = z.object({
  body: z.string().optional(),
  media: z.record(z.unknown()).optional(),
  status: z.enum(POST_STATUS).optional(), // moderation (moderate_community)
  isPinned: z.boolean().optional(),
});
const FeedQuery = z.object({
  organizationId: z.string().uuid().optional(),
  status: z.enum(POST_STATUS).optional(), // default: active-only feed
});

// POST /community-posts — author publishes. WITH CHECK pins author=auth.uid() AND
// can_view_org_community(org). like_count/comment_count default 0 (trigger-owned thereafter).
router.post(
  "/community-posts",
  authedRoute({ body: CreatePostBody }, async ({ db, body, userId }) => {
    const rows = await db
      .insert(communityPosts)
      .values({
        id: uuidv7(),
        organizationId: body.organizationId,
        authorUserId: userId,
        postType: body.postType,
        ...(body.body !== undefined ? { body: body.body } : {}),
        ...(body.media !== undefined ? { media: body.media } : {}),
        ...(body.metadata !== undefined ? { metadata: body.metadata } : {}),
        ...(body.recipeId ? { recipeId: body.recipeId } : {}),
        ...(body.isPinned !== undefined ? { isPinned: body.isPinned } : {}),
      })
      .returning();
    return rows[0];
  }),
);

// GET /community-posts — feed (RLS scopes to viewable orgs). Defaults to status='active';
// pass ?status= to see hidden/removed (only moderators read those via RLS). Optional ?organizationId.
router.get(
  "/community-posts",
  authedRoute({ query: FeedQuery }, async ({ db, query }) => {
    const conds = [eq(communityPosts.status, query.status ?? "active")];
    if (query.organizationId) {
      conds.push(eq(communityPosts.organizationId, query.organizationId));
    }
    const rows = await db
      .select({
        ...getTableColumns(communityPosts),
        // Per-row "did the caller like this?" — correlated EXISTS against post_likes for
        // auth.uid() (set by withUserContext). The outer column MUST be table-qualified:
        // post_likes also has an `id`, so a bare "id" would bind to pl.id and never match.
        likedByMe: sql<boolean>`EXISTS (
          SELECT 1 FROM public.post_likes pl
           WHERE pl.post_id = "community_posts"."id" AND pl.user_id = auth.uid()
        )`,
      })
      .from(communityPosts)
      .where(and(...conds))
      .orderBy(desc(communityPosts.isPinned), desc(communityPosts.createdAt));
    return { count: rows.length, posts: rows };
  }),
);

// GET /community-posts/:id — single post (RLS scopes; includes any status the caller may read).
router.get(
  "/community-posts/:id",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const rows = await db.select().from(communityPosts).where(eq(communityPosts.id, params.id));
    if (rows.length === 0) {
      throw new ApiError(404, "not_found", "Post not found.");
    }
    return rows[0];
  }),
);

// PATCH /community-posts/:id — author edits body/media/pin; a moderator may set status
// (hidden/removed). RLS UPDATE = author OR moderate_community.
router.patch(
  "/community-posts/:id",
  authedRoute({ params: IdParam, body: UpdatePostBody }, async ({ db, params, body }) => {
    const rows = await db
      .update(communityPosts)
      .set({
        ...(body.body !== undefined ? { body: body.body } : {}),
        ...(body.media !== undefined ? { media: body.media } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.isPinned !== undefined ? { isPinned: body.isPinned } : {}),
        updatedAt: new Date(),
      })
      .where(eq(communityPosts.id, params.id))
      .returning();
    if (rows.length === 0) {
      throw new ApiError(404, "not_found", "Post not found or not writable.");
    }
    return rows[0];
  }),
);

// DELETE /community-posts/:id — soft-delete (no DELETE grant): UPDATE status='removed' +
// deleted_at + deleted_by. RLS UPDATE = author OR moderate_community.
router.delete(
  "/community-posts/:id",
  authedRoute({ params: IdParam }, async ({ db, params, userId }) => {
    const now = new Date();
    const rows = await db
      .update(communityPosts)
      .set({ status: "removed", deletedAt: now, deletedByUserId: userId, updatedAt: now })
      .where(eq(communityPosts.id, params.id))
      .returning();
    if (rows.length === 0) {
      throw new ApiError(404, "not_found", "Post not found or not writable.");
    }
    return rows[0];
  }),
);

// =============================================================================
// Post comments — threaded, soft-delete; reads exclude hidden/removed
// =============================================================================
const CreateCommentBody = z.object({
  body: z.string().min(1),
  parentCommentId: z.string().uuid().optional(),
});
const UpdateCommentBody = z.object({
  body: z.string().min(1).optional(),
  status: z.enum(POST_STATUS).optional(), // moderation
});

// POST /community-posts/:id/comments — WITH CHECK pins author=auth.uid() AND
// can_view_org_community(post_organization(post_id)). tg_comment_count bumps the parent post.
router.post(
  "/community-posts/:id/comments",
  authedRoute({ params: IdParam, body: CreateCommentBody }, async ({ db, params, body, userId }) => {
    const rows = await db
      .insert(postComments)
      .values({
        id: uuidv7(),
        postId: params.id,
        authorUserId: userId,
        body: body.body,
        ...(body.parentCommentId ? { parentCommentId: body.parentCommentId } : {}),
      })
      .returning();
    return rows[0];
  }),
);

// GET /community-posts/:id/comments — active comments only (hidden/removed excluded at read time,
// per the accepted counter semantics: comment_count still includes moderated rows).
router.get(
  "/community-posts/:id/comments",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const rows = await db
      .select()
      .from(postComments)
      .where(and(eq(postComments.postId, params.id), eq(postComments.status, "active")))
      .orderBy(postComments.createdAt);
    return { count: rows.length, comments: rows };
  }),
);

// PATCH /post-comments/:id — author edits body; moderator sets status. RLS = author OR
// moderate_community(post_organization(post_id)).
router.patch(
  "/post-comments/:id",
  authedRoute({ params: IdParam, body: UpdateCommentBody }, async ({ db, params, body }) => {
    const rows = await db
      .update(postComments)
      .set({
        ...(body.body !== undefined ? { body: body.body } : {}),
        ...(body.status ? { status: body.status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(postComments.id, params.id))
      .returning();
    if (rows.length === 0) {
      throw new ApiError(404, "not_found", "Comment not found or not writable.");
    }
    return rows[0];
  }),
);

// DELETE /post-comments/:id — soft-delete (UPDATE status='removed' + tombstone).
router.delete(
  "/post-comments/:id",
  authedRoute({ params: IdParam }, async ({ db, params, userId }) => {
    const now = new Date();
    const rows = await db
      .update(postComments)
      .set({ status: "removed", deletedAt: now, deletedByUserId: userId, updatedAt: now })
      .where(eq(postComments.id, params.id))
      .returning();
    if (rows.length === 0) {
      throw new ApiError(404, "not_found", "Comment not found or not writable.");
    }
    return rows[0];
  }),
);

// =============================================================================
// Likes — like / unlike (tg_like_count maintains community_posts.like_count)
// =============================================================================

// POST /community-posts/:id/like — WITH CHECK pins user_id=auth.uid(). Double-like → 23505 → 409.
router.post(
  "/community-posts/:id/like",
  authedRoute({ params: IdParam }, async ({ db, params, userId }) => {
    const rows = await db
      .insert(postLikes)
      .values({ id: uuidv7(), postId: params.id, userId })
      .returning();
    return rows[0];
  }),
);

// DELETE /community-posts/:id/like — real DELETE (grant S/I/D; policy USING user_id=auth.uid()).
// Not-liked → 0 rows → 404.
router.delete(
  "/community-posts/:id/like",
  authedRoute({ params: IdParam }, async ({ db, params, userId }) => {
    const rows = await db
      .delete(postLikes)
      .where(and(eq(postLikes.postId, params.id), eq(postLikes.userId, userId)))
      .returning();
    if (rows.length === 0) {
      throw new ApiError(404, "not_found", "Like not found.");
    }
    return { deleted: true, postId: params.id };
  }),
);

// =============================================================================
// Poll votes — one vote per (post,user); changing a vote is an upsert
// =============================================================================
const VoteBody = z.object({ optionIndex: z.number().int().min(0) });

// POST /community-posts/:id/vote — cast/change a vote. onConflictDoUpdate on the (post,user)
// unique key keeps it one-per-user; the UPDATE branch is gated by the policy USING user_id=auth.uid().
router.post(
  "/community-posts/:id/vote",
  authedRoute({ params: IdParam, body: VoteBody }, async ({ db, params, body, userId }) => {
    const rows = await db
      .insert(postPollVotes)
      .values({ id: uuidv7(), postId: params.id, userId, optionIndex: body.optionIndex })
      .onConflictDoUpdate({
        target: [postPollVotes.postId, postPollVotes.userId],
        set: { optionIndex: body.optionIndex },
      })
      .returning();
    return rows[0];
  }),
);

// DELETE /community-posts/:id/vote — retract a vote (grant D; policy USING user_id=auth.uid()).
router.delete(
  "/community-posts/:id/vote",
  authedRoute({ params: IdParam }, async ({ db, params, userId }) => {
    const rows = await db
      .delete(postPollVotes)
      .where(and(eq(postPollVotes.postId, params.id), eq(postPollVotes.userId, userId)))
      .returning();
    if (rows.length === 0) {
      throw new ApiError(404, "not_found", "Vote not found.");
    }
    return { deleted: true, postId: params.id };
  }),
);

// =============================================================================
// Flags — report (any member) + moderation triage (moderate_community)
// =============================================================================
const CreateFlagBody = z
  .object({
    postId: z.string().uuid().optional(),
    commentId: z.string().uuid().optional(),
    reason: z.enum(FLAG_REASON),
  })
  // Blocker-5 mirror: exactly one target. The DB CHECK is authoritative (422 on breach); this
  // gives a clean 422 ZodError before the round-trip when both/neither are supplied.
  .refine((v) => (v.postId == null) !== (v.commentId == null), {
    message: "Exactly one of postId or commentId must be set.",
  });
const TriageFlagBody = z.object({
  status: z.enum(FLAG_STATUS),
});
const FlagQuery = z.object({ status: z.enum(FLAG_STATUS).optional() });

// POST /post-flags — report a post or comment. WITH CHECK pins reporter=auth.uid() AND
// can_view_org_community(target org). The target-exclusive CHECK enforces exactly one target.
router.post(
  "/post-flags",
  authedRoute({ body: CreateFlagBody }, async ({ db, body, userId }) => {
    const rows = await db
      .insert(postFlags)
      .values({
        id: uuidv7(),
        reporterUserId: userId,
        reason: body.reason,
        ...(body.postId ? { postId: body.postId } : {}),
        ...(body.commentId ? { commentId: body.commentId } : {}),
      })
      .returning();
    return rows[0];
  }),
);

// GET /post-flags — queue. RLS shows the caller's own reports + (for moderators) the org's flags.
// Optional ?status filter (default: open queue is most useful but we return all the caller can see).
router.get(
  "/post-flags",
  authedRoute({ query: FlagQuery }, async ({ db, query }) => {
    const rows = await db
      .select()
      .from(postFlags)
      .where(query.status ? eq(postFlags.status, query.status) : sql`true`)
      .orderBy(desc(postFlags.createdAt));
    return { count: rows.length, flags: rows };
  }),
);

// PATCH /post-flags/:id — triage (reviewed/actioned/dismissed) + stamp reviewer. RLS UPDATE =
// moderate_community only.
router.patch(
  "/post-flags/:id",
  authedRoute({ params: IdParam, body: TriageFlagBody }, async ({ db, params, body, userId }) => {
    const rows = await db
      .update(postFlags)
      .set({ status: body.status, reviewedByUserId: userId, updatedAt: new Date() })
      .where(eq(postFlags.id, params.id))
      .returning();
    if (rows.length === 0) {
      throw new ApiError(404, "not_found", "Flag not found or not writable.");
    }
    return rows[0];
  }),
);

export default router;
