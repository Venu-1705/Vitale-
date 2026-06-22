// =============================================================================
// Vitalé — D3 Programs & Enrollment (Phase 4)
// Ground truth: VITALE_DB_ARCHITECTURE §4 D3 (lines 280-310) + VITALE_IMPLEMENTATION_SPEC
// Part 2 D3 (lines 278-307) + Part 6 Phase 4 order (line 1113: programs → program_versions →
// program_modules → program_sessions → ... → program_enrollments → ... → session_watches).
//
// All six D3 tables are non-partitioned, PK-V7, so Drizzle can express them fully (unlike the
// partitioned D4/D5 logs, which are raw-SQL). This module owns the table DDL + drizzle-zod
// validators only. RLS, grants, and the behavioral triggers live in the raw post-companion:
//   • tg_touch_updated_at (0004) on the [A]/[C] tables
//   • tg_no_edit_while_enrolled (programs — block content UPDATE while ≥1 active enrollment)
//   • tg_bump_program_version (programs — publish snapshot → program_versions)
//   • IMMUT-BLOCK (program_versions — append-only / no UPDATE|DELETE)
//   • tg_rollup_progress (session_watches → program_enrollments.progress_pct)
//   • DEFERRED to Phase 8: tg_enrollment_grant / tg_enrollment_complete_cascade — they
//     INSERT/deactivate rows in access_grants (new-shape D2), which does not exist until the
//     Phase-8 access-core refactor; wiring them now would fail at trigger-exec time.
//
// CROSS-PHASE FK — program_enrollments.payment_id → enrollment_payments (D8, Phase 5):
// modeled here as a plain nullable uuid with NO .references(), because enrollment_payments is
// not built until Phase 5. This is also the Blocker-1 circular-FK break (enrollment_payments.
// enrollment_id → program_enrollments is NOT NULL; the back-reference is nullable, populated in
// step 3 of the enrollment transaction). The FK constraint is added in Phase 5 when the target
// table lands. Column comment is emitted per spec line 300.
// =============================================================================
import { sql } from "drizzle-orm";
import { bigint, boolean, index, integer, jsonb, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { pkV7, timestamps } from "./_shared";
import { assets } from "./assets";
import { enrollmentStatus, programStatus, programVisibility, sessionContentType } from "./enums";
import { users } from "./identity";
import { coachOrganizations } from "./organizations";

// programs — an org-owned course/program. Content is FROZEN while ≥1 active enrollment exists
// (tg_no_edit_while_enrolled, raw companion). [A]
export const programs = pgTable(
  "programs",
  {
    id: pkV7(),
    organizationId: uuid("organization_id").notNull().references(() => coachOrganizations.id),
    createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id),
    title: text("title").notNull(),
    slug: text("slug").notNull(), // unique per org (not global) — see index below
    description: text("description"),
    coverAssetId: uuid("cover_asset_id").references(() => assets.id), // typed FK (D15 assets); nullable
    pricePaise: bigint("price_paise", { mode: "number" }).notNull(), // arch §2: money = bigint paise (0 = free)
    currency: text("currency").notNull().default("INR"), // single-currency platform; arch §4 D3 lists currency
    durationDays: integer("duration_days"), // nullable: open-ended programs
    status: programStatus("status").notNull().default("draft"), // lifecycle entry = draft
    visibility: programVisibility("visibility").notNull().default("private"), // conservative default (not discoverable)
    maxEnrollments: integer("max_enrollments"), // nullable = uncapped
    publishedAt: timestamp("published_at", { withTimezone: true }), // set on first publish
    currentVersion: integer("current_version").notNull().default(1), // → latest program_versions (spec: DEFAULT 1)
    ...timestamps,
  },
  (t) => [
    index("programs_org_status_idx").on(t.organizationId, t.status),
    uniqueIndex("programs_org_slug_key").on(t.organizationId, t.slug),
  ],
);

// program_versions — publish-time snapshot (history/compliance record of what was delivered;
// NOT the live read path). Append-only: created_at only, no updated_at (IMMUT-BLOCK, raw). [B]
export const programVersions = pgTable(
  "program_versions",
  {
    id: pkV7(),
    programId: uuid("program_id").notNull().references(() => programs.id),
    versionNumber: integer("version_number").notNull(),
    snapshot: jsonb("snapshot").notNull(), // program + modules + sessions at publish (spec: NOT NULL)
    createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id),
    changeSummary: text("change_summary"),
    // immutable record → created_at only (no updated_at / no timestamps spread).
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("program_versions_program_version_key").on(t.programId, t.versionNumber)],
);

// program_modules — ordered sections of a program.
export const programModules = pgTable(
  "program_modules",
  {
    id: pkV7(),
    programId: uuid("program_id").notNull().references(() => programs.id),
    title: text("title").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("program_modules_program_sort_idx").on(t.programId, t.sortOrder)],
);

// program_sessions — content units within a module. program_id is denormalized (arch §4 D3) so
// the live read path and the (program_id, module_id, sort_order) index need no module join.
export const programSessions = pgTable(
  "program_sessions",
  {
    id: pkV7(),
    moduleId: uuid("module_id").notNull().references(() => programModules.id),
    programId: uuid("program_id").notNull().references(() => programs.id), // denorm (arch §4 D3)
    title: text("title").notNull(),
    contentType: sessionContentType("content_type").notNull(),
    videoUrl: text("video_url"),
    content: jsonb("content"),
    durationSeconds: integer("duration_seconds"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("program_sessions_program_module_sort_idx").on(t.programId, t.moduleId, t.sortOrder)],
);

// program_enrollments — a customer's enrollment in a program. program_version_id is stamped at
// enrollment for as-delivered history (NOT NULL). [C]
export const programEnrollments = pgTable(
  "program_enrollments",
  {
    id: pkV7(),
    programId: uuid("program_id").notNull().references(() => programs.id),
    programVersionId: uuid("program_version_id").notNull().references(() => programVersions.id), // stamped (NOT NULL)
    organizationId: uuid("organization_id").notNull().references(() => coachOrganizations.id), // denorm
    userId: uuid("user_id").notNull().references(() => users.id),
    status: enrollmentStatus("status").notNull().default("active"), // enum offers no pre-active creation state
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    progressPct: smallint("progress_pct").notNull().default(0), // denorm from session_watches (tg_rollup_progress)
    // nullable: resolves circular FK with enrollment_payments; populated in step 3 of the enrollment transaction (see docs/db/transaction-protocols.md)
    paymentId: uuid("payment_id"), // FK → enrollment_payments DEFERRED to Phase 5 (Blocker 1)
    ...timestamps,
  },
  (t) => [
    // partial-unique: at most one ACTIVE enrollment per (program, user); re-enroll allowed after cancel/expire.
    uniqueIndex("program_enrollments_active_key").on(t.programId, t.userId).where(sql`${t.status} = 'active'`),
    index("program_enrollments_user_status_idx").on(t.userId, t.status),
  ],
);

// session_watches — per-session progress; tg_rollup_progress recomputes enrollment.progress_pct.
export const sessionWatches = pgTable(
  "session_watches",
  {
    id: pkV7(),
    enrollmentId: uuid("enrollment_id").notNull().references(() => programEnrollments.id),
    sessionId: uuid("session_id").notNull().references(() => programSessions.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    watchedSeconds: integer("watched_seconds").notNull().default(0),
    completed: boolean("completed").notNull().default(false), // spec: DEFAULT false
    lastWatchedAt: timestamp("last_watched_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("session_watches_enrollment_session_key").on(t.enrollmentId, t.sessionId)],
);

// ----- drizzle-zod validators (arch §11) -------------------------------------
export const insertProgramSchema = createInsertSchema(programs);
export const selectProgramSchema = createSelectSchema(programs);
export const insertProgramVersionSchema = createInsertSchema(programVersions);
export const selectProgramVersionSchema = createSelectSchema(programVersions);
export const insertProgramModuleSchema = createInsertSchema(programModules);
export const selectProgramModuleSchema = createSelectSchema(programModules);
export const insertProgramSessionSchema = createInsertSchema(programSessions);
export const selectProgramSessionSchema = createSelectSchema(programSessions);
export const insertProgramEnrollmentSchema = createInsertSchema(programEnrollments);
export const selectProgramEnrollmentSchema = createSelectSchema(programEnrollments);
export const insertSessionWatchSchema = createInsertSchema(sessionWatches);
export const selectSessionWatchSchema = createSelectSchema(sessionWatches);
