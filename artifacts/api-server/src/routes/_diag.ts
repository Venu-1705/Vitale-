// =============================================================================
// Vitalé — Phase 0 seam self-check (DEV ONLY)
// -----------------------------------------------------------------------------
// A minimal diagnostic surface that proves the identity-context seam end-to-end:
//   • authedRoute requires identity (anonymous → 401)
//   • request → identityMiddleware → withUserContext → request.jwt.claims →
//     auth.uid() round-trips the caller's id
//   • RLS denial (WITH CHECK on a write) surfaces as 403 via the DB error mapper
//
// It deliberately touches a throwaway `seam_check.notes` fixture table, NOT any
// production domain table, so it never re-implements or bypasses real business
// rules. Mounted ONLY when DIAG_ENABLED=1 (see routes/index.ts) — never in prod.
// =============================================================================
import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { authedRoute } from "../lib/route";

const router: IRouter = Router();

const NoteParams = z.object({ id: z.string().uuid() });
const NoteInsert = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  body: z.string().min(1),
});

/**
 * Identity propagation: returns what the DB sees for this request. `dbUid` must
 * equal `claimedUserId`, and `dbRole` must be `authenticated` (proving SET LOCAL
 * ROLE + request.jwt.claims took effect inside the transaction).
 */
router.get(
  "/whoami",
  authedRoute({}, async ({ db, userId }) => {
    const result = await db.execute(
      sql`select auth.uid()::text as uid, current_user as role`,
    );
    const row = result.rows[0] as { uid: string | null; role: string };
    return { claimedUserId: userId, dbUid: row.uid, dbRole: row.role };
  }),
);

/**
 * RLS SELECT filtering: a caller sees the fixture row only if they own it.
 * Querying a row owned by someone else returns an empty set (RLS filters, does
 * not error) — demonstrating read isolation.
 */
router.get(
  "/notes/:id",
  authedRoute({ params: NoteParams }, async ({ db, params }) => {
    const result = await db.execute(
      sql`select id::text, owner_id::text, body
            from seam_check.notes
           where id = ${params.id}::uuid`,
    );
    return { count: result.rows.length, rows: result.rows };
  }),
);

/**
 * RLS WITH CHECK denial: inserting a row whose owner_id != auth.uid() violates the
 * policy → PostgreSQL raises 42501 → DbError(rls_denied) → 403. This is the path
 * that proves the error-mapping layer turns an RLS denial into the right status.
 */
router.post(
  "/notes",
  authedRoute({ body: NoteInsert }, async ({ db, body }) => {
    await db.execute(
      sql`insert into seam_check.notes (id, owner_id, body)
          values (${body.id}::uuid, ${body.ownerId}::uuid, ${body.body})`,
    );
    return { inserted: true };
  }),
);

export default router;
