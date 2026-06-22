// =============================================================================
// Vitalé — D3 Programs HTTP surface
// -----------------------------------------------------------------------------
// Canonical pipeline (authedRoute → withUserContext): validate → user context → DB →
// map errors → respond. Authorization is owned by the D3 RLS layer (0106 base policies +
// 0137 lifecycle), NEVER re-implemented here:
//
//   • programs / program_modules / program_sessions — authoring is org-scoped via
//     is_org_member(org,'manage_programs') (programs_insert/update; can_manage_program for
//     curriculum). Reads via programs_select (admin OR active org member OR published+public OR
//     the caller's own active enrollment). Direct policy-gated CRUD — no RPC needed for authoring.
//   • PATCH status='published' is the publish action — tg_bump_program_version snapshots the FULL
//     curriculum into an immutable program_versions row and stamps current_version/published_at.
//   • program_versions — read-only (immutable); SELECT-gated by program_versions_select.
//   • program_enrollments — SELECT-only to authenticated (self policy + coach grant-gated branch).
//     WRITES go through SECURITY DEFINER RPCs because the table has no INSERT/UPDATE grant:
//       POST /programs/:id/enroll      → rpc_enroll_in_program  (free-only; D8 paid path deferred)
//       POST /enrollments/:id/cancel   → rpc_cancel_enrollment  (active→cancelled, revokes grant)
//   • session_watches — self INSERT/UPDATE (own enrollment); the watch upsert drives
//     tg_rollup_progress (progress_pct + auto-completion at 100%).
//
// DPDP / coach-transfer / collaboration semantics are documented in 0137's header. In short:
// enrollment mints an org→subject ['programs']-ONLY grant (no PHI), consent-gated; coaches read a
// client's enrollment/progress only through the owning-org grant branch; revoking consent or
// cancelling removes coach read while preserving the subject's own rows.
//
// DEFERRED (this phase): paid enrollment (D8 Payments) — rpc_enroll_in_program returns a clear
// 422 'payment_required'; asset binding (D15) — cover_asset_id / video_url remain opaque.
// =============================================================================
import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { uuidv7 } from "@workspace/db";
import { authedRoute } from "../lib/route";
import { ApiError } from "../lib/http";

const router: IRouter = Router();

const IdParam = z.object({ id: z.string().uuid() });
const ModuleParam = z.object({ id: z.string().uuid(), moduleId: z.string().uuid() });
const SessionParam = z.object({
  id: z.string().uuid(),
  moduleId: z.string().uuid(),
  sessionId: z.string().uuid(),
});
const WatchParam = z.object({ id: z.string().uuid(), sessionId: z.string().uuid() });

// =============================================================================
// PROGRAMS — authoring + discovery (direct, RLS-gated).
// =============================================================================

const CreateProgram = z.object({
  organization_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
  description: z.string().max(5000).optional(),
  cover_asset_id: z.string().uuid().optional(),
  price_paise: z.coerce.number().int().min(0).default(0),
  currency: z.string().length(3).default("INR"),
  duration_days: z.coerce.number().int().min(1).max(3650).optional(),
  visibility: z.enum(["private", "unlisted", "public"]).default("private"),
  max_enrollments: z.coerce.number().int().min(1).optional(),
});
router.post(
  "/programs",
  authedRoute({ body: CreateProgram }, async ({ db, body, userId }) => {
    const result = await db.execute(sql`
      INSERT INTO public.programs
        (id, organization_id, created_by_user_id, title, slug, description, cover_asset_id,
         price_paise, currency, duration_days, visibility, max_enrollments, status)
      VALUES
        (${uuidv7()}::uuid, ${body.organization_id}::uuid, ${userId}::uuid, ${body.title}, ${body.slug},
         ${body.description ?? null}, ${body.cover_asset_id ?? null}, ${body.price_paise},
         ${body.currency}, ${body.duration_days ?? null}, ${body.visibility}::program_visibility,
         ${body.max_enrollments ?? null}, 'draft')
      RETURNING *
    `);
    return result.rows[0];
  }),
);

const ListPrograms = z.object({
  organization_id: z.string().uuid().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  visibility: z.enum(["private", "unlisted", "public"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
router.get(
  "/programs",
  authedRoute({ query: ListPrograms }, async ({ db, query }) => {
    const orgClause = query.organization_id
      ? sql`AND organization_id = ${query.organization_id}::uuid`
      : sql``;
    const statusClause = query.status
      ? sql`AND status = ${query.status}::program_status`
      : sql``;
    const visClause = query.visibility
      ? sql`AND visibility = ${query.visibility}::program_visibility`
      : sql``;
    const result = await db.execute(sql`
      SELECT * FROM public.programs
       WHERE true ${orgClause} ${statusClause} ${visClause}
       ORDER BY created_at DESC
       LIMIT ${query.limit}
    `);
    return result.rows;
  }),
);

router.get(
  "/programs/:id",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const result = await db.execute(sql`
      SELECT * FROM public.programs WHERE id = ${params.id}::uuid
    `);
    if (result.rows.length === 0) {
      throw new ApiError(404, "not_found", "Program not found.");
    }
    return result.rows[0];
  }),
);

// PATCH — partial update. status='published' is the publish action (trigger snapshots curriculum).
// Content-field edits are frozen by tg_no_edit_while_enrolled once an active enrollment exists.
const UpdateProgram = z
  .object({
    title: z.string().min(1).max(200).optional(),
    slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/).optional(),
    description: z.string().max(5000).nullable().optional(),
    cover_asset_id: z.string().uuid().nullable().optional(),
    price_paise: z.coerce.number().int().min(0).optional(),
    currency: z.string().length(3).optional(),
    duration_days: z.coerce.number().int().min(1).max(3650).nullable().optional(),
    visibility: z.enum(["private", "unlisted", "public"]).optional(),
    max_enrollments: z.coerce.number().int().min(1).nullable().optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update." });
router.patch(
  "/programs/:id",
  authedRoute({ params: IdParam, body: UpdateProgram }, async ({ db, params, body }) => {
    const sets = [];
    if (body.title !== undefined) sets.push(sql`title = ${body.title}`);
    if (body.slug !== undefined) sets.push(sql`slug = ${body.slug}`);
    if (body.description !== undefined) sets.push(sql`description = ${body.description}`);
    if (body.cover_asset_id !== undefined) sets.push(sql`cover_asset_id = ${body.cover_asset_id}`);
    if (body.price_paise !== undefined) sets.push(sql`price_paise = ${body.price_paise}`);
    if (body.currency !== undefined) sets.push(sql`currency = ${body.currency}`);
    if (body.duration_days !== undefined) sets.push(sql`duration_days = ${body.duration_days}`);
    if (body.visibility !== undefined)
      sets.push(sql`visibility = ${body.visibility}::program_visibility`);
    if (body.max_enrollments !== undefined)
      sets.push(sql`max_enrollments = ${body.max_enrollments}`);
    if (body.status !== undefined) sets.push(sql`status = ${body.status}::program_status`);
    const result = await db.execute(sql`
      UPDATE public.programs
         SET ${sql.join(sets, sql`, `)}
       WHERE id = ${params.id}::uuid
      RETURNING *
    `);
    if (result.rows.length === 0) {
      throw new ApiError(404, "not_found", "Program not found.");
    }
    return result.rows[0];
  }),
);

// =============================================================================
// VERSIONS — immutable publish snapshots (read-only).
// =============================================================================
router.get(
  "/programs/:id/versions",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const result = await db.execute(sql`
      SELECT id, program_id, version_number, created_by_user_id, change_summary, created_at
        FROM public.program_versions
       WHERE program_id = ${params.id}::uuid
       ORDER BY version_number DESC
    `);
    return result.rows;
  }),
);

const VersionParam = z.object({ id: z.string().uuid(), n: z.coerce.number().int().min(1) });
router.get(
  "/programs/:id/versions/:n",
  authedRoute({ params: VersionParam }, async ({ db, params }) => {
    const result = await db.execute(sql`
      SELECT * FROM public.program_versions
       WHERE program_id = ${params.id}::uuid AND version_number = ${params.n}
    `);
    if (result.rows.length === 0) {
      throw new ApiError(404, "not_found", "Program version not found.");
    }
    return result.rows[0];
  }),
);

// =============================================================================
// MODULES — curriculum structure (can_manage_program-gated by RLS).
// =============================================================================
const CreateModule = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  sort_order: z.coerce.number().int().min(0).default(0),
});
router.post(
  "/programs/:id/modules",
  authedRoute({ params: IdParam, body: CreateModule }, async ({ db, params, body }) => {
    const result = await db.execute(sql`
      INSERT INTO public.program_modules (id, program_id, title, description, sort_order)
      VALUES (${uuidv7()}::uuid, ${params.id}::uuid, ${body.title}, ${body.description ?? null}, ${body.sort_order})
      RETURNING *
    `);
    return result.rows[0];
  }),
);

const UpdateModule = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    sort_order: z.coerce.number().int().min(0).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update." });
router.patch(
  "/programs/:id/modules/:moduleId",
  authedRoute({ params: ModuleParam, body: UpdateModule }, async ({ db, params, body }) => {
    const sets = [];
    if (body.title !== undefined) sets.push(sql`title = ${body.title}`);
    if (body.description !== undefined) sets.push(sql`description = ${body.description}`);
    if (body.sort_order !== undefined) sets.push(sql`sort_order = ${body.sort_order}`);
    const result = await db.execute(sql`
      UPDATE public.program_modules
         SET ${sql.join(sets, sql`, `)}
       WHERE id = ${params.moduleId}::uuid AND program_id = ${params.id}::uuid
      RETURNING *
    `);
    if (result.rows.length === 0) {
      throw new ApiError(404, "not_found", "Module not found.");
    }
    return result.rows[0];
  }),
);

router.delete(
  "/programs/:id/modules/:moduleId",
  authedRoute({ params: ModuleParam }, async ({ db, params }) => {
    const result = await db.execute(sql`
      DELETE FROM public.program_modules
       WHERE id = ${params.moduleId}::uuid AND program_id = ${params.id}::uuid
      RETURNING id
    `);
    if (result.rows.length === 0) {
      throw new ApiError(404, "not_found", "Module not found.");
    }
    return undefined; // 204
  }),
);

// =============================================================================
// SESSIONS — curriculum leaves (can_manage_program-gated by RLS).
// =============================================================================
const CreateSession = z.object({
  title: z.string().min(1).max(200),
  content_type: z.enum(["video", "article", "live", "task"]),
  video_url: z.string().url().max(2000).optional(),
  content: z.unknown().optional(),
  duration_seconds: z.coerce.number().int().min(0).optional(),
  sort_order: z.coerce.number().int().min(0).default(0),
});
router.post(
  "/programs/:id/modules/:moduleId/sessions",
  authedRoute({ params: ModuleParam, body: CreateSession }, async ({ db, params, body }) => {
    const result = await db.execute(sql`
      INSERT INTO public.program_sessions
        (id, module_id, program_id, title, content_type, video_url, content, duration_seconds, sort_order)
      VALUES
        (${uuidv7()}::uuid, ${params.moduleId}::uuid, ${params.id}::uuid, ${body.title},
         ${body.content_type}::session_content_type, ${body.video_url ?? null},
         ${body.content ? JSON.stringify(body.content) : null}::jsonb,
         ${body.duration_seconds ?? null}, ${body.sort_order})
      RETURNING *
    `);
    return result.rows[0];
  }),
);

const UpdateSession = z
  .object({
    title: z.string().min(1).max(200).optional(),
    content_type: z.enum(["video", "article", "live", "task"]).optional(),
    video_url: z.string().url().max(2000).nullable().optional(),
    content: z.unknown().optional(),
    duration_seconds: z.coerce.number().int().min(0).nullable().optional(),
    sort_order: z.coerce.number().int().min(0).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update." });
router.patch(
  "/programs/:id/modules/:moduleId/sessions/:sessionId",
  authedRoute({ params: SessionParam, body: UpdateSession }, async ({ db, params, body }) => {
    const sets = [];
    if (body.title !== undefined) sets.push(sql`title = ${body.title}`);
    if (body.content_type !== undefined)
      sets.push(sql`content_type = ${body.content_type}::session_content_type`);
    if (body.video_url !== undefined) sets.push(sql`video_url = ${body.video_url}`);
    if (body.content !== undefined)
      sets.push(sql`content = ${body.content === null ? null : JSON.stringify(body.content)}::jsonb`);
    if (body.duration_seconds !== undefined)
      sets.push(sql`duration_seconds = ${body.duration_seconds}`);
    if (body.sort_order !== undefined) sets.push(sql`sort_order = ${body.sort_order}`);
    const result = await db.execute(sql`
      UPDATE public.program_sessions
         SET ${sql.join(sets, sql`, `)}
       WHERE id = ${params.sessionId}::uuid AND module_id = ${params.moduleId}::uuid
      RETURNING *
    `);
    if (result.rows.length === 0) {
      throw new ApiError(404, "not_found", "Session not found.");
    }
    return result.rows[0];
  }),
);

router.delete(
  "/programs/:id/modules/:moduleId/sessions/:sessionId",
  authedRoute({ params: SessionParam }, async ({ db, params }) => {
    const result = await db.execute(sql`
      DELETE FROM public.program_sessions
       WHERE id = ${params.sessionId}::uuid AND module_id = ${params.moduleId}::uuid
      RETURNING id
    `);
    if (result.rows.length === 0) {
      throw new ApiError(404, "not_found", "Session not found.");
    }
    return undefined; // 204
  }),
);

// =============================================================================
// ENROLLMENT — writes via SECURITY DEFINER RPCs (table is SELECT-only to authenticated).
// =============================================================================
router.post(
  "/programs/:id/enroll",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const result = await db.execute(sql`
      SELECT public.rpc_enroll_in_program(${params.id}::uuid) AS enrollment
    `);
    return result.rows[0]?.["enrollment"];
  }),
);

router.post(
  "/enrollments/:id/cancel",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const result = await db.execute(sql`
      SELECT public.rpc_cancel_enrollment(${params.id}::uuid) AS enrollment
    `);
    return result.rows[0]?.["enrollment"];
  }),
);

// The caller's own enrollments (program_enrollments_select_self).
router.get(
  "/my/enrollments",
  authedRoute({}, async ({ db }) => {
    const result = await db.execute(sql`
      SELECT e.*, p.title AS program_title, p.slug AS program_slug
        FROM public.program_enrollments e
        JOIN public.programs p ON p.id = e.program_id
       WHERE e.user_id = auth.uid()
       ORDER BY e.enrolled_at DESC
    `);
    return result.rows;
  }),
);

// A single enrollment — visible to the enrollee (self) or an owning-org coach (grant-gated branch).
router.get(
  "/enrollments/:id",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const result = await db.execute(sql`
      SELECT * FROM public.program_enrollments WHERE id = ${params.id}::uuid
    `);
    if (result.rows.length === 0) {
      throw new ApiError(404, "not_found", "Enrollment not found.");
    }
    return result.rows[0];
  }),
);

// Watch records for an enrollment — self or coach (grant-gated) via session_watches policies.
router.get(
  "/enrollments/:id/watches",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const result = await db.execute(sql`
      SELECT * FROM public.session_watches
       WHERE enrollment_id = ${params.id}::uuid
       ORDER BY created_at ASC
    `);
    return result.rows;
  }),
);

// Coach view: all enrollments for a program (owning-org, grant-gated branch governs visibility).
router.get(
  "/programs/:id/enrollments",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const result = await db.execute(sql`
      SELECT * FROM public.program_enrollments
       WHERE program_id = ${params.id}::uuid
       ORDER BY enrolled_at DESC
    `);
    return result.rows;
  }),
);

// =============================================================================
// PROGRESS — session watch upsert (self; drives rollup + auto-completion).
// =============================================================================
const Watch = z.object({
  watched_seconds: z.coerce.number().int().min(0).optional(),
  completed: z.boolean().optional(),
});
router.put(
  "/enrollments/:id/sessions/:sessionId/watch",
  authedRoute({ params: WatchParam, body: Watch }, async ({ db, params, body }) => {
    const result = await db.execute(sql`
      INSERT INTO public.session_watches
        (id, enrollment_id, session_id, user_id, watched_seconds, completed, last_watched_at)
      VALUES
        (${uuidv7()}::uuid, ${params.id}::uuid, ${params.sessionId}::uuid, auth.uid(),
         ${body.watched_seconds ?? 0}, ${body.completed ?? false}, now())
      ON CONFLICT (enrollment_id, session_id) DO UPDATE
        SET watched_seconds = GREATEST(public.session_watches.watched_seconds, EXCLUDED.watched_seconds),
            completed        = public.session_watches.completed OR EXCLUDED.completed,
            last_watched_at  = now()
      RETURNING *
    `);
    return result.rows[0];
  }),
);

export default router;
