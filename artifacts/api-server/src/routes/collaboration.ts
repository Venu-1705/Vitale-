// =============================================================================
// Vitalé — D9 Collaboration & Care HTTP surface
// -----------------------------------------------------------------------------
// Canonical pipeline (authedRoute → withUserContext): validate → user context →
// DB → map errors → respond. Authorization is NOT re-implemented here — it is owned
// by the D9 RLS policies + triggers + grants (migration post/0110):
//
//   • collaboration_requests/meetings/agreements [C, RLS-ON] — org-membership scoped:
//     members of either party org read/write. requested_by/created_by pinned to auth.uid()
//     by the INSERT WITH CHECK. Ending an agreement (status→'ended') fires
//     tg_agreement_end_cascade (deactivates the collaborating org's care-team rows +
//     revokes its active grant on the shared customer).
//   • care_plans/care_team_members [C, RLS-FORCE] — the clinical access boundary. Writes
//     require is_org_member(org,'manage_care_plans'); reads = active care-team + owning org
//     + admin-with-support (can_read_care_plan). care_team_members carry per-customer
//     capabilities ⊆ the member's org permissions (tg_validate_care_team_capabilities), and
//     cross-org specialists must name a collaboration_agreement_id (tg_require_cross_org_agreement).
//   • care_plan_versions [B immutable, RLS-FORCE] — append-only snapshot ledger. INSERT-only;
//     tg_bump_careplan_version advances care_plans.current_version; UPDATE/DELETE blocked
//     (IMMUT-BLOCK). Same readers as the parent plan.
// =============================================================================
import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import {
  collaborationRequests,
  collaborationMeetings,
  collaborationAgreements,
  carePlans,
  careTeamMembers,
  carePlanVersions,
  uuidv7,
} from "@workspace/db";
import { z } from "zod";
import { authedRoute } from "../lib/route";
import { ApiError } from "../lib/http";

const router: IRouter = Router();

// ----- enum mirrors (exact DB values) ----------------------------------------
const COLLAB_REQUEST_STATUS = ["pending", "accepted", "declined", "cancelled"] as const;
const COLLAB_MEETING_STATUS = ["scheduled", "completed", "cancelled"] as const;
const COLLAB_AGREEMENT_STATUS = ["active", "ended"] as const;
const CARE_PLAN_STATUS = ["active", "completed", "archived"] as const;
const CARE_TEAM_ROLE = ["lead", "nutritionist", "community_manager", "collaborating_specialist"] as const;
const CARE_MEMBER_STATUS = ["active", "removed"] as const;
const COACH_CAPABILITY = [
  "view_client_health", "manage_programs", "manage_diet_charts", "message_clients",
  "moderate_community", "manage_staff", "view_revenue", "manage_lab_recommendations",
  "manage_products", "write_clinical_notes", "manage_care_plans",
] as const;

const IdParam = z.object({ id: z.string().uuid() });

// =============================================================================
// Collaboration requests — one org asks another to collaborate on a shared customer
// =============================================================================
const CreateRequestBody = z.object({
  fromOrganizationId: z.string().uuid(),
  toOrganizationId: z.string().uuid(),
  userId: z.string().uuid(), // the shared customer
  message: z.string().optional(),
});
const UpdateRequestBody = z.object({
  status: z.enum(["accepted", "declined", "cancelled"]),
});

// POST /collaboration-requests — a from-org member initiates. RLS WITH CHECK pins
// requested_by = auth.uid() AND requires active membership of the from-org (CHECK also
// blocks self-requests: from_org <> to_org → 422 check_violation).
router.post(
  "/collaboration-requests",
  authedRoute({ body: CreateRequestBody }, async ({ db, body, userId }) => {
    const rows = await db
      .insert(collaborationRequests)
      .values({
        id: uuidv7(),
        fromOrganizationId: body.fromOrganizationId,
        toOrganizationId: body.toOrganizationId,
        userId: body.userId,
        requestedByUserId: userId,
        ...(body.message ? { message: body.message } : {}),
      })
      .returning();
    return rows[0];
  }),
);

// GET /collaboration-requests — RLS scopes to requests naming an org the caller belongs to.
router.get(
  "/collaboration-requests",
  authedRoute({}, async ({ db }) => {
    const rows = await db.select().from(collaborationRequests);
    return { count: rows.length, requests: rows };
  }),
);

// PATCH /collaboration-requests/:id — either org accepts/declines/cancels; stamp responded_at.
router.patch(
  "/collaboration-requests/:id",
  authedRoute({ params: IdParam, body: UpdateRequestBody }, async ({ db, params, body }) => {
    const rows = await db
      .update(collaborationRequests)
      .set({ status: body.status, respondedAt: new Date(), updatedAt: new Date() })
      .where(eq(collaborationRequests.id, params.id))
      .returning();
    if (rows.length === 0) {
      throw new ApiError(404, "not_found", "Collaboration request not found.");
    }
    return rows[0];
  }),
);

// =============================================================================
// Collaboration meetings — scheduled cross-org meetings (push, not Realtime)
// =============================================================================
const CreateMeetingBody = z.object({
  organizationId: z.string().uuid(),
  collaborationRequestId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  title: z.string().min(1),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().positive().optional(),
  meetingUrl: z.string().optional(),
});
const UpdateMeetingBody = z.object({
  status: z.enum(COLLAB_MEETING_STATUS).optional(),
  scheduledAt: z.string().datetime().optional(),
  meetingUrl: z.string().optional(),
});

// POST /collaboration-meetings — created by a hosting-org member (or either org of the
// linked request). RLS WITH CHECK pins created_by = auth.uid().
router.post(
  "/collaboration-meetings",
  authedRoute({ body: CreateMeetingBody }, async ({ db, body, userId }) => {
    const rows = await db
      .insert(collaborationMeetings)
      .values({
        id: uuidv7(),
        organizationId: body.organizationId,
        title: body.title,
        scheduledAt: new Date(body.scheduledAt),
        createdByUserId: userId,
        ...(body.collaborationRequestId ? { collaborationRequestId: body.collaborationRequestId } : {}),
        ...(body.userId ? { userId: body.userId } : {}),
        ...(body.durationMinutes ? { durationMinutes: body.durationMinutes } : {}),
        ...(body.meetingUrl ? { meetingUrl: body.meetingUrl } : {}),
      })
      .returning();
    return rows[0];
  }),
);

router.get(
  "/collaboration-meetings",
  authedRoute({}, async ({ db }) => {
    const rows = await db.select().from(collaborationMeetings);
    return { count: rows.length, meetings: rows };
  }),
);

router.patch(
  "/collaboration-meetings/:id",
  authedRoute({ params: IdParam, body: UpdateMeetingBody }, async ({ db, params, body }) => {
    const rows = await db
      .update(collaborationMeetings)
      .set({
        ...(body.status ? { status: body.status } : {}),
        ...(body.scheduledAt ? { scheduledAt: new Date(body.scheduledAt) } : {}),
        ...(body.meetingUrl ? { meetingUrl: body.meetingUrl } : {}),
        updatedAt: new Date(),
      })
      .where(eq(collaborationMeetings.id, params.id))
      .returning();
    if (rows.length === 0) {
      throw new ApiError(404, "not_found", "Collaboration meeting not found.");
    }
    return rows[0];
  }),
);

// =============================================================================
// Collaboration agreements — govern a multi-coach customer (revenue share + terms)
// =============================================================================
const CreateAgreementBody = z.object({
  primaryOrganizationId: z.string().uuid(),
  collaboratingOrganizationId: z.string().uuid(),
  userId: z.string().uuid(),
  terms: z.record(z.unknown()).optional(),
  revenueSharePct: z.number().min(0).max(100).optional(),
  startDate: z.string().date(),
  endDate: z.string().date().optional(),
});
const UpdateAgreementBody = z.object({
  status: z.enum(COLLAB_AGREEMENT_STATUS).optional(),
  endDate: z.string().date().optional(),
});

// POST /collaboration-agreements — the primary org creates (RLS WITH CHECK). Distinct-orgs
// + revenue 0-100 are table CHECKs → 422 on violation.
router.post(
  "/collaboration-agreements",
  authedRoute({ body: CreateAgreementBody }, async ({ db, body }) => {
    const rows = await db
      .insert(collaborationAgreements)
      .values({
        id: uuidv7(),
        primaryOrganizationId: body.primaryOrganizationId,
        collaboratingOrganizationId: body.collaboratingOrganizationId,
        userId: body.userId,
        startDate: body.startDate,
        ...(body.terms ? { terms: body.terms } : {}),
        ...(body.revenueSharePct !== undefined ? { revenueSharePct: String(body.revenueSharePct) } : {}),
        ...(body.endDate ? { endDate: body.endDate } : {}),
      })
      .returning();
    return rows[0];
  }),
);

router.get(
  "/collaboration-agreements",
  authedRoute({}, async ({ db }) => {
    const rows = await db.select().from(collaborationAgreements);
    return { count: rows.length, agreements: rows };
  }),
);

// PATCH /collaboration-agreements/:id — either org updates. status→'ended' fires
// tg_agreement_end_cascade (removes the collaborating org's care-team rows + revokes its grant).
router.patch(
  "/collaboration-agreements/:id",
  authedRoute({ params: IdParam, body: UpdateAgreementBody }, async ({ db, params, body }) => {
    const rows = await db
      .update(collaborationAgreements)
      .set({
        ...(body.status ? { status: body.status } : {}),
        ...(body.endDate ? { endDate: body.endDate } : {}),
        updatedAt: new Date(),
      })
      .where(eq(collaborationAgreements.id, params.id))
      .returning();
    if (rows.length === 0) {
      throw new ApiError(404, "not_found", "Collaboration agreement not found.");
    }
    return rows[0];
  }),
);

// =============================================================================
// Care plans — the clinical anchor (RLS-FORCE). Write = manage_care_plans.
// =============================================================================
const CreateCarePlanBody = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
});
const UpdateCarePlanBody = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(CARE_PLAN_STATUS).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
});

// POST /care-plans — manage_care_plans holder creates. RLS WITH CHECK pins
// created_by_user_id = auth.uid() AND is_org_member(org,'manage_care_plans').
//
// NO .returning() here: the care_plans SELECT policy is can_read_care_plan(id), which
// re-queries care_plans for the row's OWN id. During INSERT...RETURNING the new row is
// not yet visible to that self-referential sub-query (MVCC command visibility), so the
// RETURNING SELECT-policy check fails → spurious "new row violates RLS" (42501). Insert,
// then read the row back in a SECOND statement (same txn) where it is visible — the
// creator holds manage_care_plans so can_read_care_plan(id) passes. (care_team_members /
// care_plan_versions are unaffected: their SELECT policies read the parent plan, which
// already exists, so .returning() is safe there.)
router.post(
  "/care-plans",
  authedRoute({ body: CreateCarePlanBody }, async ({ db, body, userId }) => {
    const id = uuidv7();
    await db.insert(carePlans).values({
      id,
      organizationId: body.organizationId,
      userId: body.userId,
      title: body.title,
      createdByUserId: userId,
      ...(body.description ? { description: body.description } : {}),
      ...(body.startDate ? { startDate: body.startDate } : {}),
      ...(body.endDate ? { endDate: body.endDate } : {}),
    });
    const rows = await db.select().from(carePlans).where(eq(carePlans.id, id));
    return rows[0];
  }),
);

// GET /care-plans — RLS scopes to plans the caller can read (active care-team + owning org + admin).
router.get(
  "/care-plans",
  authedRoute({}, async ({ db }) => {
    const rows = await db.select().from(carePlans);
    return { count: rows.length, carePlans: rows };
  }),
);

router.get(
  "/care-plans/:id",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const rows = await db.select().from(carePlans).where(eq(carePlans.id, params.id));
    if (rows.length === 0) {
      throw new ApiError(404, "not_found", "Care plan not found.");
    }
    return rows[0];
  }),
);

router.patch(
  "/care-plans/:id",
  authedRoute({ params: IdParam, body: UpdateCarePlanBody }, async ({ db, params, body }) => {
    const rows = await db
      .update(carePlans)
      .set({
        ...(body.title ? { title: body.title } : {}),
        ...(body.description ? { description: body.description } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.startDate ? { startDate: body.startDate } : {}),
        ...(body.endDate ? { endDate: body.endDate } : {}),
        updatedAt: new Date(),
      })
      .where(eq(carePlans.id, params.id))
      .returning();
    if (rows.length === 0) {
      throw new ApiError(404, "not_found", "Care plan not found or not writable.");
    }
    return rows[0];
  }),
);

// =============================================================================
// Care team members — per-customer specialists (RLS-FORCE + capability triggers)
// =============================================================================
const AddTeamMemberBody = z.object({
  memberUserId: z.string().uuid(),
  organizationId: z.string().uuid(),
  roleInTeam: z.enum(CARE_TEAM_ROLE),
  capabilities: z.array(z.enum(COACH_CAPABILITY)).default([]),
  collaborationAgreementId: z.string().uuid().optional(), // required for cross-org (trigger-enforced)
});
const UpdateTeamMemberBody = z.object({
  status: z.enum(CARE_MEMBER_STATUS).optional(),
  capabilities: z.array(z.enum(COACH_CAPABILITY)).optional(),
});

// POST /care-plans/:id/team — manage_care_plans holder of the plan-owning org adds a specialist.
// tg_validate_care_team_capabilities (caps ⊆ member's org perms) + tg_require_cross_org_agreement
// fire as BEFORE-INSERT guards → 422 (restrict_violation) on breach.
router.post(
  "/care-plans/:id/team",
  authedRoute({ params: IdParam, body: AddTeamMemberBody }, async ({ db, params, body, userId }) => {
    const rows = await db
      .insert(careTeamMembers)
      .values({
        id: uuidv7(),
        carePlanId: params.id,
        memberUserId: body.memberUserId,
        organizationId: body.organizationId,
        roleInTeam: body.roleInTeam,
        capabilities: body.capabilities,
        addedByUserId: userId,
        ...(body.collaborationAgreementId ? { collaborationAgreementId: body.collaborationAgreementId } : {}),
      })
      .returning();
    return rows[0];
  }),
);

// GET /care-plans/:id/team — readers = plan readers (+ the member sees their own row).
router.get(
  "/care-plans/:id/team",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const rows = await db
      .select()
      .from(careTeamMembers)
      .where(eq(careTeamMembers.carePlanId, params.id))
      .orderBy(asc(careTeamMembers.addedAt));
    return { count: rows.length, members: rows };
  }),
);

// PATCH /care-team-members/:id — plan-owning manage_care_plans holder updates a member
// (status→removed stamps removed_at; capability changes re-fire the subset guard).
router.patch(
  "/care-team-members/:id",
  authedRoute({ params: IdParam, body: UpdateTeamMemberBody }, async ({ db, params, body }) => {
    const rows = await db
      .update(careTeamMembers)
      .set({
        ...(body.status ? { status: body.status } : {}),
        ...(body.status === "removed" ? { removedAt: new Date() } : {}),
        ...(body.capabilities ? { capabilities: body.capabilities } : {}),
        updatedAt: new Date(),
      })
      .where(eq(careTeamMembers.id, params.id))
      .returning();
    if (rows.length === 0) {
      throw new ApiError(404, "not_found", "Care team member not found or not writable.");
    }
    return rows[0];
  }),
);

// =============================================================================
// Care plan versions — append-only snapshot ledger (RLS-FORCE, IMMUT-BLOCK)
// =============================================================================
const CreateVersionBody = z.object({
  snapshot: z.record(z.unknown()),
  changeSummary: z.string().optional(),
  versionNumber: z.number().int().positive().optional(), // derived from current_version+1 if absent
});

// POST /care-plans/:id/versions — manage_care_plans holder appends a snapshot. version_number
// derives from the plan's current_version+1 when omitted; the unique (plan, version) index → 409
// on a clash. tg_bump_careplan_version advances care_plans.current_version.
router.post(
  "/care-plans/:id/versions",
  authedRoute({ params: IdParam, body: CreateVersionBody }, async ({ db, params, body, userId }) => {
    let versionNumber = body.versionNumber;
    if (versionNumber === undefined) {
      // The author holds manage_care_plans → can read the plan; derive the next version.
      const plan = await db
        .select({ current: carePlans.currentVersion })
        .from(carePlans)
        .where(eq(carePlans.id, params.id));
      if (plan.length === 0) {
        throw new ApiError(404, "not_found", "Care plan not found.");
      }
      versionNumber = (plan[0]?.current ?? 0) + 1;
    }
    const rows = await db
      .insert(carePlanVersions)
      .values({
        id: uuidv7(),
        carePlanId: params.id,
        versionNumber,
        snapshot: body.snapshot,
        authoredByUserId: userId,
        ...(body.changeSummary ? { changeSummary: body.changeSummary } : {}),
      })
      .returning();
    return rows[0];
  }),
);

// GET /care-plans/:id/versions — same readers as the parent plan.
router.get(
  "/care-plans/:id/versions",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const rows = await db
      .select()
      .from(carePlanVersions)
      .where(eq(carePlanVersions.carePlanId, params.id))
      .orderBy(asc(carePlanVersions.versionNumber));
    return { count: rows.length, versions: rows };
  }),
);

export default router;
