// =============================================================================
// Vitalé — D10 Notifications HTTP surface (in-app read scope)
// -----------------------------------------------------------------------------
// Canonical pipeline (authedRoute → withUserContext): validate → user context → DB →
// map errors → respond. Authorization is NOT re-implemented here — it is owned by the
// D10 RLS policies + grants (migration post/0136, notifications-only D10 subset):
//
//   • notification_types [lookup] — controlled vocabulary. Public catalog: GRANT SELECT to
//     anon/authenticated; writes are owner/service-role only (admin tooling). Read-only here.
//   • notifications [A, PARTITIONED] — recipient inbox. PK (id, created_date_ist). RLS:
//     notifications_select / notifications_update both USING user_id = auth.uid() (recipient only).
//     GRANT SELECT (whole row) + a COLUMN-level UPDATE on (read, read_at) ONLY. NO INSERT grant —
//     notifications are written by the service-role outbox path (BYPASSRLS), never an authenticated
//     client; so there is NO create endpoint here. NO DELETE grant — retention is the partition job.
//
// WHY NO READ RPC (unlike D5/D11/D14): a recipient reads THEIR OWN notifications. This is the
// subject's own data, not cross-user PHI, so a policy-gated direct SELECT is correct — no audited
// SECURITY DEFINER RPC is needed. The recipient-match policy is the whole gate.
//
// COLUMN-SCOPED WRITE: the only mutation an authenticated caller may perform is flipping the read
// flag. The DB enforces this two ways — the GRANT UPDATE (read, read_at) column scope AND the
// notifications_update row policy — so even a crafted UPDATE of title/body/etc. is rejected by the
// missing column privilege. The handlers below only ever set read / read_at.
//
// DEFERRED (this phase): notification creation (service-role outbox); the message→notification
// fan-out worker/trigger; push delivery (FCM/APNs, external); Realtime live transport/publication.
// =============================================================================
import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { authedRoute } from "../lib/route";
import { ApiError } from "../lib/http";

const router: IRouter = Router();

const IdParam = z.object({ id: z.string().uuid() });

// =============================================================================
// GET /notification-types — the controlled-vocabulary catalog (active types).
// Public-ish read (any authenticated caller); used by clients to label/route notifications.
// =============================================================================
router.get(
  "/notification-types",
  authedRoute({}, async ({ db }) => {
    const result = await db.execute(sql`
      SELECT id, key, name, default_priority, is_active
        FROM public.notification_types
       WHERE is_active = true
       ORDER BY key
    `);
    return result.rows;
  }),
);

// =============================================================================
// GET /notifications — the caller's inbox, newest-first. RLS scopes to user_id = auth.uid().
// ?unread=true  → only unread. ?before=<created_at ISO> → keyset page strictly older than that.
// LEFT JOIN notification_types to surface the type key/name alongside each row.
// =============================================================================
const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  before: z.string().datetime().optional(), // keyset: rows strictly older than this created_at
  unread: z.enum(["true", "false"]).optional(),
});
router.get(
  "/notifications",
  authedRoute({ query: ListQuery }, async ({ db, query }) => {
    const unreadClause = query.unread === "true" ? sql`AND n.read = false` : sql``;
    const beforeClause = query.before
      ? sql`AND n.created_at < ${query.before}::timestamptz`
      : sql``;
    const result = await db.execute(sql`
      SELECT n.id, n.created_date_ist, n.user_id, n.notification_type_id,
             nt.key  AS type_key, nt.name AS type_name,
             n.title, n.body, n.data, n.read, n.read_at, n.priority, n.created_at
        FROM public.notifications n
        LEFT JOIN public.notification_types nt ON nt.id = n.notification_type_id
       WHERE n.user_id = auth.uid()
         ${unreadClause}
         ${beforeClause}
       ORDER BY n.created_at DESC
       LIMIT ${query.limit}
    `);
    return result.rows;
  }),
);

// =============================================================================
// GET /notifications/unread-count — convenience badge count of the caller's unread.
// =============================================================================
router.get(
  "/notifications/unread-count",
  authedRoute({}, async ({ db }) => {
    const result = await db.execute(sql`
      SELECT count(*)::int AS unread
        FROM public.notifications
       WHERE user_id = auth.uid() AND read = false
    `);
    return result.rows[0] ?? { unread: 0 };
  }),
);

// =============================================================================
// POST /notifications/:id/read — mark one notification read (idempotent). RLS + column grant limit
// the write to the recipient's own row and to (read, read_at). read_at is preserved if already read.
// 404 when the row is not found / not the caller's.
// =============================================================================
router.post(
  "/notifications/:id/read",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const result = await db.execute(sql`
      UPDATE public.notifications
         SET read = true, read_at = COALESCE(read_at, now())
       WHERE id = ${params.id}::uuid
      RETURNING id, created_date_ist, user_id, read, read_at
    `);
    if (result.rows.length === 0) {
      throw new ApiError(404, "not_found", "Notification not found.");
    }
    return result.rows[0];
  }),
);

// =============================================================================
// POST /notifications/read-all — mark every unread notification read. RLS scopes the UPDATE to the
// caller's own rows; returns how many were flipped. Idempotent (0 when already all-read).
// =============================================================================
router.post(
  "/notifications/read-all",
  authedRoute({}, async ({ db }) => {
    const result = await db.execute(sql`
      UPDATE public.notifications
         SET read = true, read_at = now()
       WHERE user_id = auth.uid() AND read = false
    `);
    return { updated: result.rowCount ?? 0 };
  }),
);

export default router;
