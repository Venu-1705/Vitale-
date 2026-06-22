// =============================================================================
// Vitalé — D13 Messaging HTTP surface
// -----------------------------------------------------------------------------
// Canonical pipeline (authedRoute → withUserContext): validate → user context → DB →
// map errors → respond. Authorization is NOT re-implemented here — it is owned by the
// D13 RLS policies + triggers + grants (migration post/0135, messages-only D13 subset):
//
//   • conversations [C, RLS-FORCE] — a thread. INSERT gated by conversation_basis_ok
//     (mirrored by tg_assert_conversation_basis): coach/staff/care_team need an active
//     'messages' access_grant for the subject + message_clients (or customer self-init);
//     community_peer needs shares_active_context with the subject. SELECT/UPDATE =
//     is_conversation_participant(id). Archive = UPDATE status→'archived'.
//   • conversation_participants [RLS-FORCE] — roster. INSERT = an existing participant adds
//     someone, OR a user self-joins a conversation whose basis they satisfy (can_join_conversation).
//     UPDATE = own row only (last_read_at; left_at to leave). Partial-unique active key
//     (conversation,user) WHERE left_at IS NULL → 23505→409 on a double active-join.
//   • messages [A, PARTITIONED, REVOKE-API] — chat. PK (id, created_date_ist). SELECT/INSERT =
//     participant; UPDATE = sender (column scope via tg_protect_sender → body/edited_at/
//     deleted_at only; sender_user_id/conversation_id/created_* immutable). No DELETE grant —
//     removal is the soft-delete UPDATE (deleted_at). Editable per frozen Decision #10.
//
// MVCC self-referential SELECT-policy trap (same trap/cure as community join + care_plans):
//   conversations_select and conversation_participants_select both re-query
//   conversation_participants via is_conversation_participant(). During an INSERT...RETURNING the
//   just-written row is not yet visible to that SECURITY DEFINER sub-query (the snapshot is taken at
//   command start), so RETURNING's SELECT-policy check spuriously fails (42501). Cure: INSERT WITHOUT
//   .returning(), then read back in a SECOND statement (same txn) where the caller is now a
//   participant. messages do NOT suffer this — messages_select keys off conversation_participants
//   (a DIFFERENT table that already holds the caller's row), so message INSERT...RETURNING is safe.
//
// Partition-routing note (messages): created_date_ist is the RANGE partition key, normally set by
// the tg_set_created_date_ist BEFORE-INSERT trigger. PostgreSQL routes the tuple to a partition
// BEFORE the row trigger fires — so a NULL key routes to _default and the trigger's later assignment
// is rejected ("moving row to another partition during a BEFORE FOR EACH ROW trigger is not
// supported"). We therefore supply created_date_ist explicitly, computed by the DB with the SAME IST
// expression the trigger uses, from one now() in a CTE; routing lands in the right partition and the
// trigger recomputes the identical value (no move). (Identical to the D5 health_observations path.)
//
// DEFERRED (Decision B): message attachments (until D15 assets have a secured creation path);
// notifications/D10; Realtime live-delivery transport; message_flags.
// =============================================================================
import { Router, type IRouter } from "express";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { conversations, conversationParticipants, uuidv7 } from "@workspace/db";
import { z } from "zod";
import { authedRoute } from "../lib/route";
import { ApiError } from "../lib/http";

const router: IRouter = Router();

// ----- enum mirrors (exact DB values) ----------------------------------------
const CONVERSATION_TYPE = ["coach_user", "staff_user", "care_team", "community_peer"] as const;
const CONVERSATION_STATUS = ["active", "archived"] as const;

const IdParam = z.object({ id: z.string().uuid() });

// =============================================================================
// Conversations — create / list / get / archive
// =============================================================================

// POST /conversations — open a thread. The DB basis gate (conversation_basis_ok + the BEFORE-INSERT
// tg_assert_conversation_basis) decides whether the caller may create a conversation of this shape;
// an unmet basis raises check_violation → 422. We then seat the caller (self-join) and, for a
// directed thread, the subject — both via the participant policies.
//
// NO .returning() on the conversation/participant inserts (MVCC self-ref trap, see header). The
// conversation is read back after the caller is seated.
const CreateConversationBody = z
  .object({
    conversationType: z.enum(CONVERSATION_TYPE),
    organizationId: z.string().uuid().nullish(),
    subjectUserId: z.string().uuid().nullish(),
  })
  .refine((v) => v.conversationType === "community_peer" || v.organizationId != null, {
    message: "organizationId is required for coach_user / staff_user / care_team conversations.",
  })
  .refine((v) => v.subjectUserId != null, {
    message: "subjectUserId is required (the customer, or the community peer).",
  });

router.post(
  "/conversations",
  authedRoute({ body: CreateConversationBody }, async ({ db, body, userId }) => {
    const convId = uuidv7();

    // 1) create the conversation (basis enforced by policy + trigger). No RETURNING.
    await db.insert(conversations).values({
      id: convId,
      conversationType: body.conversationType,
      organizationId: body.organizationId ?? null,
      subjectUserId: body.subjectUserId ?? null,
    });

    // 2) seat the caller (self-join: can_join_conversation re-checks the stored basis).
    await db.insert(conversationParticipants).values({
      id: uuidv7(),
      conversationId: convId,
      userId,
    });

    // 3) seat the subject when it is a different user (directed coach/care thread or peer DM).
    //    The caller is now a participant, so the participant INSERT policy's first arm permits this.
    if (body.subjectUserId && body.subjectUserId !== userId) {
      await db.insert(conversationParticipants).values({
        id: uuidv7(),
        conversationId: convId,
        userId: body.subjectUserId,
      });
    }

    // 4) read back (caller is now a participant → visible under conversations_select).
    const rows = await db.select().from(conversations).where(eq(conversations.id, convId));
    return rows[0];
  }),
);

// GET /conversations — the caller's threads (RLS scopes to conversations they participate in).
router.get(
  "/conversations",
  authedRoute({}, async ({ db }) => {
    const rows = await db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.updatedAt));
    return rows;
  }),
);

// GET /conversations/:id — a single thread (404 if the caller is not a participant — RLS hides it).
router.get(
  "/conversations/:id",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const rows = await db.select().from(conversations).where(eq(conversations.id, params.id));
    if (rows.length === 0 || !rows[0]) {
      throw new ApiError(404, "not_found", "Conversation not found.");
    }
    return rows[0];
  }),
);

// PATCH /conversations/:id — lifecycle (archive / re-activate). UPDATE is gated to participants;
// read back the row (caller is a participant → visible). 404 when not a participant.
const UpdateConversationBody = z.object({ status: z.enum(CONVERSATION_STATUS) });
router.patch(
  "/conversations/:id",
  authedRoute(
    { params: IdParam, body: UpdateConversationBody },
    async ({ db, params, body }) => {
      const existing = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.id, params.id));
      if (existing.length === 0 || !existing[0]) {
        throw new ApiError(404, "not_found", "Conversation not found.");
      }
      await db
        .update(conversations)
        .set({ status: body.status })
        .where(eq(conversations.id, params.id));
      const rows = await db.select().from(conversations).where(eq(conversations.id, params.id));
      return rows[0];
    },
  ),
);

// =============================================================================
// Participants — add / roster / leave / mark-read
// =============================================================================

// POST /conversations/:id/participants — add a member. Permitted when the caller is already a
// participant (adds anyone) or the target is the caller self-joining a basis-satisfying thread.
const AddParticipantBody = z.object({ userId: z.string().uuid() });
router.post(
  "/conversations/:id/participants",
  authedRoute(
    { params: IdParam, body: AddParticipantBody },
    async ({ db, params, body }) => {
      const partId = uuidv7();
      await db.insert(conversationParticipants).values({
        id: partId,
        conversationId: params.id,
        userId: body.userId,
      });
      // Read back via the active-roster query (caller is a participant → roster visible).
      const rows = await db
        .select()
        .from(conversationParticipants)
        .where(eq(conversationParticipants.id, partId));
      return rows[0] ?? { id: partId, conversationId: params.id, userId: body.userId };
    },
  ),
);

// GET /conversations/:id/participants — the active roster (RLS: participants only).
router.get(
  "/conversations/:id/participants",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const rows = await db
      .select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, params.id))
      .orderBy(desc(conversationParticipants.joinedAt));
    return rows;
  }),
);

// POST /conversations/:id/leave — the caller leaves (left_at tombstone; re-join allowed later).
// SELECT-first for the 404 decision; UPDATE own row (participants_update USING user_id=auth.uid()).
router.post(
  "/conversations/:id/leave",
  authedRoute({ params: IdParam }, async ({ db, params, userId }) => {
    const existing = await db
      .select({ id: conversationParticipants.id })
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, params.id),
          eq(conversationParticipants.userId, userId),
          isNull(conversationParticipants.leftAt),
        ),
      );
    if (existing.length === 0 || !existing[0]) {
      throw new ApiError(404, "not_found", "No active membership in this conversation.");
    }
    const now = new Date();
    await db
      .update(conversationParticipants)
      .set({ leftAt: now })
      .where(eq(conversationParticipants.id, existing[0].id));
    return { id: existing[0].id, conversationId: params.id, userId, leftAt: now };
  }),
);

// POST /conversations/:id/read — advance the caller's read cursor (drives unread counts).
router.post(
  "/conversations/:id/read",
  authedRoute({ params: IdParam }, async ({ db, params, userId }) => {
    const existing = await db
      .select({ id: conversationParticipants.id })
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, params.id),
          eq(conversationParticipants.userId, userId),
          isNull(conversationParticipants.leftAt),
        ),
      );
    if (existing.length === 0 || !existing[0]) {
      throw new ApiError(404, "not_found", "No active membership in this conversation.");
    }
    const now = new Date();
    await db
      .update(conversationParticipants)
      .set({ lastReadAt: now })
      .where(eq(conversationParticipants.id, existing[0].id));
    return { id: existing[0].id, conversationId: params.id, userId, lastReadAt: now };
  }),
);

// =============================================================================
// Messages — send / list / edit / soft-delete (messages is raw-SQL partitioned; no Drizzle table)
// =============================================================================

// POST /conversations/:id/messages — send. created_date_ist + created_at derive from one now() in a
// CTE so routing and the IST trigger agree (see header). RETURNING is safe (messages_select keys off
// conversation_participants, not messages). The messages_insert policy pins sender = auth.uid() and
// participant membership; a non-participant is denied (42501 → 403).
const SendMessageBody = z.object({ body: z.string().min(1).max(8000) });
router.post(
  "/conversations/:id/messages",
  authedRoute({ params: IdParam, body: SendMessageBody }, async ({ db, params, body, userId }) => {
    const id = uuidv7();
    const result = await db.execute(sql`
      WITH v(c_at) AS (SELECT now())
      INSERT INTO public.messages
        (id, created_date_ist, conversation_id, sender_user_id, body, created_at)
      SELECT ${id}::uuid,
             (v.c_at AT TIME ZONE 'Asia/Kolkata')::date,
             ${params.id}::uuid,
             ${userId}::uuid,
             ${body.body},
             v.c_at
        FROM v
      RETURNING id, created_date_ist, conversation_id, sender_user_id, body, edited_at, deleted_at, created_at
    `);
    return result.rows[0];
  }),
);

// GET /conversations/:id/messages — the thread's live (non-tombstoned) messages, newest-first.
// RLS scopes to participants; deleted_at IS NOT NULL rows are excluded at the app layer.
const ListMessagesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  before: z.string().datetime().optional(), // keyset: messages strictly older than this created_at
});
router.get(
  "/conversations/:id/messages",
  authedRoute({ params: IdParam, query: ListMessagesQuery }, async ({ db, params, query }) => {
    const beforeClause = query.before
      ? sql`AND created_at < ${query.before}::timestamptz`
      : sql``;
    const result = await db.execute(sql`
      SELECT id, created_date_ist, conversation_id, sender_user_id, body, edited_at, deleted_at, created_at
        FROM public.messages
       WHERE conversation_id = ${params.id}::uuid
         AND deleted_at IS NULL
         ${beforeClause}
       ORDER BY created_at DESC
       LIMIT ${query.limit}
    `);
    return result.rows;
  }),
);

// PATCH /messages/:id — edit body (sets edited_at). messages_update gates to the sender;
// tg_protect_sender guarantees only body/edited_at/deleted_at can change. A tombstoned message
// cannot be edited. 404 when the row is not the caller's / not found / already deleted.
const EditMessageBody = z.object({ body: z.string().min(1).max(8000) });
router.patch(
  "/messages/:id",
  authedRoute({ params: IdParam, body: EditMessageBody }, async ({ db, params, body }) => {
    const result = await db.execute(sql`
      UPDATE public.messages
         SET body = ${body.body}, edited_at = now()
       WHERE id = ${params.id}::uuid
         AND deleted_at IS NULL
      RETURNING id, created_date_ist, conversation_id, sender_user_id, body, edited_at, deleted_at, created_at
    `);
    if (result.rows.length === 0) {
      throw new ApiError(404, "not_found", "Message not found, not yours, or already deleted.");
    }
    return result.rows[0];
  }),
);

// DELETE /messages/:id — soft-delete (tombstone): set deleted_at and clear body. The row (and its
// authorship) is retained. messages_update gates to the sender. 404 when not the caller's / not found.
router.delete(
  "/messages/:id",
  authedRoute({ params: IdParam }, async ({ db, params }) => {
    const result = await db.execute(sql`
      UPDATE public.messages
         SET deleted_at = now(), body = NULL
       WHERE id = ${params.id}::uuid
         AND deleted_at IS NULL
      RETURNING id, created_date_ist, conversation_id, sender_user_id, deleted_at
    `);
    if (result.rows.length === 0) {
      throw new ApiError(404, "not_found", "Message not found, not yours, or already deleted.");
    }
    return result.rows[0];
  }),
);

export default router;
