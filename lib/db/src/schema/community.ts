// =============================================================================
// Vitalé — D7 Community (Phase 7)
// Ground truth: VITALE_DB_ARCHITECTURE §4 D7 (lines 380-395) + VITALE_IMPLEMENTATION_SPEC
// Part 2 D7 (lines 367-390) + Part 6 Phase 7 order (line 1128: community_posts →
// post_comments → post_likes → post_poll_votes → post_flags (+ counter triggers) → …).
//
// All six D7 tables are NON-partitioned, PK-V7 → Drizzle owns the full DDL here, including the
// two Blocker CHECK constraints (post_flags target-exclusivity; community_memberships status).
// Community is org-scoped: every table is reachable only within a coach_organizations context,
// and peer access is gated by shares_active_context() (whose community half IS this domain's
// community_memberships — see Blocker 3 below).
//
// RLS, grants, the denorm-counter triggers, and the touch triggers live in the raw companion
// 0109_community_gamification_rls.sql:
//   • tg_post_counts / tg_like_count (AFTER INSERT/DELETE on post_likes → community_posts.like_count)
//   • tg_comment_count (AFTER INSERT/DELETE on post_comments → community_posts.comment_count)
//   • tg_touch_updated_at on community_posts / post_comments / post_flags / community_memberships
//   • org-scoped community RLS for all six tables (arch §7 line 751 + per-table specs).
//
// BLOCKER 3 — community_memberships is a NEW D7 table (inventory D7 5→6; launch 90→91). It is
// the community half of shares_active_context() (the peer-messaging gate), recording which
// users joined which org community. status is a TEXT CHECK ('active'|'left'), NOT a new enum,
// so the frozen enum list in arch §3 stays untouched. joined_at is the creation stamp; updated_at
// exists only for tg_touch_updated_at — there is no separate created_at (joined_at IS it).
//
// BLOCKER 5 — post_flags carries CHECK ((post_id IS NULL) != (comment_id IS NULL)): exactly one
// target, blocking both orphaned (neither set) and ambiguous (both set) flags.
// =============================================================================
import { sql } from "drizzle-orm";
import { type AnyPgColumn, boolean, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { pkV7, timestamps } from "./_shared";
import { flagReason, flagStatus, postStatus, postType } from "./enums";
import { users } from "./identity";
import { recipes } from "./nutrition";
import { coachOrganizations } from "./organizations";

// created_at-only audit stamp (no updated_at) for the event tables (like/vote) — no touch trigger.
const createdAtOnly = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
};

// community_posts [A] — a post in an org community. like_count/comment_count are DENORM counters
// maintained by tg_post_counts/tg_like_count/tg_comment_count (raw 0109); never written by the app.
// Soft-delete via deleted_at/deleted_by (status drives moderation: active/hidden/removed).
export const communityPosts = pgTable(
  "community_posts",
  {
    id: pkV7(),
    organizationId: uuid("organization_id").notNull().references(() => coachOrganizations.id),
    authorUserId: uuid("author_user_id").notNull().references(() => users.id),
    postType: postType("post_type").notNull(),
    body: text("body"), // nullable: image/poll/announcement posts may have no text
    media: jsonb("media"), // nullable: media payload (image refs, poll options, …)
    metadata: jsonb("metadata"), // nullable: structured post payload (recipe ingredients/steps, poll options, …)
    recipeId: uuid("recipe_id").references(() => recipes.id), // nullable: only for post_type='recipe'
    likeCount: integer("like_count").notNull().default(0), // denorm (tg_like_count)
    commentCount: integer("comment_count").notNull().default(0), // denorm (tg_comment_count)
    status: postStatus("status").notNull().default("active"),
    isPinned: boolean("is_pinned").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }), // nullable: soft-delete tombstone
    deletedByUserId: uuid("deleted_by").references(() => users.id), // nullable: who removed it (author or moderator)
    ...timestamps,
  },
  (t) => [
    index("community_posts_org_created_idx").on(t.organizationId, t.createdAt.desc()),
  ],
);

// post_comments [A] — threaded comments. parent_comment_id is a nullable self-reference (NULL =
// top-level). like_count is a denorm counter; comment_count on the parent post is maintained by
// tg_comment_count. Soft-delete mirrors community_posts.
export const postComments = pgTable(
  "post_comments",
  {
    id: pkV7(),
    postId: uuid("post_id").notNull().references(() => communityPosts.id),
    authorUserId: uuid("author_user_id").notNull().references(() => users.id),
    parentCommentId: uuid("parent_comment_id").references((): AnyPgColumn => postComments.id), // nullable self-ref: NULL = top-level
    body: text("body").notNull(),
    likeCount: integer("like_count").notNull().default(0), // denorm
    status: postStatus("status").notNull().default("active"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }), // nullable: soft-delete tombstone
    deletedByUserId: uuid("deleted_by").references(() => users.id), // nullable
    ...timestamps,
  },
  (t) => [
    index("post_comments_post_created_idx").on(t.postId, t.createdAt),
    index("post_comments_parent_idx").on(t.parentCommentId),
  ],
);

// post_likes — one like per (post, user). tg_like_count maintains community_posts.like_count on
// INSERT/DELETE. Self-write, community read. created_at is the like timestamp (no updated_at).
export const postLikes = pgTable(
  "post_likes",
  {
    id: pkV7(),
    postId: uuid("post_id").notNull().references(() => communityPosts.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    ...createdAtOnly,
  },
  (t) => [
    uniqueIndex("post_likes_post_user_key").on(t.postId, t.userId),
  ],
);

// post_poll_votes — one vote per (post, user) on a poll post. option_index identifies the chosen
// option in the post's media payload. Self-write, community read. No triggers.
export const postPollVotes = pgTable(
  "post_poll_votes",
  {
    id: pkV7(),
    postId: uuid("post_id").notNull().references(() => communityPosts.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    optionIndex: integer("option_index").notNull(),
    ...createdAtOnly,
  },
  (t) => [
    uniqueIndex("post_poll_votes_post_user_key").on(t.postId, t.userId),
  ],
);

// post_flags [C] — moderation queue. Exactly one of post_id/comment_id is set (Blocker-5 CHECK).
// SELECT = moderate_community + reporter; INSERT = any community member (raw 0109).
export const postFlags = pgTable(
  "post_flags",
  {
    id: pkV7(),
    postId: uuid("post_id").references(() => communityPosts.id), // nullable: set iff flagging a post
    commentId: uuid("comment_id").references(() => postComments.id), // nullable: set iff flagging a comment
    reporterUserId: uuid("reporter_user_id").notNull().references(() => users.id),
    reason: flagReason("reason").notNull(),
    status: flagStatus("status").notNull().default("open"),
    reviewedByUserId: uuid("reviewed_by").references(() => users.id), // nullable: moderator who actioned it
    ...timestamps,
  },
  (t) => [
    // Blocker 5: exactly one target — blocks orphaned (neither) and ambiguous (both) flags.
    check("post_flags_target_exclusive", sql`(${t.postId} IS NULL) != (${t.commentId} IS NULL)`),
    index("post_flags_status_idx").on(t.status),
    index("post_flags_post_idx").on(t.postId),
    index("post_flags_comment_idx").on(t.commentId),
  ],
);

// community_memberships [C] (Blocker 3 — new table) — which users joined which org community.
// The community half of shares_active_context() (peer-messaging gate). status is a TEXT CHECK
// ('active'|'left'), not an enum (keeps the frozen enum list untouched). joined_at is the creation
// stamp; updated_at exists only for tg_touch_updated_at — there is no separate created_at.
export const communityMemberships = pgTable(
  "community_memberships",
  {
    id: pkV7(),
    organizationId: uuid("organization_id").notNull().references(() => coachOrganizations.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    status: text("status").notNull().default("active"), // CHECK ('active'|'left') below
    leftAt: timestamp("left_at", { withTimezone: true }), // nullable: set when status='left'
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(), // tg_touch_updated_at
  },
  (t) => [
    check("community_memberships_status_chk", sql`${t.status} IN ('active', 'left')`),
    // partial-unique: at most ONE active membership per (org, user); re-join allowed after leaving.
    uniqueIndex("community_memberships_active_key").on(t.organizationId, t.userId).where(sql`${t.status} = 'active'`),
    index("community_memberships_user_status_idx").on(t.userId, t.status),
    index("community_memberships_org_status_idx").on(t.organizationId, t.status),
  ],
);

// ----- drizzle-zod validators (arch §11) -------------------------------------
export const insertCommunityPostSchema = createInsertSchema(communityPosts);
export const selectCommunityPostSchema = createSelectSchema(communityPosts);
export const insertPostCommentSchema = createInsertSchema(postComments);
export const selectPostCommentSchema = createSelectSchema(postComments);
export const insertPostLikeSchema = createInsertSchema(postLikes);
export const selectPostLikeSchema = createSelectSchema(postLikes);
export const insertPostPollVoteSchema = createInsertSchema(postPollVotes);
export const selectPostPollVoteSchema = createSelectSchema(postPollVotes);
export const insertPostFlagSchema = createInsertSchema(postFlags);
export const selectPostFlagSchema = createSelectSchema(postFlags);
export const insertCommunityMembershipSchema = createInsertSchema(communityMemberships);
export const selectCommunityMembershipSchema = createSelectSchema(communityMemberships);
