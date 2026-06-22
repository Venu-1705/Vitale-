// =============================================================================
// Vitalé — D14 Clinical Coaching HTTP surface
// -----------------------------------------------------------------------------
// Canonical pipeline (authedRoute → withUserContext): validate → user context →
// DB → map errors → respond. Authorization is NOT re-implemented here — it is owned
// by the D14 RLS policies + triggers + grants (migrations post/0111, post/0130):
//
//   • clinical_notes [B immutable, REVOKE-API, RLS-FORCE] — append-only clinical record.
//     INSERT only (authenticated has no SELECT grant); UPDATE/DELETE blocked (IMMUT-BLOCK) —
//     corrections are addendum rows (note_type='addendum' ⇔ parent_note_id set, table CHECK).
//     Reads go EXCLUSIVELY through the audited rpc_read_clinical_note (0130), which re-enforces
//     the SELECT predicate and writes a coach_data_access_audit row in the same transaction.
//     INSERT WITH CHECK: caller is an active org member with write_clinical_notes + an active
//     'clinical' grant on the subject, recording themselves as author (author_member_id).
//   • interventions / outcomes [RLS-FORCE] — user-visible clinical feedback. Read = care-team /
//     owning org / admin-support (can_read_care_plan) OR the subject. Write = active care-team
//     or is_org_member(care_plan_org,'manage_care_plans'). interventions pins author_member_id to
//     the caller's own membership; tg_touch_updated_at maintains updated_at.
// =============================================================================
import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { clinicalNotes, interventions, outcomes, uuidv7 } from "@workspace/db";
import { z } from "zod";
import { authedRoute } from "../lib/route";
import { ApiError } from "../lib/http";

const router: IRouter = Router();

// ----- enum mirrors (exact DB values) ----------------------------------------
const CLINICAL_AUTHOR_ROLE = ["owner_coach", "nutritionist", "collaborating_specialist"] as const;
const CLINICAL_NOTE_TYPE = ["observation", "assessment", "progress_note", "recommendation", "addendum"] as const;
const NOTE_VISIBILITY = ["internal", "shared_with_user"] as const;
const INTERVENTION_STATUS = ["active", "completed", "cancelled"] as const;
const OUTCOME_STATUS = ["on_track", "achieved", "missed", "abandoned"] as const;

const IdParam = z.object({ id: z.string().uuid() });

// =============================================================================
// Clinical notes — append-only; REVOKE-API (write here, read via audited RPC)
// =============================================================================
// note_type='addendum' requires parent_note_id; every other type forbids it. The table CHECK
// enforces the biconditional at the DB — we surface a 422 by validation parity here too, so an
// obviously malformed request fails fast before the round-trip, but the DB remains the authority.
const CreateNoteBody = z
  .object({
    organizationId: z.string().uuid(),
    authorMemberId: z.string().uuid(), // caller's OWN active membership (RLS pins this)
    authorRoleAtTime: z.enum(CLINICAL_AUTHOR_ROLE),
    subjectUserId: z.string().uuid(),
    carePlanId: z.string().uuid().optional(),
    noteType: z.enum(CLINICAL_NOTE_TYPE),
    parentNoteId: z.string().uuid().optional(),
    body: z.string().min(1),
    visibility: z.enum(NOTE_VISIBILITY).optional(),
  })
  .refine((b) => (b.noteType === "addendum") === (b.parentNoteId !== undefined), {
    message: "parent_note_id must be set iff note_type='addendum'.",
    path: ["parentNoteId"],
  });

// POST /clinical-notes — write a note (or an addendum). REVOKE-API: no SELECT grant → cannot use
// RETURNING; insert and echo the app-generated id. RLS WITH CHECK owns authorization.
router.post(
  "/clinical-notes",
  authedRoute({ body: CreateNoteBody }, async ({ db, body }) => {
    const id = uuidv7();
    await db.insert(clinicalNotes).values({
      id,
      organizationId: body.organizationId,
      authorMemberId: body.authorMemberId,
      authorRoleAtTime: body.authorRoleAtTime,
      subjectUserId: body.subjectUserId,
      noteType: body.noteType,
      body: body.body,
      ...(body.carePlanId ? { carePlanId: body.carePlanId } : {}),
      ...(body.parentNoteId ? { parentNoteId: body.parentNoteId } : {}),
      ...(body.visibility ? { visibility: body.visibility } : {}),
    });
    return { id, noteType: body.noteType, subjectUserId: body.subjectUserId };
  }),
);

// GET /clinical-notes — the ONLY read path. Delegates to the SECURITY DEFINER, audited
// rpc_read_clinical_note (0130): it re-enforces the clinical_notes_select predicate, writes a
// coach_data_access_audit row in-transaction (coach reads only; self-reads of shared notes are
// not audited), and returns the matching rows. A raw SELECT would be denied (no SELECT grant).
const ReadNotesQuery = z.object({
  subjectUserId: z.string().uuid(),
  carePlanId: z.string().uuid().optional(),
  noteId: z.string().uuid().optional(),
});
router.get(
  "/clinical-notes",
  authedRoute({ query: ReadNotesQuery }, async ({ db, query }) => {
    const result = await db.execute(
      sql`select * from public.rpc_read_clinical_note(
        ${query.subjectUserId}::uuid,
        ${query.carePlanId ?? null}::uuid,
        ${query.noteId ?? null}::uuid)`,
    );
    return { count: result.rows.length, notes: result.rows };
  }),
);

// =============================================================================
// Interventions — an action on a care plan (care-team writers; subject is read-only)
// =============================================================================
const CreateInterventionBody = z.object({
  carePlanId: z.string().uuid(),
  subjectUserId: z.string().uuid(),
  authorMemberId: z.string().uuid(), // caller's OWN active membership (RLS pins this)
  interventionType: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(INTERVENTION_STATUS).optional(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
});
const UpdateInterventionBody = z.object({
  status: z.enum(INTERVENTION_STATUS).optional(),
  description: z.string().optional(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
});

// POST /interventions — care-team / manage_care_plans member records an intervention. Its
// SELECT policy reads the PARENT care_plan (not interventions) → RETURNING is safe.
router.post(
  "/interventions",
  authedRoute({ body: CreateInterventionBody }, async ({ db, body }) => {
    const rows = await db
      .insert(interventions)
      .values({
        id: uuidv7(),
        carePlanId: body.carePlanId,
        subjectUserId: body.subjectUserId,
        authorMemberId: body.authorMemberId,
        interventionType: body.interventionType,
        ...(body.description ? { description: body.description } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.startedAt ? { startedAt: new Date(body.startedAt) } : {}),
        ...(body.endedAt ? { endedAt: new Date(body.endedAt) } : {}),
      })
      .returning();
    return rows[0];
  }),
);

// GET /interventions?carePlanId= — RLS scopes visibility (care-team/org/subject). Optional filter.
const ListByPlanQuery = z.object({ carePlanId: z.string().uuid().optional() });
router.get(
  "/interventions",
  authedRoute({ query: ListByPlanQuery }, async ({ db, query }) => {
    const rows = query.carePlanId
      ? await db.select().from(interventions).where(eq(interventions.carePlanId, query.carePlanId))
      : await db.select().from(interventions);
    return { count: rows.length, interventions: rows };
  }),
);

// PATCH /interventions/:id — care-team / manage_care_plans writer updates lifecycle. RLS
// interventions_update gates USING + WITH CHECK; 404 when the row is invisible/unwritable.
router.patch(
  "/interventions/:id",
  authedRoute({ params: IdParam, body: UpdateInterventionBody }, async ({ db, params, body }) => {
    const rows = await db
      .update(interventions)
      .set({
        ...(body.status ? { status: body.status } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.startedAt ? { startedAt: new Date(body.startedAt) } : {}),
        ...(body.endedAt ? { endedAt: new Date(body.endedAt) } : {}),
      })
      .where(eq(interventions.id, params.id))
      .returning();
    if (rows.length === 0) {
      throw new ApiError(404, "not_found", "Intervention not found or not editable.");
    }
    return rows[0];
  }),
);

// =============================================================================
// Outcomes — a tracked result against a metric or free-text label
// =============================================================================
const CreateOutcomeBody = z.object({
  carePlanId: z.string().uuid(),
  subjectUserId: z.string().uuid(),
  metricDefinitionId: z.string().uuid().optional(),
  label: z.string().min(1),
  baselineValue: z.number().optional(),
  targetValue: z.number().optional(),
  observedValue: z.number().optional(),
  status: z.enum(OUTCOME_STATUS).optional(),
  measuredAt: z.string().datetime().optional(),
});
const UpdateOutcomeBody = z.object({
  observedValue: z.number().optional(),
  targetValue: z.number().optional(),
  status: z.enum(OUTCOME_STATUS).optional(),
  measuredAt: z.string().datetime().optional(),
});

// POST /outcomes — care-team / manage_care_plans member records a tracked outcome. numeric
// columns take strings in drizzle → String() the bounded values. SELECT policy reads the parent
// plan → RETURNING is safe.
router.post(
  "/outcomes",
  authedRoute({ body: CreateOutcomeBody }, async ({ db, body }) => {
    const rows = await db
      .insert(outcomes)
      .values({
        id: uuidv7(),
        carePlanId: body.carePlanId,
        subjectUserId: body.subjectUserId,
        label: body.label,
        ...(body.metricDefinitionId ? { metricDefinitionId: body.metricDefinitionId } : {}),
        ...(body.baselineValue !== undefined ? { baselineValue: String(body.baselineValue) } : {}),
        ...(body.targetValue !== undefined ? { targetValue: String(body.targetValue) } : {}),
        ...(body.observedValue !== undefined ? { observedValue: String(body.observedValue) } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.measuredAt ? { measuredAt: new Date(body.measuredAt) } : {}),
      })
      .returning();
    return rows[0];
  }),
);

// GET /outcomes?carePlanId= — RLS-scoped (care-team/org/subject).
router.get(
  "/outcomes",
  authedRoute({ query: ListByPlanQuery }, async ({ db, query }) => {
    const rows = query.carePlanId
      ? await db.select().from(outcomes).where(eq(outcomes.carePlanId, query.carePlanId))
      : await db.select().from(outcomes);
    return { count: rows.length, outcomes: rows };
  }),
);

// PATCH /outcomes/:id — record an observed value / advance status.
router.patch(
  "/outcomes/:id",
  authedRoute({ params: IdParam, body: UpdateOutcomeBody }, async ({ db, params, body }) => {
    const rows = await db
      .update(outcomes)
      .set({
        ...(body.observedValue !== undefined ? { observedValue: String(body.observedValue) } : {}),
        ...(body.targetValue !== undefined ? { targetValue: String(body.targetValue) } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.measuredAt ? { measuredAt: new Date(body.measuredAt) } : {}),
      })
      .where(eq(outcomes.id, params.id))
      .returning();
    if (rows.length === 0) {
      throw new ApiError(404, "not_found", "Outcome not found or not editable.");
    }
    return rows[0];
  }),
);

export default router;
