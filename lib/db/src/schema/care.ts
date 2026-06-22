// =============================================================================
// Vitalé — D9 Collaboration & Care (cross-coach care on a shared customer)
// Ground truth: VITALE_DB_ARCHITECTURE §4 D9 (lines 463-491) + VITALE_IMPLEMENTATION_SPEC
// Part 2 D9 (lines 446-464).
//
// D9 is the cross-organization care layer: one customer, multiple coaching orgs. A care_plan
// anchors the customer's care; care_team_members are the specialists on it, each carrying
// PER-CUSTOMER scoped capabilities — the third ring of the three-layer permission model
// (access_grants ∩ org-member capabilities ∩ care_team capabilities; most restrictive wins,
// arch §4 D9 lines 489-491). The collaboration_* tables govern the cross-org relationship
// (request → agreement → meetings) that authorizes a cross-org specialist.
//
// All six tables are NON-partitioned, PK-V7 → Drizzle owns the full DDL here, including the two
// table CHECK constraints (distinct orgs; revenue_share 0-100) and the partial-unique active-
// membership index. RLS, grants, and triggers live in the raw companion
// 0110_collaboration_care_rls.sql:
//   • care_plans / care_team_members / care_plan_versions are RLS-FORCE (clinical access
//     boundary); the collaboration_* tables are RLS-ON (org-membership scoped).
//   • tg_touch_updated_at on the five mutable tables (care_plan_versions is INSERT-only).
//   • tg_bump_careplan_version (care_plans), tg_agreement_end_cascade (collaboration_agreements
//     → on flip to 'ended', deactivate the linked grant + the collaborating org's care-team rows),
//     tg_validate_care_team_capabilities (care_team_members — Blocker 4: capabilities ⊆ the
//     member's org organization_member_permissions; cross-org adds require a non-null
//     collaboration_agreement_id), IMMUT-BLOCK on care_plan_versions.
//
// care_plans + care_team_members are the runtime backing for the foundation health-read helpers
// on_care_team() / can_read_health() (raw 0005, forward-referenced under check_function_bodies=off);
// they MUST exist as tables before those functions execute.
// =============================================================================
import { sql } from "drizzle-orm";
import { check, date, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { pkV7, timestamps } from "./_shared";
import {
  careMemberStatus, carePlanStatus, careTeamRole, coachCapability,
  collabAgreementStatus, collabMeetingStatus, collabRequestStatus,
} from "./enums";
import { users } from "./identity";
import { coachOrganizations } from "./organizations";

// created_at-only stamp for the [B immutable] snapshot table (no updated_at / touch trigger).
const createdAtOnly = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
};

// collaboration_requests [C] — one org asks another to collaborate on a shared customer.
// SELECT/write = members of either org (raw 0110). CHECK blocks self-requests (same org).
export const collaborationRequests = pgTable(
  "collaboration_requests",
  {
    id: pkV7(),
    fromOrganizationId: uuid("from_organization_id").notNull().references(() => coachOrganizations.id),
    toOrganizationId: uuid("to_organization_id").notNull().references(() => coachOrganizations.id),
    userId: uuid("user_id").notNull().references(() => users.id), // the shared customer
    status: collabRequestStatus("status").notNull().default("pending"),
    message: text("message"), // nullable: optional note to the receiving org
    requestedByUserId: uuid("requested_by").notNull().references(() => users.id),
    respondedAt: timestamp("responded_at", { withTimezone: true }), // nullable: set on accept/decline
    ...timestamps,
  },
  (t) => [
    check("collaboration_requests_distinct_orgs_chk", sql`${t.fromOrganizationId} <> ${t.toOrganizationId}`),
    index("collaboration_requests_to_org_status_idx").on(t.toOrganizationId, t.status),
    index("collaboration_requests_user_idx").on(t.userId),
  ],
);

// collaboration_meetings [C] — a scheduled cross-org meeting (push notification, NOT Realtime).
// SELECT/write = participants' orgs (raw 0110).
export const collaborationMeetings = pgTable(
  "collaboration_meetings",
  {
    id: pkV7(),
    collaborationRequestId: uuid("collaboration_request_id").references(() => collaborationRequests.id), // nullable: standalone meetings allowed
    organizationId: uuid("organization_id").notNull().references(() => coachOrganizations.id),
    userId: uuid("user_id").references(() => users.id), // nullable: not every meeting is customer-specific
    title: text("title").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes"), // nullable
    meetingUrl: text("meeting_url"), // nullable: set when the conferencing link is generated
    status: collabMeetingStatus("status").notNull().default("scheduled"),
    createdByUserId: uuid("created_by").notNull().references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index("collaboration_meetings_org_scheduled_idx").on(t.organizationId, t.scheduledAt),
  ],
);

// collaboration_agreements [C] — governs a multi-coach customer (revenue share + terms).
// SELECT/write = both orgs (raw 0110). tg_agreement_end_cascade deactivates the linked grant +
// the collaborating org's care-team rows when status flips to 'ended'.
export const collaborationAgreements = pgTable(
  "collaboration_agreements",
  {
    id: pkV7(),
    primaryOrganizationId: uuid("primary_organization_id").notNull().references(() => coachOrganizations.id),
    collaboratingOrganizationId: uuid("collaborating_organization_id").notNull().references(() => coachOrganizations.id),
    userId: uuid("user_id").notNull().references(() => users.id), // the shared customer
    terms: jsonb("terms"), // nullable: structured agreement terms
    revenueSharePct: numeric("revenue_share_pct", { precision: 5, scale: 2 }), // nullable; CHECK 0-100 below
    status: collabAgreementStatus("status").notNull().default("active"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"), // nullable: set when status='ended'
    ...timestamps,
  },
  (t) => [
    // NULL revenue passes (CHECK is not violated on NULL); 0-100 enforced when present.
    check("collaboration_agreements_revenue_share_chk", sql`${t.revenueSharePct} >= 0 AND ${t.revenueSharePct} <= 100`),
    index("collaboration_agreements_user_status_idx").on(t.userId, t.status),
    index("collaboration_agreements_primary_org_idx").on(t.primaryOrganizationId),
    index("collaboration_agreements_collaborating_org_idx").on(t.collaboratingOrganizationId),
  ],
);

// care_plans [C] — the plan that anchors a customer's care. RLS-FORCE (clinical boundary):
// SELECT = active care-team members + admins; write = owner / manage_care_plans (raw 0110).
// current_version is bumped by tg_bump_careplan_version as care_plan_versions snapshots land.
export const carePlans = pgTable(
  "care_plans",
  {
    id: pkV7(),
    organizationId: uuid("organization_id").notNull().references(() => coachOrganizations.id), // primary org
    userId: uuid("user_id").notNull().references(() => users.id), // the customer
    title: text("title").notNull(),
    description: text("description"), // nullable
    status: carePlanStatus("status").notNull().default("active"),
    createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id),
    currentVersion: integer("current_version").notNull().default(1),
    startDate: date("start_date"), // nullable: plan may be drafted before a start is set
    endDate: date("end_date"), // nullable: set on completion/archival
    ...timestamps,
  },
  (t) => [
    index("care_plans_user_status_idx").on(t.userId, t.status),
    index("care_plans_org_status_idx").on(t.organizationId, t.status),
  ],
);

// care_team_members [C] — specialists on a care plan, each with PER-CUSTOMER scoped capabilities
// (capabilities ⊆ the member's org organization_member_permissions — Blocker 4, enforced by
// tg_validate_care_team_capabilities in raw 0110). Cross-org specialists require a non-null
// collaboration_agreement_id (also trigger-enforced — it needs a cross-row org comparison).
// RLS-FORCE: care-team + plan owner. added_at is the creation stamp; updated_at exists only for
// tg_touch_updated_at — there is no separate created_at (cf. community_memberships).
export const careTeamMembers = pgTable(
  "care_team_members",
  {
    id: pkV7(),
    carePlanId: uuid("care_plan_id").notNull().references(() => carePlans.id),
    memberUserId: uuid("member_user_id").notNull().references(() => users.id),
    organizationId: uuid("organization_id").notNull().references(() => coachOrganizations.id),
    roleInTeam: careTeamRole("role_in_team").notNull(),
    capabilities: coachCapability("capabilities").array().notNull().default(sql`'{}'`), // ⊆ org caps (Blocker 4)
    status: careMemberStatus("status").notNull().default("active"),
    collaborationAgreementId: uuid("collaboration_agreement_id").references(() => collaborationAgreements.id), // nullable: set for cross-org specialists
    addedByUserId: uuid("added_by").notNull().references(() => users.id),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }), // nullable: set when status='removed'
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(), // tg_touch_updated_at
  },
  (t) => [
    // partial-unique: at most ONE active membership per (plan, member); re-add allowed after removal.
    uniqueIndex("care_team_members_active_key").on(t.carePlanId, t.memberUserId).where(sql`${t.status} = 'active'`),
    index("care_team_members_member_idx").on(t.memberUserId),
  ],
);

// care_plan_versions [B immutable] — append-only snapshot history. INSERT-only (IMMUT-BLOCK,
// raw 0110); same readers as the parent plan. createdAt is the only stamp (no updated_at).
export const carePlanVersions = pgTable(
  "care_plan_versions",
  {
    id: pkV7(),
    carePlanId: uuid("care_plan_id").notNull().references(() => carePlans.id),
    versionNumber: integer("version_number").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    authoredByUserId: uuid("authored_by_user_id").notNull().references(() => users.id),
    changeSummary: text("change_summary"), // nullable
    ...createdAtOnly,
  },
  (t) => [
    uniqueIndex("care_plan_versions_plan_version_key").on(t.carePlanId, t.versionNumber),
  ],
);

// ----- drizzle-zod validators (arch §11) -------------------------------------
export const insertCollaborationRequestSchema = createInsertSchema(collaborationRequests);
export const selectCollaborationRequestSchema = createSelectSchema(collaborationRequests);
export const insertCollaborationMeetingSchema = createInsertSchema(collaborationMeetings);
export const selectCollaborationMeetingSchema = createSelectSchema(collaborationMeetings);
export const insertCollaborationAgreementSchema = createInsertSchema(collaborationAgreements);
export const selectCollaborationAgreementSchema = createSelectSchema(collaborationAgreements);
export const insertCarePlanSchema = createInsertSchema(carePlans);
export const selectCarePlanSchema = createSelectSchema(carePlans);
export const insertCareTeamMemberSchema = createInsertSchema(careTeamMembers);
export const selectCareTeamMemberSchema = createSelectSchema(careTeamMembers);
export const insertCarePlanVersionSchema = createInsertSchema(carePlanVersions);
export const selectCarePlanVersionSchema = createSelectSchema(carePlanVersions);
