// =============================================================================
// Vitalé — D6 Gamification (Phase 7)
// Ground truth: VITALE_DB_ARCHITECTURE §4 D6 (lines 367-378) + VITALE_IMPLEMENTATION_SPEC
// Part 2 D6 (lines 352-363) + Part 6 Phase 7 order (line 1128: … → gamification:
// user_streaks / user_badges / leaderboard_scores).
//
// All three D6 tables are NON-partitioned, PK-V7 → Drizzle owns the full DDL here.
//
// badge_types is NOT modeled here: it is the evolving-set lookup created + seeded in raw
// 0003_lookup_tables.sql (arch §2 — evolving sets are lookup TABLES, not enums). Because it
// is a raw-only table (no Drizzle pgTable), user_badges.badge_type_id is a PLAIN uuid column
// with NO Drizzle .references(); its FK → badge_types(id) is added in raw 0109 (same pattern
// as programs.payment_id → enrollment_payments).
//
// RLS, grants, and triggers live in the raw post-companion 0109_community_gamification_rls.sql:
//   • user_streaks       RLS-ON self + admins SELECT; streak-rollover job (service-role) writes;
//                        tg_touch_updated_at (the one D6 table with updated_at).
//   • user_badges        RLS-ON SELECT self + public profile; INSERT via award RPC (service-role).
//                        Triggers: — (awarded_at is the lifecycle stamp; no updated_at).
//   • leaderboard_scores RLS-ON SELECT participants/public per scope; aggregation job writes.
//                        Triggers: — (DB is source of truth; Redis sorted-set is a serving cache).
// =============================================================================
import { bigint, date, index, integer, jsonb, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { pkV7, timestamps } from "./_shared";
import { leaderboardPeriod, leaderboardScope, streakType } from "./enums";
import { users } from "./identity";
import { programs } from "./programs";

// created_at-only audit stamp (no updated_at) for "Triggers: —" tables (cf. billing.ts).
const createdAtOnly = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
};

// user_streaks — one row per (user, streak_type); maintained by the streak-rollover job
// (Part 5), not the app. current_count is the live streak; longest_count the personal best;
// last_activity_date_ist anchors rollover (IST calendar day). tg_touch_updated_at keeps
// updated_at fresh on each recompute.
export const userStreaks = pgTable(
  "user_streaks",
  {
    id: pkV7(),
    userId: uuid("user_id").notNull().references(() => users.id),
    streakType: streakType("streak_type").notNull(),
    currentCount: integer("current_count").notNull().default(0),
    longestCount: integer("longest_count").notNull().default(0),
    lastActivityDateIst: date("last_activity_date_ist"), // nullable: set by rollover job on first activity
    ...timestamps,
  },
  (t) => [
    uniqueIndex("user_streaks_user_type_key").on(t.userId, t.streakType),
  ],
);

// user_badges — an awarded badge. Append-only: awarded_at is the lifecycle timestamp (no
// updated_at, no touch trigger). INSERT happens only via the award RPC under service-role.
// badge_type_id → badge_types(id) is a raw FK (0109); badge_types is the raw-only lookup.
export const userBadges = pgTable(
  "user_badges",
  {
    id: pkV7(),
    userId: uuid("user_id").notNull().references(() => users.id),
    badgeTypeId: uuid("badge_type_id").notNull(), // FK → badge_types(id) added raw 0109 (raw-only lookup, seeded 0003)
    awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata"), // nullable: optional award context (e.g. the qualifying value)
  },
  (t) => [
    uniqueIndex("user_badges_user_badge_key").on(t.userId, t.badgeTypeId),
  ],
);

// leaderboard_scores — DB source-of-truth scores written by the aggregation job (Part 5; a
// Redis sorted-set may serve at scale). program_id is NULL for scope='platform'. The ranking
// index matches the serving access path (scope, program, period, score DESC).
export const leaderboardScores = pgTable(
  "leaderboard_scores",
  {
    id: pkV7(),
    userId: uuid("user_id").notNull().references(() => users.id),
    scope: leaderboardScope("scope").notNull(),
    programId: uuid("program_id").references(() => programs.id), // nullable: NULL when scope='platform'
    period: leaderboardPeriod("period").notNull(),
    score: bigint("score", { mode: "number" }).notNull().default(0),
    rank: integer("rank"), // nullable: assigned by the aggregation job
    periodStartDate: date("period_start_date").notNull(),
    ...createdAtOnly,
  },
  (t) => [
    index("leaderboard_scores_ranking_idx").on(t.scope, t.programId, t.period, t.score.desc()),
  ],
);

// ----- drizzle-zod validators (arch §11) -------------------------------------
export const insertUserStreakSchema = createInsertSchema(userStreaks);
export const selectUserStreakSchema = createSelectSchema(userStreaks);
export const insertUserBadgeSchema = createInsertSchema(userBadges);
export const selectUserBadgeSchema = createSelectSchema(userBadges);
export const insertLeaderboardScoreSchema = createInsertSchema(leaderboardScores);
export const selectLeaderboardScoreSchema = createSelectSchema(leaderboardScores);
