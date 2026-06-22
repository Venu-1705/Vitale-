// =============================================================================
// Vitalé — D13 Messaging (Phase 6)
// Ground truth: VITALE_DB_ARCHITECTURE §4 D13 (lines 524-539) + §5 detail (lines 551-561) +
// VITALE_IMPLEMENTATION_SPEC Part 2 D13 (lines 551-561) + Part 6 Phase 6 order (line 1123:
// conversations → conversation_participants → messages [partitioned] → message_attachments →
// notification_types → notifications [partitioned]).
//
// This module owns the THREE non-partitioned D13 tables (conversations,
// conversation_participants, message_attachments) + their drizzle-zod validators. The two
// PARTITIONED tables of this phase live in the raw post-companion 0108 ONLY, because Drizzle's
// pgTable cannot express PARTITION BY RANGE or the composite PK (id, created_date_ist):
//   • messages       [A, PARTITIONED] — PK (id, created_date_ist), REVOKE-API, +tg_protect_sender, IST setter
//   • notifications  [A, PARTITIONED] — PK (id, created_date_ist), recipient-scoped, IST setter
//
// RLS, grants, and behavioral triggers for the tables below live in the raw companion 0108:
//   • tg_touch_updated_at (0004) on conversations
//   • tg_assert_conversation_basis (NEW, 0108) on conversations — BEFORE INSERT: enforce the
//     creation precondition by conversation_type (grant + message_clients for coach/staff/care;
//     shares_active_context for community_peer).
//
// COMPOSITE FK — message_attachments → messages(id, created_date_ist):
// messageId + messageCreatedDateIst are modeled here as PLAIN columns with NO Drizzle
// .references(), because (a) the target messages table is raw-SQL (not a Drizzle pgTable) and
// (b) Drizzle cannot express a two-column FK inline. The composite FK constraint is added in
// 0108 (Blocker-style guarded DO block), validated as PG12+ supported (arch §6 line 612).
// =============================================================================
import { sql } from "drizzle-orm";
import { date, index, integer, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { pkV7, timestamps } from "./_shared";
import { assets } from "./assets";
import { conversationStatus, conversationType } from "./enums";
import { users } from "./identity";
import { coachOrganizations } from "./organizations";

// conversations — a messaging thread. organization_id is nullable ONLY for pure peer
// (community_peer) threads; coach/staff/care threads are org-scoped. subject_user_id is the
// customer in coach/care contexts (nullable for peer). Creation is gated by
// tg_assert_conversation_basis (raw 0108): coach/staff/care_team need an active access_grant +
// message_clients capability; community_peer needs shares_active_context. [C]
export const conversations = pgTable(
  "conversations",
  {
    id: pkV7(),
    organizationId: uuid("organization_id").references(() => coachOrganizations.id), // nullable: pure-peer threads have no org
    conversationType: conversationType("conversation_type").notNull(),
    subjectUserId: uuid("subject_user_id").references(() => users.id), // nullable: the customer for coach/care contexts
    status: conversationStatus("status").notNull().default("active"), // lifecycle entry = active
    ...timestamps,
  },
  (t) => [
    index("conversations_org_idx").on(t.organizationId),
    index("conversations_subject_user_idx").on(t.subjectUserId),
  ],
);

// conversation_participants — membership of a conversation. last_read_at drives unread counts;
// left_at tombstones a departure (the partial-unique index allows re-joining after leaving).
// No tg_touch_updated_at (spec lists no triggers) → joined_at/left_at/last_read_at are the
// lifecycle columns, no updated_at.
export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    id: pkV7(),
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }), // nullable: NULL = currently a member
    lastReadAt: timestamp("last_read_at", { withTimezone: true }), // nullable: drives unread counts
  },
  (t) => [
    // partial-unique: at most ONE active membership per (conversation, user); re-join allowed after leaving.
    uniqueIndex("conversation_participants_active_key").on(t.conversationId, t.userId).where(sql`${t.leftAt} IS NULL`),
  ],
);

// message_attachments — files attached to a (partitioned) message. The composite FK to
// messages(id, created_date_ist) is added in raw 0108 (Drizzle cannot express a 2-col FK, and
// messages is a raw-SQL partitioned parent). message_id + message_created_date_ist are plain
// columns here; together they target the parent's composite PK.
export const messageAttachments = pgTable(
  "message_attachments",
  {
    id: pkV7(),
    messageId: uuid("message_id").notNull(), // composite FK part 1 → messages.id (added raw, 0108)
    messageCreatedDateIst: date("message_created_date_ist").notNull(), // composite FK part 2 → messages.created_date_ist
    assetId: uuid("asset_id").notNull().references(() => assets.id),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    index("message_attachments_message_idx").on(t.messageId, t.messageCreatedDateIst),
    index("message_attachments_asset_idx").on(t.assetId),
  ],
);

// ----- drizzle-zod validators (arch §11) -------------------------------------
export const insertConversationSchema = createInsertSchema(conversations);
export const selectConversationSchema = createSelectSchema(conversations);
export const insertConversationParticipantSchema = createInsertSchema(conversationParticipants);
export const selectConversationParticipantSchema = createSelectSchema(conversationParticipants);
export const insertMessageAttachmentSchema = createInsertSchema(messageAttachments);
export const selectMessageAttachmentSchema = createSelectSchema(messageAttachments);
