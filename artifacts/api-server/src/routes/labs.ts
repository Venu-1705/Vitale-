// =============================================================================
// Vitalé — D11 Labs HTTP surface
// -----------------------------------------------------------------------------
// Canonical pipeline (authedRoute → withUserContext): validate → user context →
// DB → map errors → respond. Authorization is owned by the D11 RLS policies + grants
// (migration post/0122) and the audited read RPCs (post/0120 rpc_read_lab_report,
// post/0133 rpc_list_lab_reports), NOT re-implemented here.
//
// Access shapes by table:
//   • lab_packages / lab_tests [catalog, public-read] — SELECT granted to authenticated
//     (lab_*_select USING(true)); .returning()/.select() safe. Vendor-managed; not written here.
//   • lab_bookings [C, owner] — authenticated holds SELECT/INSERT/UPDATE. RLS:
//       lab_bookings_insert  WITH CHECK user_id = auth.uid()  (self-booking)
//       lab_bookings_select  USING user_id = auth.uid() OR can_read_health(user_id)  (owner + scoped coach)
//       lab_bookings_update  USING/WITH CHECK user_id = auth.uid()  (owner self-service)
//     SELECT grant exists → .returning() is safe.
//   • lab_reports / lab_report_results [B, PHI, REVOKE-API, RLS-FORCE] — NO SELECT/INSERT grant to
//     authenticated. The raw client can neither read nor write these directly.
//       - READ a single report + results: rpc_read_lab_report(id) — SECURITY DEFINER (owner v),
//         re-enforces the owner/can_read_health/admin gate, writes ONE coach_data_access_audit row
//         in-tx for coach/admin reads (self-reads NOT audited), returns report + results jsonb.
//       - LIST report HEADERS (no PHI values): rpc_list_lab_reports(subject) — same gate, same
//         audit discipline. Result VALUES remain obtainable only via rpc_read_lab_report.
//       - INGESTION (Thyrocare webhook) is a service-role path (BYPASSRLS), not exposed here.
//   • coach_lab_recommendations [C] — authenticated holds SELECT/INSERT. RLS:
//       clr_select USING user_id = auth.uid() OR coach_id = auth.uid()
//       clr_insert WITH CHECK coach_id = auth.uid()  (a coach recommends to a client)
//
// Error-code discipline (uniform with D5/D14): RPC access-denied → 42501 → 403;
// RPC report-not-found → no_data_found (P0002) → 404; CHECK/business-rule → 422; RLS-hidden
// rows on UPDATE/SELECT → 0 rows → 404/403 as appropriate.
//
// SHARING a report with a coach's org is NOT done here: it is a D2 access-grant
// (POST /access-grants with sourceType='lab_review', sourceId=<reportId>,
// dataCategoriesGranted=['lab_results']) which fires the consent gate + source validation +
// authoritative grant audit. Revocation is PATCH /access-grants/:id. (Spec Phase-8 line 1133.)
// =============================================================================
import { Router, type IRouter } from "express";
import { and, eq, desc } from "drizzle-orm";
import {
  labPackages,
  labTests,
  labBookings,
  coachLabRecommendations,
  uuidv7,
} from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { authedRoute } from "../lib/route";
import { ApiError } from "../lib/http";

const router: IRouter = Router();

const IdParam = z.object({ id: z.string().uuid() });

// =============================================================================
// Catalog — lab_packages / lab_tests (public read; vendor-managed, not written here)
// =============================================================================
const ListPackagesQuery = z.object({
  activeOnly: z.coerce.boolean().optional(),
  popularOnly: z.coerce.boolean().optional(),
});

// GET /labs/packages — catalog list. RLS lab_packages_select USING(true) → any authenticated caller.
router.get(
  "/packages",
  authedRoute({ query: ListPackagesQuery }, async ({ db, query }) => {
    const conds = [];
    if (query.activeOnly) conds.push(eq(labPackages.isActive, true));
    if (query.popularOnly) conds.push(eq(labPackages.popular, true));
    const rows = conds.length
      ? await db.select().from(labPackages).where(and(...conds)).orderBy(desc(labPackages.popular))
      : await db.select().from(labPackages).orderBy(desc(labPackages.popular));
    return { count: rows.length, packages: rows };
  }),
);

// GET /labs/packages/:slug — package detail + its tests.
const SlugParam = z.object({ slug: z.string().min(1) });
router.get(
  "/packages/:slug",
  authedRoute({ params: SlugParam }, async ({ db, params }) => {
    const pkgs = await db.select().from(labPackages).where(eq(labPackages.slug, params.slug)).limit(1);
    if (!pkgs[0]) {
      throw new ApiError(404, "not_found", "Package not found.");
    }
    const tests = await db.select().from(labTests).where(eq(labTests.packageId, pkgs[0].id));
    return { ...pkgs[0], tests };
  }),
);

// =============================================================================
// Bookings — lab_bookings [C, owner]
// =============================================================================
const CreateBookingBody = z.object({
  packageId: z.string().uuid(),
  slotDate: z.string().min(1),
  slotTime: z.string().min(1),
  collectionType: z.enum(["home", "centre"]).optional(),
  patientName: z.string().min(1).optional(),
  patientAge: z.number().int().positive().optional(),
  patientGender: z.string().min(1).optional(),
  patientPhone: z.string().min(1).optional(),
  addressId: z.string().uuid().optional(),
  amountPaise: z.number().int().nonnegative().optional(),
  notes: z.string().min(1).optional(),
});

// POST /labs/bookings — the subject books a package for THEMSELVES (RLS WITH CHECK
// user_id = auth.uid()). SELECT grant exists → .returning() is safe. Payment + vendor dispatch
// (Razorpay/Thyrocare) are deferred external integrations; status starts 'booked'.
router.post(
  "/bookings",
  authedRoute({ body: CreateBookingBody }, async ({ db, body, userId }) => {
    const rows = await db
      .insert(labBookings)
      .values({
        id: uuidv7(),
        userId,
        packageId: body.packageId,
        slotDate: body.slotDate,
        slotTime: body.slotTime,
        status: "booked",
        ...(body.collectionType ? { collectionType: body.collectionType } : {}),
        ...(body.patientName ? { patientName: body.patientName } : {}),
        ...(body.patientAge !== undefined ? { patientAge: body.patientAge } : {}),
        ...(body.patientGender ? { patientGender: body.patientGender } : {}),
        ...(body.patientPhone ? { patientPhone: body.patientPhone } : {}),
        ...(body.addressId ? { addressId: body.addressId } : {}),
        ...(body.amountPaise !== undefined ? { amountPaise: body.amountPaise } : {}),
        ...(body.notes ? { notes: body.notes } : {}),
      })
      .returning();
    return rows[0];
  }),
);

// GET /labs/bookings — list own bookings (RLS lab_bookings_select: owner + scoped coach).
router.get(
  "/bookings",
  authedRoute({}, async ({ db }) => {
    const rows = await db.select().from(labBookings).orderBy(desc(labBookings.createdAt));
    return { count: rows.length, bookings: rows };
  }),
);

// GET /labs/bookings/:id — single booking (RLS-filtered). Not visible → 404.
router.get(
  "/bookings/:id",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const rows = await db.select().from(labBookings).where(eq(labBookings.id, params.id)).limit(1);
    if (!rows[0]) {
      throw new ApiError(404, "not_found", "Booking not found.");
    }
    return rows[0];
  }),
);

// POST /labs/bookings/:id/cancel — owner cancels a non-terminal booking. RLS lab_bookings_update
// restricts the write to the owner. A terminal-state booking → 409 (state conflict).
const TERMINAL_BOOKING = ["cancelled", "reported", "completed"];
router.post(
  "/bookings/:id/cancel",
  authedRoute({ params: IdParam }, async ({ db, params, userId }) => {
    const rows = await db.select().from(labBookings).where(eq(labBookings.id, params.id)).limit(1);
    if (!rows[0]) {
      throw new ApiError(404, "not_found", "Booking not found.");
    }
    if (rows[0].userId !== userId) {
      throw new ApiError(403, "forbidden", "Only the booking owner may cancel it.");
    }
    if (TERMINAL_BOOKING.includes(rows[0].status)) {
      throw new ApiError(409, "conflict", `Cannot cancel a booking in '${rows[0].status}' status.`);
    }
    const updated = await db
      .update(labBookings)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(labBookings.id, params.id))
      .returning();
    return updated[0];
  }),
);

// =============================================================================
// Reports — lab_reports / lab_report_results [B, PHI, REVOKE-API]: read ONLY via audited RPCs
// =============================================================================
// GET /labs/reports — list report HEADERS for a subject (default: the caller's own).
// Delegates to rpc_list_lab_reports: self (unaudited) | coach/admin (audited). No PHI values.
const ListReportsQuery = z.object({
  subjectUserId: z.string().uuid().optional(),
});
router.get(
  "/reports",
  authedRoute({ query: ListReportsQuery }, async ({ db, query, userId }) => {
    const subject = query.subjectUserId ?? userId;
    const result = await db.execute(
      sql`select * from public.rpc_list_lab_reports(${subject}::uuid)`,
    );
    return { count: result.rows.length, reports: result.rows };
  }),
);

// GET /labs/reports/:id — single report + its result rows. Delegates to the SECURITY DEFINER,
// audited rpc_read_lab_report (re-enforces owner/can_read_health/admin gate; in-tx audit for
// coach/admin; self unaudited). RPC raises: not found → P0002 → 404; access denied → 42501 → 403.
router.get(
  "/reports/:id",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const result = await db.execute(
      sql`select * from public.rpc_read_lab_report(${params.id}::uuid)`,
    );
    // The RPC raises (404/403) before returning on miss/deny; a success yields exactly one row.
    if (result.rows.length === 0) {
      throw new ApiError(404, "not_found", "Report not found.");
    }
    return result.rows[0];
  }),
);

// =============================================================================
// Coach lab recommendations — coach_lab_recommendations [C]
// =============================================================================
// GET /labs/coach-recommendations — rows where the caller is the subject OR the coach
// (RLS clr_select). Optionally filter to one subject.
const ListRecsQuery = z.object({
  subjectUserId: z.string().uuid().optional(),
});
router.get(
  "/coach-recommendations",
  authedRoute({ query: ListRecsQuery }, async ({ db, query }) => {
    const rows = query.subjectUserId
      ? await db
          .select()
          .from(coachLabRecommendations)
          .where(eq(coachLabRecommendations.userId, query.subjectUserId))
          .orderBy(desc(coachLabRecommendations.createdAt))
      : await db.select().from(coachLabRecommendations).orderBy(desc(coachLabRecommendations.createdAt));
    return { count: rows.length, recommendations: rows };
  }),
);

// POST /labs/coach-recommendations — a coach recommends a package to a client. RLS clr_insert
// WITH CHECK coach_id = auth.uid() (the caller is pinned as the coach; non-members/spoofing → 403).
// SELECT grant exists → .returning() is safe.
const CreateRecBody = z.object({
  userId: z.string().uuid(), // the subject the recommendation is for
  packageId: z.string().uuid(),
  note: z.string().min(1).optional(),
});
router.post(
  "/coach-recommendations",
  authedRoute({ body: CreateRecBody }, async ({ db, body, userId }) => {
    const rows = await db
      .insert(coachLabRecommendations)
      .values({
        id: uuidv7(),
        coachId: userId,
        userId: body.userId,
        packageId: body.packageId,
        ...(body.note ? { note: body.note } : {}),
      })
      .returning();
    return rows[0];
  }),
);

export default router;
