// =============================================================================
// Vitalé — D2 Access Control, Consent & DPDP HTTP surface
// -----------------------------------------------------------------------------
// Canonical pipeline (authedRoute → withUserContext): validate → user context →
// DB → map errors → respond. Authorization is NOT re-implemented here — it is owned
// by the D2 RLS policies + triggers + grants (migrations post/0112 + post/0114):
//
//   • dpdp_consent_records  [B immutable] — REVOKE-API: INSERT-only by the subject
//     (WITH CHECK user_id = auth.uid()); UPDATE/DELETE denied (IMMUT-BLOCK). A
//     revocation is a NEW ledger row, never an edit. No client SELECT grant.
//   • access_grants         [C] — subject creates/revokes own grants; grantee-org
//     members with view_client_health may read. tg_require_consent_on_activate gates
//     activation on a live consent row; tg_validate_grant_source checks the polymorphic
//     source_id against its parent table. Org cannot self-grant (INSERT WITH CHECK
//     user_id = auth.uid()).
//   • data_deletion_requests [B] — subject creates + reads own; admins read. The
//     requested→processing→completed|rejected transitions are service-role/RPC
//     (Phase 8) — not exposed to authenticated here.
//   • admin_support_access  [B] — REVOKE-API: INSERT-only by an admin recording
//     THEMSELVES as requester (WITH CHECK is_admin() AND requested_by_admin_id =
//     auth.uid()). dual mode requires a distinct approver (table CHECK +
//     tg_enforce_support_approval); self/break_glass get a machine post-review
//     deadline (tg_set_review_deadline). No client SELECT grant — reads are via an
//     audited RPC (Phase 8).
// =============================================================================
import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import {
  accessGrants,
  dataDeletionRequests,
  adminSupportAccess,
  dpdpConsentRecords,
  uuidv7,
} from "@workspace/db";
import { z } from "zod";
import { authedRoute } from "../lib/route";
import { ApiError } from "../lib/http";

const router: IRouter = Router();

// ----- enum mirrors (exact DB values) ----------------------------------------
const CONSENT_TYPE = [
  "data_processing", "health_data_sharing", "marketing", "terms", "coach_access", "clinical_care",
] as const;
const ACCESS_SOURCE_TYPE = [
  "program_enrollment", "diet_assignment", "lab_review", "care_plan", "collaboration_agreement", "manual_consent",
] as const;
const GRANT_DATA_CATEGORY = [
  "health_data", "meals", "programs", "lab_results", "community", "orders", "messages", "clinical",
] as const;
const GRANT_TYPE = ["primary", "collaborating"] as const;
const ACCESS_LEVEL = ["view_only", "full"] as const;
const SUPPORT_APPROVAL_MODE = ["self", "dual", "break_glass"] as const;
const SUPPORT_REASON_CODE = [
  "support_ticket", "compliance_investigation", "legal_request", "fraud_review",
] as const;

const IdParam = z.object({ id: z.string().uuid() });

// =============================================================================
// Consent ledger — append-only (POST appends a grant/revoke event)
// =============================================================================
const CreateConsentBody = z.object({
  consentType: z.enum(CONSENT_TYPE),
  consentVersion: z.string().min(1),
  consentTextSnapshot: z.string().min(1),
  granted: z.boolean(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

// POST /consents — the authenticated subject appends a consent event for THEMSELVES
// (RLS WITH CHECK user_id = auth.uid()). granted=true records a grant; granted=false a
// revocation (a new immutable row). created_at-only ledger; no update path exists.
router.post(
  "/consents",
  authedRoute({ body: CreateConsentBody }, async ({ db, body, userId }) => {
    // REVOKE-API table: no SELECT grant → cannot use RETURNING (which needs SELECT
    // privilege). Insert and echo the app-generated id; the row is never read back.
    const id = uuidv7();
    await db.insert(dpdpConsentRecords).values({
      id,
      userId,
      consentType: body.consentType,
      consentVersion: body.consentVersion,
      consentTextSnapshot: body.consentTextSnapshot,
      granted: body.granted,
      ...(body.granted ? { grantedAt: new Date() } : { revokedAt: new Date() }),
      ...(body.ipAddress ? { ipAddress: body.ipAddress } : {}),
      ...(body.userAgent ? { userAgent: body.userAgent } : {}),
    });
    return { id, consentType: body.consentType, granted: body.granted };
  }),
);

// =============================================================================
// Access grants — subject grants an organization source-bound access to their data
// =============================================================================
const CreateGrantBody = z.object({
  organizationId: z.string().uuid(),
  sourceType: z.enum(ACCESS_SOURCE_TYPE),
  sourceId: z.string().uuid(),
  dataCategoriesGranted: z.array(z.enum(GRANT_DATA_CATEGORY)).min(1),
  grantType: z.enum(GRANT_TYPE),
  accessLevel: z.enum(ACCESS_LEVEL),
  endDate: z.string().date().optional(),
});
const RevokeGrantBody = z.object({
  status: z.literal("revoked"),
});

// POST /access-grants — subject creates an active grant for an org. Fires the consent
// gate (tg_require_consent_on_activate → 422 if no live consent) and source validation
// (tg_validate_grant_source → 422 if source_id absent). Subject-only (RLS → 403 otherwise).
router.post(
  "/access-grants",
  authedRoute({ body: CreateGrantBody }, async ({ db, body, userId }) => {
    const rows = await db
      .insert(accessGrants)
      .values({
        id: uuidv7(),
        organizationId: body.organizationId,
        userId,
        sourceType: body.sourceType,
        sourceId: body.sourceId,
        dataCategoriesGranted: body.dataCategoriesGranted,
        grantType: body.grantType,
        accessLevel: body.accessLevel,
        status: "active",
        ...(body.endDate ? { endDate: body.endDate } : {}),
      })
      .returning();
    return rows[0];
  }),
);

// GET /access-grants — subject sees their own grants; grantee-org members with
// view_client_health see grants naming their org (RLS access_grants_select).
router.get(
  "/access-grants",
  authedRoute({}, async ({ db }) => {
    const rows = await db.select().from(accessGrants);
    return { count: rows.length, grants: rows };
  }),
);

// PATCH /access-grants/:id — subject revokes their own grant (status→revoked). RLS
// access_grants_update restricts USING/WITH CHECK to user_id = auth.uid().
router.patch(
  "/access-grants/:id",
  authedRoute({ params: IdParam, body: RevokeGrantBody }, async ({ db, params, userId }) => {
    const rows = await db
      .update(accessGrants)
      .set({ status: "revoked", revokedAt: new Date(), revokedBy: userId, updatedAt: new Date() })
      .where(eq(accessGrants.id, params.id))
      .returning();
    if (rows.length === 0) {
      throw new ApiError(404, "not_found", "Access grant not found or not revocable.");
    }
    return rows[0];
  }),
);

// =============================================================================
// DPDP data-deletion (right-to-erasure) requests
// =============================================================================
const CreateDeletionBody = z.object({
  reason: z.string().min(1).optional(),
});

// POST /data-deletion-requests — the subject requests erasure of their own data
// (RLS WITH CHECK user_id = auth.uid()). status defaults to 'requested'.
router.post(
  "/data-deletion-requests",
  authedRoute({ body: CreateDeletionBody }, async ({ db, body, userId }) => {
    const rows = await db
      .insert(dataDeletionRequests)
      .values({
        id: uuidv7(),
        userId,
        ...(body.reason ? { reason: body.reason } : {}),
      })
      .returning();
    return rows[0];
  }),
);

// GET /data-deletion-requests — subject reads own; admins read all (RLS
// data_deletion_requests_select: user_id = auth.uid() OR is_admin()).
router.get(
  "/data-deletion-requests",
  authedRoute({}, async ({ db }) => {
    const rows = await db.select().from(dataDeletionRequests);
    return { count: rows.length, requests: rows };
  }),
);

// =============================================================================
// Admin support access — the ONLY admin→PHI path (hybrid self|dual|break_glass)
// =============================================================================
const CreateSupportAccessBody = z.object({
  subjectUserId: z.string().uuid(),
  approvalMode: z.enum(SUPPORT_APPROVAL_MODE),
  reasonCode: z.enum(SUPPORT_REASON_CODE),
  justification: z.string().min(1),
  ticketRef: z.string().optional(),
  approvedByAdminId: z.string().uuid().optional(), // required for dual mode (DB enforces)
  scopeCategories: z.array(z.enum(GRANT_DATA_CATEGORY)).optional(),
  expiresAt: z.string().datetime(),
});

// POST /admin-support-access — an admin records a support-access case, pinning
// requested_by_admin_id to themselves. RLS WITH CHECK requires is_admin() AND
// requested_by_admin_id = auth.uid() (non-admin → 403). dual mode without a distinct
// approver → 422 (table CHECK + tg_enforce_support_approval). self/break_glass get a
// machine review_deadline (tg_set_review_deadline). REVOKE-API: no SELECT here.
router.post(
  "/admin-support-access",
  authedRoute({ body: CreateSupportAccessBody }, async ({ db, body, userId }) => {
    // REVOKE-API table: no SELECT grant → no RETURNING. Echo the app-generated id.
    const id = uuidv7();
    await db.insert(adminSupportAccess).values({
      id,
      subjectUserId: body.subjectUserId,
      requestedByAdminId: userId,
      approvalMode: body.approvalMode,
      reasonCode: body.reasonCode,
      justification: body.justification,
      expiresAt: new Date(body.expiresAt),
      ...(body.ticketRef ? { ticketRef: body.ticketRef } : {}),
      ...(body.approvedByAdminId ? { approvedByAdminId: body.approvedByAdminId } : {}),
      ...(body.scopeCategories ? { scopeCategories: body.scopeCategories } : {}),
    });
    return { id, approvalMode: body.approvalMode, subjectUserId: body.subjectUserId };
  }),
);

export default router;
