// =============================================================================
// Vitalé — D2 Access Control & DPDP
// Ground truth: VITALE_DB_ARCHITECTURE §4 D2 (lines 242-278) + VITALE_IMPLEMENTATION_SPEC
// Part 2 D2 (lines 234-272).
//
// Tables:
//   • access_grants            [C]            — org-scoped, source-bound data access grant.
//                                               RLS-FORCE; subject creates/revokes own grants.
//                                               RLS + triggers in post companion 0114.
//   • data_deletion_requests   [B]            — DPDP right-to-erasure workflow.
//   • admin_support_access     [B]            — the ONLY path for admin → customer health data
//                                               (hybrid self|dual|break_glass + post-review).
//   • dpdp_consent_records     [B immutable]  — append-only consent ledger (IMMUT-BLOCK).
//
// RLS, grants, and triggers for data_deletion_requests / admin_support_access / dpdp_consent_records
// live in the raw companion 0112_access_dpdp_rls.sql.
//
// coach_data_access_audit [B immutable, PARTITIONED] — raw-companion only (composite PK, monthly
// RANGE partitions on accessed_at). Created in 0113_coach_audit_table.sql.
//
// All PK-V7, NON-partitioned → Drizzle owns the full DDL here, including table CHECK constraints.
// =============================================================================
import { sql } from "drizzle-orm";
import { boolean, check, date, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { pkV7, timestamps } from "./_shared";
import {
  accessLevel, accessSourceType,
  consentType, deletionStatus,
  grantDataCategory, grantStatus, grantType,
  supportApprovalMode, supportReasonCode, supportStatus,
} from "./enums";
import { users } from "./identity";
import { coachOrganizations } from "./organizations";

// created_at-only stamp for the [B immutable] consent ledger (no updated_at — IMMUT-BLOCK means a
// row is never touched after insert; a revocation is a NEW ledger row, not an UPDATE).
const createdAtOnly = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
};

// data_deletion_requests [B] — DPDP right-to-erasure workflow. RLS-FORCE: SELECT = subject + admins;
// INSERT = subject; the requested→processing→completed|rejected transitions run via a service-role
// RPC (the status-machine guard + tg_touch_updated_at live in raw 0112). requested_at is the domain
// request time the arch names explicitly; it coincides with created_at at insert but is kept distinct.
export const dataDeletionRequests = pgTable(
  "data_deletion_requests",
  {
    id: pkV7(),
    userId: uuid("user_id").notNull().references(() => users.id), // the data subject
    status: deletionStatus("status").notNull().default("requested"),
    reason: text("reason"), // nullable: optional reason for the erasure request
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }), // nullable: set when processing completes/rejects
    processedBy: uuid("processed_by").references(() => users.id), // nullable: operator who processed the request
    anonymizationCompletedAt: timestamp("anonymization_completed_at", { withTimezone: true }), // nullable: set when anonymization finishes
    ...timestamps,
  },
  (t) => [
    index("data_deletion_requests_status_idx").on(t.status),
    index("data_deletion_requests_user_idx").on(t.userId),
  ],
);

// admin_support_access [B] — the hybrid-model admin access case. RLS-FORCE + REVOKE-API: SELECT/INSERT
// = admins only; every PHI read under a LIVE case emits a coach_data_access_audit row acting_as='admin'.
// expires_at is mandatory (time-boxed). Blocker 6: review_deadline is a machine-readable post-review SLA
// stamp set at insert for self/break_glass (tg_set_review_deadline) and queried directly by the
// admin_access_sla job. Config flag require_second_approver flips self→dual with no schema change.
export const adminSupportAccess = pgTable(
  "admin_support_access",
  {
    id: pkV7(),
    subjectUserId: uuid("subject_user_id").notNull().references(() => users.id), // the data subject
    requestedByAdminId: uuid("requested_by_admin_id").notNull().references(() => users.id),
    approvedByAdminId: uuid("approved_by_admin_id").references(() => users.id), // nullable: set on dual-mode approval
    approvalMode: supportApprovalMode("approval_mode").notNull(), // self | dual | break_glass (no default — explicit discriminator)
    reasonCode: supportReasonCode("reason_code").notNull(),
    justification: text("justification").notNull(), // mandatory accountability text
    ticketRef: text("ticket_ref"), // nullable: support/compliance ticket reference
    scopeCategories: grantDataCategory("scope_categories").array().notNull().default(sql`'{}'`),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    grantedAt: timestamp("granted_at", { withTimezone: true }), // nullable: set when access is granted/activated
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), // time-boxed (spec: NOT NULL)
    revokedAt: timestamp("revoked_at", { withTimezone: true }), // nullable: set on early revocation
    status: supportStatus("status").notNull().default("requested"),
    postReviewBy: uuid("post_review_by").references(() => users.id), // nullable: reviewer of a self/break_glass case
    postReviewAt: timestamp("post_review_at", { withTimezone: true }), // nullable
    postReviewNote: text("post_review_note"), // nullable
    // review_deadline: computed from granted_at + policy review window at insert time; drives the
    // admin_access_sla overdue query (Blocker 6). NULL for dual rows (they need no post-review).
    reviewDeadline: timestamp("review_deadline", { withTimezone: true }), // nullable
    ...timestamps,
  },
  (t) => [
    index("admin_support_access_subject_status_idx").on(t.subjectUserId, t.status),
    index("admin_support_access_status_expires_idx").on(t.status, t.expiresAt),
    // Blocker 6 — SLA overdue scan: open post-reviews ordered by deadline.
    index("admin_support_access_review_deadline_idx").on(t.reviewDeadline).where(sql`${t.postReviewAt} IS NULL`),
    // dual ⇒ a distinct second approver (also enforced by tg_enforce_support_approval for a clear error).
    check(
      "admin_support_access_dual_approver_chk",
      sql`${t.approvalMode} <> 'dual' OR (${t.approvedByAdminId} IS NOT NULL AND ${t.approvedByAdminId} <> ${t.requestedByAdminId})`,
    ),
    // self/break_glass ⇒ a machine-readable review deadline must be present (dual may leave it NULL).
    check(
      "admin_support_access_review_deadline_chk",
      sql`${t.approvalMode} NOT IN ('self', 'break_glass') OR ${t.reviewDeadline} IS NOT NULL`,
    ),
  ],
);

// dpdp_consent_records [B immutable] — append-only consent ledger. RLS-FORCE + REVOKE-API: SELECT =
// subject + admins; INSERT-only (IMMUT-BLOCK in raw 0112 — UPDATE/DELETE denied to all roles, so a
// revocation is recorded as a NEW row, never an edit). granted + consent_text_snapshot are NOT NULL
// (the full text consented to is captured permanently). ip_address is stored as text (codebase
// convention — no inet usage elsewhere).
export const dpdpConsentRecords = pgTable(
  "dpdp_consent_records",
  {
    id: pkV7(),
    userId: uuid("user_id").notNull().references(() => users.id), // the data subject
    consentType: consentType("consent_type").notNull(),
    consentVersion: text("consent_version").notNull(), // version label of the policy/text consented to
    consentTextSnapshot: text("consent_text_snapshot").notNull(), // full text at time of consent
    granted: boolean("granted").notNull(), // true = grant event, false = revoke event
    grantedAt: timestamp("granted_at", { withTimezone: true }), // nullable: set on a grant event
    revokedAt: timestamp("revoked_at", { withTimezone: true }), // nullable: set on a revoke event
    ipAddress: text("ip_address"), // nullable: capture-time context
    userAgent: text("user_agent"), // nullable: capture-time context
    ...createdAtOnly,
  },
  (t) => [
    index("dpdp_consent_records_user_type_created_idx").on(t.userId, t.consentType, t.createdAt.desc()),
  ],
);

// access_grants [C] — org-scoped, source-bound access grant. The grantee is the ORGANIZATION
// (not an individual coach), scoped to its staff by capability. Each grant is bound to the
// record that justifies it (source_type + source_id). RLS-FORCE: subject creates/revokes their
// own grants; grantee-org members with view_client_health can see them. Org cannot self-grant
// (INSERT requires user_id = auth.uid() per policy). Liveness predicate in helpers:
// status='active' AND (end_date IS NULL OR end_date > now()).
// RLS + triggers in post companion 0114 (tg_require_consent_on_activate, tg_validate_grant_source,
// tg_touch_updated_at). coach_data_access_audit (partitioned sibling) is raw-only → see 0113.
export const accessGrants = pgTable(
  "access_grants",
  {
    id: pkV7(),
    organizationId: uuid("organization_id").notNull().references(() => coachOrganizations.id), // grantee
    userId: uuid("user_id").notNull().references(() => users.id), // data subject
    sourceType: accessSourceType("source_type").notNull(),
    sourceId: uuid("source_id").notNull(), // polymorphic ref; integrity via tg_validate_grant_source
    dataCategoriesGranted: grantDataCategory("data_categories_granted").array().notNull().default(sql`'{}'`),
    grantType: grantType("grant_type").notNull(),
    accessLevel: accessLevel("access_level").notNull(),
    status: grantStatus("status").notNull().default("active"),
    startDate: date("start_date").notNull().default(sql`CURRENT_DATE`),
    endDate: date("end_date"), // nullable: NULL means no expiry
    revokedAt: timestamp("revoked_at", { withTimezone: true }), // nullable
    revokedBy: uuid("revoked_by").references(() => users.id), // nullable
    ...timestamps,
  },
  (t) => [
    // One live grant per source (prevents duplicate active grants for the same source record).
    uniqueIndex("access_grants_active_key").on(t.organizationId, t.userId, t.sourceType, t.sourceId).where(sql`${t.status} = 'active'`),
    index("access_grants_user_status_idx").on(t.userId, t.status),
    index("access_grants_org_status_idx").on(t.organizationId, t.status),
    index("access_grants_source_idx").on(t.sourceType, t.sourceId),
  ],
);

// ----- drizzle-zod validators (arch §11) -------------------------------------
export const insertAccessGrantSchema = createInsertSchema(accessGrants);
export const selectAccessGrantSchema = createSelectSchema(accessGrants);
export const insertDataDeletionRequestSchema = createInsertSchema(dataDeletionRequests);
export const selectDataDeletionRequestSchema = createSelectSchema(dataDeletionRequests);
export const insertAdminSupportAccessSchema = createInsertSchema(adminSupportAccess);
export const selectAdminSupportAccessSchema = createSelectSchema(adminSupportAccess);
export const insertDpdpConsentRecordSchema = createInsertSchema(dpdpConsentRecords);
export const selectDpdpConsentRecordSchema = createSelectSchema(dpdpConsentRecords);
