// =============================================================================
// Vitalé — D0 Organizations & Membership (Phase 1) HTTP surface
// -----------------------------------------------------------------------------
// Every endpoint is the canonical pipeline (ARCHITECTURE_FIRST_ROADMAP Rule 7):
//     validate input → establish user context → call database → map errors → respond.
// `authedRoute` (lib/route.ts) encodes that once; handlers stay pure and read the
// RLS-live `db` already bound to the caller's identity.
//
// AUTHORIZATION IS NOT RE-IMPLEMENTED HERE. Who-may-do-what is decided entirely by
// the D0 RLS policies + helper functions + triggers + constraints already in the
// database (migrations 0005 + post/0101 + 0129):
//   • coach_organizations / organization_members / *_member_permissions / invitations /
//     organization_profiles RLS policies gate every SELECT/INSERT/UPDATE/DELETE.
//   • is_org_member(org,'manage_staff') / owner_coach_id checks live in those policies.
//   • tg_sync_owner_member, tg_guard_razorpay_account enforce invariants.
//   • rpc_transfer_org_ownership (0129, SECURITY DEFINER, self-gated) owns the atomic
//     ownership handoff.
// A handler simply issues the write under the caller's context and lets the database
// accept or reject; the terminal errorHandler maps an RLS denial → 403 and a
// trigger/constraint violation → 422/409.
//
// THE ONE EXCEPTION — POST /organizations (org bootstrap). The founding owner cannot
// insert their own organization_members owner row under RLS (organization_members_write
// requires is_org_member(org,'manage_staff'), which presupposes an existing membership —
// a chicken-and-egg with no DB-level owner-bootstrap trigger). We therefore provision the
// org + its single owner_coach membership atomically in a service-context transaction,
// with the owner pinned to the AUTHENTICATED caller (req.userId, the trusted seam). This
// is provisioning (structural: owner == self), not an authorization decision — mirroring
// how tg_provision_user provisions public.users with elevated rights. See the Phase 1
// report for the flagged "no owner-membership bootstrap" gap and its deferred DB-side fix.
// =============================================================================
import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import {
  withServiceContext,
  uuidv7,
  coachOrganizations,
  organizationMembers,
  organizationMemberPermissions,
  organizationProfiles,
  invitations,
} from "@workspace/db";
import { z } from "zod";
import { authedRoute } from "../lib/route";
import { ApiError } from "../lib/http";

const router: IRouter = Router();

// ----- Zod request schemas (values mirror the DB enums exactly) ---------------
const STAFF_ROLES = ["nutritionist", "community_manager"] as const; // never 'owner_coach' via API
const MEMBER_STATUS = ["invited", "active", "suspended", "removed"] as const;
const ORG_STATUS = ["active", "suspended", "closed"] as const;
const KYC_STATUS = ["pending", "verified", "rejected"] as const;
const INVITATION_STATUS = ["pending", "accepted", "revoked", "expired"] as const;
const CAPABILITIES = [
  "view_client_health", "manage_programs", "manage_diet_charts", "message_clients",
  "moderate_community", "manage_staff", "view_revenue", "manage_lab_recommendations",
  "manage_products", "write_clinical_notes", "manage_care_plans",
] as const;

const OrgIdParam = z.object({ id: z.string().uuid() });
const OrgMemberParam = z.object({ id: z.string().uuid(), memberId: z.string().uuid() });
const OrgMemberCapParam = z.object({
  id: z.string().uuid(),
  memberId: z.string().uuid(),
  capability: z.enum(CAPABILITIES),
});
const OrgInvitationParam = z.object({ id: z.string().uuid(), invitationId: z.string().uuid() });

const CreateOrgBody = z.object({
  businessName: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "slug must be kebab-case"),
});
const UpdateOrgBody = z.object({
  businessName: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  status: z.enum(ORG_STATUS).optional(),
}).refine((b) => Object.keys(b).length > 0, { message: "no fields to update" });

const CreateMemberBody = z.object({
  userId: z.string().uuid(),
  memberRole: z.enum(STAFF_ROLES),
  status: z.enum(MEMBER_STATUS).optional(),
});
const UpdateMemberBody = z.object({
  memberRole: z.enum(STAFF_ROLES).optional(),
  status: z.enum(MEMBER_STATUS).optional(),
}).refine((b) => Object.keys(b).length > 0, { message: "no fields to update" });

const GrantCapabilityBody = z.object({ capability: z.enum(CAPABILITIES) });

const CreateInvitationBody = z.object({
  email: z.string().email(),
  invitedRole: z.enum(STAFF_ROLES),
  token: z.string().min(8),
  expiresAt: z.string().datetime(),
});
const UpdateInvitationBody = z.object({ status: z.enum(INVITATION_STATUS) });

const ProfileBody = z.object({
  legalName: z.string().min(1).optional(),
  description: z.string().optional(),
  websiteUrl: z.string().url().optional(),
  gstin: z.string().optional(),
  kycStatus: z.enum(KYC_STATUS).optional(),
  // Ciphertext only — never raw PAN/bank details (app-layer encrypted upstream).
  panEncrypted: z.string().optional(),
  bankDetailsEncrypted: z.string().optional(),
  // Guarded by tg_guard_razorpay_account: allowed non-null only when kyc_status='verified'.
  razorpayLinkedAccountId: z.string().optional(),
});
const TransferOwnershipBody = z.object({ newOwnerId: z.string().uuid() });

// =============================================================================
// Organizations
// =============================================================================

// POST /organizations — bootstrap an org + its single owner_coach membership atomically.
// Service-context provisioning (see file header): owner is pinned to the authenticated
// caller; this is the one endpoint that cannot run under plain caller RLS.
router.post("/", (req, res, next) => {
  void (async () => {
    const userId = req.userId;
    if (!userId) {
      throw new ApiError(401, "unauthenticated", "Authentication is required.");
    }
    const body = CreateOrgBody.parse(req.body);
    const orgId = uuidv7();
    const ownerMemberId = uuidv7();

    const result = await withServiceContext(async (db) => {
      await db.insert(coachOrganizations).values({
        id: orgId,
        ownerCoachId: userId,
        businessName: body.businessName,
        slug: body.slug,
      });
      // The owner_coach seat. tg_sync_owner_member requires user_id == owner_coach_id.
      await db.insert(organizationMembers).values({
        id: ownerMemberId,
        organizationId: orgId,
        userId,
        memberRole: "owner_coach",
        status: "active",
        joinedAt: new Date(),
      });
      return { id: orgId, ownerMembershipId: ownerMemberId };
    });

    res.status(201).json(result);
  })().catch(next);
});

// GET /organizations — list orgs the caller may see (RLS: admin or active member).
router.get(
  "/",
  authedRoute({}, async ({ db }) => {
    const rows = await db.select().from(coachOrganizations);
    return { count: rows.length, organizations: rows };
  }),
);

// GET /organizations/:id
router.get(
  "/:id",
  authedRoute({ params: OrgIdParam }, async ({ db, params }) => {
    const rows = await db
      .select()
      .from(coachOrganizations)
      .where(eq(coachOrganizations.id, params.id));
    if (rows.length === 0) {
      throw new ApiError(404, "not_found", "Organization not found.");
    }
    return rows[0];
  }),
);

// PATCH /organizations/:id — owner-only (RLS coach_organizations_update_owner).
router.patch(
  "/:id",
  authedRoute({ params: OrgIdParam, body: UpdateOrgBody }, async ({ db, params, body }) => {
    const rows = await db
      .update(coachOrganizations)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(coachOrganizations.id, params.id))
      .returning();
    if (rows.length === 0) {
      // RLS filtered the row out (not owner) or it doesn't exist.
      throw new ApiError(404, "not_found", "Organization not found or not writable.");
    }
    return rows[0];
  }),
);

// =============================================================================
// Membership
// =============================================================================

// POST /organizations/:id/members — admit staff (RLS: manage_staff).
router.post(
  "/:id/members",
  authedRoute({ params: OrgIdParam, body: CreateMemberBody }, async ({ db, params, body, userId }) => {
    const rows = await db
      .insert(organizationMembers)
      .values({
        id: uuidv7(),
        organizationId: params.id,
        userId: body.userId,
        memberRole: body.memberRole,
        status: body.status ?? "invited",
        invitedBy: userId,
        invitedAt: new Date(),
        ...(body.status === "active" ? { joinedAt: new Date() } : {}),
      })
      .returning();
    return rows[0];
  }),
);

// GET /organizations/:id/members — same-org members + admins (RLS).
router.get(
  "/:id/members",
  authedRoute({ params: OrgIdParam }, async ({ db, params }) => {
    const rows = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, params.id));
    return { count: rows.length, members: rows };
  }),
);

// PATCH /organizations/:id/members/:memberId — update role/status (RLS: manage_staff).
router.patch(
  "/:id/members/:memberId",
  authedRoute({ params: OrgMemberParam, body: UpdateMemberBody }, async ({ db, params, body }) => {
    const rows = await db
      .update(organizationMembers)
      .set({
        ...body,
        ...(body.status === "active" ? { joinedAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(organizationMembers.id, params.memberId),
          eq(organizationMembers.organizationId, params.id),
        ),
      )
      .returning();
    if (rows.length === 0) {
      throw new ApiError(404, "not_found", "Member not found or not writable.");
    }
    return rows[0];
  }),
);

// DELETE /organizations/:id/members/:memberId — soft remove (status→removed; RLS: manage_staff).
router.delete(
  "/:id/members/:memberId",
  authedRoute({ params: OrgMemberParam }, async ({ db, params }) => {
    const rows = await db
      .update(organizationMembers)
      .set({ status: "removed", removedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(organizationMembers.id, params.memberId),
          eq(organizationMembers.organizationId, params.id),
        ),
      )
      .returning();
    if (rows.length === 0) {
      throw new ApiError(404, "not_found", "Member not found or not writable.");
    }
    return { removed: true, memberId: params.memberId };
  }),
);

// =============================================================================
// Capabilities (relational grants — no JSONB blobs; no self-escalation, enforced by RLS)
// =============================================================================

// GET .../members/:memberId/permissions
router.get(
  "/:id/members/:memberId/permissions",
  authedRoute({ params: OrgMemberParam }, async ({ db, params }) => {
    const rows = await db
      .select()
      .from(organizationMemberPermissions)
      .where(eq(organizationMemberPermissions.memberId, params.memberId));
    return { count: rows.length, permissions: rows };
  }),
);

// POST .../members/:memberId/permissions — grant a capability (RLS omp_insert:
// manage_staff AND not one's own membership → 403 on self-grant).
router.post(
  "/:id/members/:memberId/permissions",
  authedRoute({ params: OrgMemberParam, body: GrantCapabilityBody }, async ({ db, params, body, userId }) => {
    const rows = await db
      .insert(organizationMemberPermissions)
      .values({
        id: uuidv7(),
        memberId: params.memberId,
        capability: body.capability,
        grantedBy: userId,
      })
      .returning();
    return rows[0];
  }),
);

// DELETE .../members/:memberId/permissions/:capability — revoke (RLS omp_delete).
router.delete(
  "/:id/members/:memberId/permissions/:capability",
  authedRoute({ params: OrgMemberCapParam }, async ({ db, params }) => {
    const rows = await db
      .delete(organizationMemberPermissions)
      .where(
        and(
          eq(organizationMemberPermissions.memberId, params.memberId),
          eq(organizationMemberPermissions.capability, params.capability),
        ),
      )
      .returning();
    if (rows.length === 0) {
      throw new ApiError(404, "not_found", "Permission grant not found or not revocable.");
    }
    return { revoked: true, capability: params.capability };
  }),
);

// =============================================================================
// Invitations (staff onboarding before a users row exists)
// =============================================================================

router.post(
  "/:id/invitations",
  authedRoute({ params: OrgIdParam, body: CreateInvitationBody }, async ({ db, params, body, userId }) => {
    const rows = await db
      .insert(invitations)
      .values({
        id: uuidv7(),
        organizationId: params.id,
        email: body.email,
        invitedRole: body.invitedRole,
        token: body.token,
        invitedBy: userId,
        expiresAt: new Date(body.expiresAt),
      })
      .returning();
    return rows[0];
  }),
);

router.get(
  "/:id/invitations",
  authedRoute({ params: OrgIdParam }, async ({ db, params }) => {
    const rows = await db
      .select()
      .from(invitations)
      .where(eq(invitations.organizationId, params.id));
    return { count: rows.length, invitations: rows };
  }),
);

router.patch(
  "/:id/invitations/:invitationId",
  authedRoute({ params: OrgInvitationParam, body: UpdateInvitationBody }, async ({ db, params, body }) => {
    const rows = await db
      .update(invitations)
      .set({ status: body.status, updatedAt: new Date() })
      .where(
        and(
          eq(invitations.id, params.invitationId),
          eq(invitations.organizationId, params.id),
        ),
      )
      .returning();
    if (rows.length === 0) {
      throw new ApiError(404, "not_found", "Invitation not found or not writable.");
    }
    return rows[0];
  }),
);

// =============================================================================
// Organization profile (business identity + KYC/financial; owner-only writes)
// =============================================================================

// PUT /organizations/:id/profile — create-or-update the 1:1 profile (owner-only via RLS).
// tg_guard_razorpay_account rejects a non-null razorpay_linked_account_id unless
// kyc_status='verified' → check_violation → 422.
router.put(
  "/:id/profile",
  authedRoute({ params: OrgIdParam, body: ProfileBody }, async ({ db, params, body }) => {
    const rows = await db
      .insert(organizationProfiles)
      .values({ id: uuidv7(), organizationId: params.id, ...body })
      .onConflictDoUpdate({
        target: organizationProfiles.organizationId,
        set: { ...body, updatedAt: new Date() },
      })
      .returning();
    return rows[0];
  }),
);

// =============================================================================
// Ownership transfer (atomic, invariant-laden → the DB RPC owns it)
// =============================================================================

router.post(
  "/:id/transfer-ownership",
  authedRoute({ params: OrgIdParam, body: TransferOwnershipBody }, async ({ db, params, body }) => {
    await db.execute(
      sql`select public.rpc_transfer_org_ownership(${params.id}::uuid, ${body.newOwnerId}::uuid)`,
    );
    return { transferred: true, organizationId: params.id, newOwnerId: body.newOwnerId };
  }),
);

export default router;
