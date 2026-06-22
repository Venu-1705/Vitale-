// =============================================================================
// Vitalé — D14 Clinical Coaching (first-class; append-only)
// Ground truth: VITALE_DB_ARCHITECTURE §4 D14 (lines 543-561) + VITALE_IMPLEMENTATION_SPEC
// Part 2 D14 (lines 565-575).
//
// Clinical records are APPEND-ONLY: corrections are addendum rows, never edits, and authorship
// is preserved permanently (author_member_id is immutable; author_role_at_time snapshots the
// role so "written as nutritionist" survives a later promotion). clinical_notes is a single
// self-referencing table — an addendum points at its parent via parent_note_id.
//
// All three tables are NON-partitioned, PK-V7 → Drizzle owns the full DDL here, including the
// addendum CHECK. RLS, grants, and triggers live in the raw companion 0111_clinical_rls.sql:
//   • All three are RLS-FORCE; clinical_notes is additionally REVOKE-API (read only via the
//     audited rpc_read_clinical_note — never a direct client SELECT).
//   • clinical_notes is INSERT-only (IMMUT-BLOCK: UPDATE/DELETE denied to every role — it has
//     no edited_at/deleted_at/updated_at columns at all). interventions/outcomes carry
//     tg_touch_updated_at.
//   • clinical_notes SELECT = the author's org members holding write_clinical_notes + an active
//     access_grant on the subject, plus the subject when visibility='shared_with_user'.
//     interventions/outcomes follow the care-team read path (+ subject when shared).
// =============================================================================
import { sql } from "drizzle-orm";
import { type AnyPgColumn, check, index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { pkV7, timestamps } from "./_shared";
import { carePlans } from "./care";
import { clinicalAuthorRole, clinicalNoteType, interventionStatus, noteVisibility, outcomeStatus } from "./enums";
import { metricDefinitions } from "./health";
import { users } from "./identity";
import { coachOrganizations, organizationMembers } from "./organizations";

// created_at-only stamp for the [B immutable] clinical_notes (no updated_at — corrections are
// addendum rows, so the row is never touched after insert).
const createdAtOnly = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
};

// clinical_notes [B immutable] — the append-only clinical record. author_member_id resolves to
// person + role and is immutable; author_role_at_time is a snapshot. parent_note_id is a nullable
// self-reference set IFF note_type='addendum' (enforced by the CHECK below). No edited_at /
// deleted_at / updated_at — IMMUT-BLOCK (raw 0111) denies UPDATE/DELETE to all roles.
export const clinicalNotes = pgTable(
  "clinical_notes",
  {
    id: pkV7(),
    organizationId: uuid("organization_id").notNull().references(() => coachOrganizations.id),
    authorMemberId: uuid("author_member_id").notNull().references(() => organizationMembers.id), // immutable
    authorRoleAtTime: clinicalAuthorRole("author_role_at_time").notNull(), // snapshot (survives promotion)
    subjectUserId: uuid("subject_user_id").notNull().references(() => users.id),
    carePlanId: uuid("care_plan_id").references(() => carePlans.id), // nullable: a note need not attach to a plan
    noteType: clinicalNoteType("note_type").notNull(),
    parentNoteId: uuid("parent_note_id").references((): AnyPgColumn => clinicalNotes.id), // nullable self-ref: set iff note_type='addendum'
    body: text("body").notNull(),
    visibility: noteVisibility("visibility").notNull().default("internal"),
    ...createdAtOnly,
  },
  (t) => [
    // An addendum has a parent; a non-addendum does not. Both directions enforced.
    check("clinical_notes_addendum_chk", sql`(${t.noteType} = 'addendum') = (${t.parentNoteId} IS NOT NULL)`),
    index("clinical_notes_subject_created_idx").on(t.subjectUserId, t.createdAt.desc()),
    index("clinical_notes_care_plan_idx").on(t.carePlanId),
  ],
);

// interventions — an action on a care plan (RLS-FORCE: care-team + subject when shared, raw 0111).
export const interventions = pgTable(
  "interventions",
  {
    id: pkV7(),
    carePlanId: uuid("care_plan_id").notNull().references(() => carePlans.id),
    subjectUserId: uuid("subject_user_id").notNull().references(() => users.id),
    authorMemberId: uuid("author_member_id").notNull().references(() => organizationMembers.id),
    interventionType: text("intervention_type").notNull(),
    description: text("description"), // nullable
    status: interventionStatus("status").notNull().default("active"),
    startedAt: timestamp("started_at", { withTimezone: true }), // nullable: set when the intervention begins
    endedAt: timestamp("ended_at", { withTimezone: true }), // nullable: set when it completes/cancels
    ...timestamps,
  },
  (t) => [
    index("interventions_care_plan_idx").on(t.carePlanId),
    index("interventions_subject_idx").on(t.subjectUserId),
  ],
);

// outcomes — a tracked result against a metric or free-text label (RLS-FORCE: as interventions).
// metric_definition_id is nullable (label-only outcomes); values are unbounded numeric since the
// unit varies by metric.
export const outcomes = pgTable(
  "outcomes",
  {
    id: pkV7(),
    carePlanId: uuid("care_plan_id").notNull().references(() => carePlans.id),
    subjectUserId: uuid("subject_user_id").notNull().references(() => users.id),
    metricDefinitionId: uuid("metric_definition_id").references(() => metricDefinitions.id), // nullable: label-only outcome
    label: text("label").notNull(),
    baselineValue: numeric("baseline_value"), // nullable
    targetValue: numeric("target_value"), // nullable
    observedValue: numeric("observed_value"), // nullable
    status: outcomeStatus("status").notNull().default("on_track"),
    measuredAt: timestamp("measured_at", { withTimezone: true }), // nullable: set when observed_value is recorded
    ...timestamps,
  },
  (t) => [
    index("outcomes_care_plan_idx").on(t.carePlanId),
    index("outcomes_subject_idx").on(t.subjectUserId),
  ],
);

// ----- drizzle-zod validators (arch §11) -------------------------------------
export const insertClinicalNoteSchema = createInsertSchema(clinicalNotes);
export const selectClinicalNoteSchema = createSelectSchema(clinicalNotes);
export const insertInterventionSchema = createInsertSchema(interventions);
export const selectInterventionSchema = createSelectSchema(interventions);
export const insertOutcomeSchema = createInsertSchema(outcomes);
export const selectOutcomeSchema = createSelectSchema(outcomes);
