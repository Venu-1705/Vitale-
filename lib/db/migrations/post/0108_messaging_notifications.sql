-- =============================================================================
-- Vitalé — Post-table migration 0108: D13 Messaging + D10 Notifications — the two PARTITIONED
-- parents (messages, notifications), the conversation-creation basis gate, the composite FK from
-- message_attachments to the partitioned messages parent, and RLS/grants/policies/triggers for
-- all five communication tables (Phase 6). Implements VITALE_DB_ARCHITECTURE §4 D10 (lines
-- 493-501) + D13 (lines 524-539) + §5 detail (notifications line 473-474; conversations/messages/
-- attachments lines 551-561) + §7 RLS table (lines 672-673, 742-743) + §1.5 Realtime (lines
-- 91-102) + VITALE_IMPLEMENTATION_SPEC Part 6 Phase 6 (lines 1121-1124).
--
-- WHY RAW SQL (messages, notifications): both are [A, PARTITIONED] — Drizzle's pgTable cannot
-- express PARTITION BY RANGE (arch §6 line 613), and each PK is the composite (id,
-- created_date_ist). They are modelled for the app via Realtime channels + read paths, not a
-- Drizzle select. Their only Drizzle-owned FK targets (users, notification_types[0003],
-- conversations[messaging.ts]) all exist by the generate/migrate step, so the parents are
-- authored here, afterwards. The three NON-partitioned D13 tables (conversations,
-- conversation_participants, message_attachments) ARE Drizzle pgTables (messaging.ts) — this file
-- only adds their RLS/grants/policies/triggers + the composite FK that Drizzle cannot express.
--
-- ORDERING: POST-TABLE companion. Apply order:
--   1. `pnpm db:raw`        → foundation 0001-0006: 0003 notification_types (+seeds); 0004
--      tg_set_created_date_ist / tg_protect_sender / tg_touch_updated_at + the
--      vitale_harden_new_partition event trigger (already lists 'messages' AND 'notifications',
--      and auto-adds new partitions to supabase_realtime once that publication exists); 0005
--      shares_active_context / org_has_active_grant / is_org_member / has_capability; 0006
--      provision_partition_parent() (pg_partman registration + hardened template).
--   2. `pnpm generate && pnpm migrate` → Drizzle creates conversations / conversation_participants
--      / message_attachments (messaging.ts) + the FK targets users / coach_organizations / assets.
--   3. `pnpm db:raw:post`   → 0101..0107 → THIS file.
--
-- RLS POSTURE (NOT health-observations deny-all): messages/notifications are policy-gated for
-- `authenticated`, because Realtime authorization reuses the SAME RLS predicates — participant
-- match for messages, recipient match for notifications (§1.5 lines 93-95). The Phase-6 order
-- line (1123) tags them "REVOKE-API"; that means "clear the Supabase default grants + lock to
-- policy-gated authenticated access" (anon fully revoked; authenticated limited to specific DML
-- behind a policy), NOT the deny-all REVOKE of health_observations (0104). The §8 policy catalog
-- (lines 742-743) and per-table detail (lines 558, 474) are authoritative: messages SELECT/INSERT/
-- UPDATE = participant/sender; notifications SELECT/UPDATE(read flag) = recipient, INSERT =
-- service-role. NO ambient admin branch on any communication table (DPDP minimisation — admin
-- reach is via time-boxed admin_support_access + an RPC in Phase 8, never is_admin() here).
-- Child partitions are born locked (template + event trigger ENABLE+FORCE RLS, REVOKE anon/
-- authenticated); parent-routed queries are governed by the PARENT grants + policies (privilege
-- and RLS are evaluated on the table named in the query — the parent — not each partition).
--
-- DEFERRED to Phase 9 (Realtime): creation of the `supabase_realtime` publication with ONLY
-- messages, notifications (+ presence on conversations) and the partition-provision wiring that
-- ALTERs the publication for each new partition (spec line 1137-1138). The 0004 event trigger
-- already performs the per-partition ADD once the publication exists, so nothing here changes.
-- DEFERRED (not at launch): message_flags (DM abuse reporting) — arch line 541.
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS; CREATE OR REPLACE FUNCTION; DROP TRIGGER/POLICY
-- IF EXISTS before create; guarded ADD CONSTRAINT; provisioning helper is a no-op if registered.
-- =============================================================================

-- =============================================================================
-- SECTION 1 — messages [A, PARTITIONED]: chat. Editable + soft-deletable; authorship immutable.
-- Columns per arch §4 D13 (lines 533-537) + created_at (arch §2 universal column). body is
-- nullable to allow attachment-only messages and tombstone clears on soft-delete (deleted_at is
-- the authoritative tombstone marker; arch does not pin body NOT NULL).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id                uuid        NOT NULL,
  created_date_ist  date        NOT NULL,   -- partition key; set by trigger from created_at (IST)
  conversation_id   uuid        NOT NULL REFERENCES public.conversations(id),
  sender_user_id    uuid        NOT NULL REFERENCES public.users(id),  -- NEVER updated (tg_protect_sender)
  body              text,                   -- nullable: attachment-only messages / tombstone clear
  edited_at         timestamptz,            -- set on edit
  deleted_at        timestamptz,            -- soft delete → tombstone (row retained, authorship preserved)
  created_at        timestamptz NOT NULL DEFAULT now(),  -- source of created_date_ist
  PRIMARY KEY (id, created_date_ist)
) PARTITION BY RANGE (created_date_ist);

-- Lockdown FIRST (before provisioning creates partitions). FORCE RLS; REVOKE the Supabase
-- defaults; then re-GRANT the policy-gated DML to authenticated only (anon gets nothing). No
-- DELETE grant: deletion is the soft-delete UPDATE (deleted_at). The hardened pg_partman template
-- + vitale_harden_new_partition event trigger lock every child partition identically.
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages FORCE  ROW LEVEL SECURITY;
REVOKE ALL ON public.messages FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;  -- row/column scope via policy + tg_protect_sender

-- Partition-local read index (arch line 537; spec line 558): newest-first within a conversation.
-- Created on the parent → cascades to all current/future partitions (native partitioning).
CREATE INDEX IF NOT EXISTS messages_conversation_date_idx
  ON public.messages (conversation_id, created_date_ist DESC);

-- IST partition-key trigger (tg_set_created_date_ist from 0004): BEFORE INSERT OR UPDATE OF
-- created_at, sets created_date_ist = (COALESCE(created_at, now()) AT TIME ZONE 'Asia/Kolkata')::date.
-- BEFORE-ROW → runs before tuple routing, so callers need not supply the partition key.
DROP TRIGGER IF EXISTS messages_set_date_ist ON public.messages;
CREATE TRIGGER messages_set_date_ist
  BEFORE INSERT OR UPDATE OF created_at ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_created_date_ist();

-- Authorship immutability (tg_protect_sender from 0004): BEFORE UPDATE, blocks any change to
-- sender_user_id / conversation_id / created_at / created_date_ist → the sender may only mutate
-- body / edited_at / deleted_at. This is exactly the spec's "UPDATE sender, body/edited_at/
-- deleted_at only" column scope (line 742), enforced in the DB rather than via column grants.
DROP TRIGGER IF EXISTS messages_protect_sender ON public.messages;
CREATE TRIGGER messages_protect_sender
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_protect_sender();

-- Register with pg_partman (monthly): premake=2, infinite, RLS-forced / REVOKE-d template so
-- partitions inherit the lockdown. No-op if already registered.
SELECT public.provision_partition_parent('public.messages', 'created_date_ist', '1 month');

-- =============================================================================
-- SECTION 2 — notifications [A, PARTITIONED]: user-facing Realtime backbone. Columns per arch
-- §4 D10 (lines 497-501) + created_at. INSERT is service-role only (the DB enqueues; the worker
-- delivers — spec line 87); recipients only flip the read flag.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id                   uuid        NOT NULL,
  created_date_ist     date        NOT NULL,   -- partition key; set by trigger from created_at (IST)
  user_id              uuid        NOT NULL REFERENCES public.users(id),                 -- recipient
  notification_type_id uuid        NOT NULL REFERENCES public.notification_types(id),
  title                text        NOT NULL,
  body                 text,                   -- nullable: title-only notifications
  data                 jsonb       NOT NULL DEFAULT '{}'::jsonb,  -- deep-link / payload
  read                 boolean     NOT NULL DEFAULT false,
  read_at              timestamptz,
  priority             public.notification_priority NOT NULL DEFAULT 'normal',
  created_at           timestamptz NOT NULL DEFAULT now(),        -- source of created_date_ist
  PRIMARY KEY (id, created_date_ist)
) PARTITION BY RANGE (created_date_ist);

-- Lockdown FIRST. FORCE RLS; REVOKE Supabase defaults; GRANT SELECT to authenticated and a
-- COLUMN-level UPDATE on (read, read_at) ONLY — that is the declarative enforcement of
-- "UPDATE(read flag) = recipient" (spec line 474); the row scope is the policy below. No INSERT
-- grant: notifications are written by the service-role outbox path (BYPASSRLS), never PostgREST.
-- No DELETE grant: retention is by the partition-retention job.
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE  ROW LEVEL SECURITY;
REVOKE ALL ON public.notifications FROM anon, authenticated;
GRANT SELECT                ON public.notifications TO authenticated;
GRANT UPDATE (read, read_at) ON public.notifications TO authenticated;  -- read flag only

-- Partition-local read index (arch line 501; spec line 474): a recipient's unread, newest-first.
CREATE INDEX IF NOT EXISTS notifications_user_read_date_idx
  ON public.notifications (user_id, read, created_date_ist DESC);

-- IST partition-key trigger (tg_set_created_date_ist from 0004): as messages above.
DROP TRIGGER IF EXISTS notifications_set_date_ist ON public.notifications;
CREATE TRIGGER notifications_set_date_ist
  BEFORE INSERT OR UPDATE OF created_at ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_created_date_ist();

-- Register with pg_partman (monthly). No-op if already registered.
SELECT public.provision_partition_parent('public.notifications', 'created_date_ist', '1 month');

-- =============================================================================
-- SECTION 3 — message_attachments → messages composite FK (Drizzle cannot express a 2-col FK,
-- and messages is a raw partitioned parent). Added now that the messages parent exists. A FK on/
-- to a PARTITIONED parent cannot be NOT VALID; message_attachments is empty at build time, so a
-- plain ADD is instant. Guarded for idempotency.
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_attachments_message_fk') THEN
    ALTER TABLE public.message_attachments
      ADD CONSTRAINT message_attachments_message_fk
      FOREIGN KEY (message_id, message_created_date_ist)
      REFERENCES public.messages (id, created_date_ist);
  END IF;
END $$;

-- =============================================================================
-- SECTION 4 — Companion-local read/basis helpers. SECURITY DEFINER (owned by the migration role,
-- which has BYPASSRLS) so a policy that calls them does not re-trigger the referenced tables' RLS
-- (avoids recursion + lets a child read inherit the parent's visibility). Same posture as the
-- can_read_* helpers in 0106. All tables they read (conversation_participants, conversations,
-- messages) exist by Sections 1-3 / step 2, so no body-check disable is needed.
-- =============================================================================

-- caller is a CURRENT participant (left_at IS NULL) of the conversation. The basis of every
-- messaging read (conversations / messages / participant list).
CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation
      AND cp.user_id = auth.uid()
      AND cp.left_at IS NULL);
$$;

-- does the CALLER (auth.uid()) have a valid basis to open/join a conversation of this shape?
-- coach_user/staff_user/care_team: an active 'messages' access_grant for the subject AND the
-- coaching side can message clients (caller is an org member w/ message_clients, OR the caller IS
-- the subject — customer-initiated). community_peer: caller shares an active context (community
-- co-membership or program cohort) with the subject. Mirrors §8 line 743 + the spec line 526 gate.
CREATE OR REPLACE FUNCTION public.conversation_basis_ok(p_type public.conversation_type,
                                                        p_org uuid, p_subject uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT CASE
    WHEN p_type = 'community_peer' THEN
      p_subject IS NOT NULL AND public.shares_active_context(auth.uid(), p_subject)
    ELSE  -- coach_user / staff_user / care_team
      p_org IS NOT NULL AND p_subject IS NOT NULL
      AND public.org_has_active_grant(p_org, p_subject, 'messages')
      AND ( p_subject = auth.uid()                              -- customer-initiated
            OR public.is_org_member(p_org, 'message_clients') ) -- coach/staff-initiated
  END;
$$;

-- can the caller JOIN this existing conversation? (re-uses the creation basis against the stored
-- conversation shape — prevents a user adding themselves to an arbitrary conversation by id).
CREATE OR REPLACE FUNCTION public.can_join_conversation(p_conversation uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = p_conversation
      AND public.conversation_basis_ok(c.conversation_type, c.organization_id, c.subject_user_id));
$$;

-- can the caller READ a message (and therefore its attachments)? = participant of its conversation.
-- Looks the message up by its composite PK (the partition key avoids a cross-partition scan).
CREATE OR REPLACE FUNCTION public.can_read_message(p_message uuid, p_date date)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = p_message AND m.created_date_ist = p_date
      AND public.is_conversation_participant(m.conversation_id));
$$;

-- can the caller ATTACH to / manage attachments of a message? = the caller is its sender.
CREATE OR REPLACE FUNCTION public.can_attach_to_message(p_message uuid, p_date date)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = p_message AND m.created_date_ist = p_date
      AND m.sender_user_id = auth.uid());
$$;

GRANT EXECUTE ON FUNCTION
  public.is_conversation_participant(uuid),
  public.conversation_basis_ok(public.conversation_type, uuid, uuid),
  public.can_join_conversation(uuid),
  public.can_read_message(uuid, date),
  public.can_attach_to_message(uuid, date)
TO authenticated;

-- =============================================================================
-- SECTION 5 — tg_assert_conversation_basis: BEFORE INSERT on conversations, enforce the
-- creation precondition by conversation_type (arch line 552; spec line 1123). The authoritative
-- enforcer (fires for every role); the conversations_insert policy below mirrors it for the
-- PostgREST `authenticated` path. SECURITY DEFINER so the embedded grant/cap/context lookups see
-- past the referenced tables' RLS. A NULL auth.uid() (service-role / system seeding — e.g. the
-- create-conversation RPC inserting the conversation + both participant rows in one tx) is trusted
-- and skips the check, matching service_role's BYPASSRLS posture.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.tg_assert_conversation_basis() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;  -- service-role / system context: trusted (RPC already validated the basis)
  END IF;
  IF NOT public.conversation_basis_ok(NEW.conversation_type, NEW.organization_id, NEW.subject_user_id) THEN
    RAISE EXCEPTION 'conversation creation denied: % requires %',
      NEW.conversation_type,
      CASE WHEN NEW.conversation_type = 'community_peer'
           THEN 'a shared active context (community co-membership or program cohort) with the subject'
           ELSE 'an active messages grant for the subject + message_clients capability (or customer self-initiation)'
      END
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

-- =============================================================================
-- SECTION 6 — Non-partitioned table RLS enable/FORCE + trigger attachments. (The three tables
-- themselves are Drizzle-owned, created in step 2; messages/notifications were enabled inline in
-- Sections 1-2.) All three are RLS-FORCE (spec lines 552/555/560).
-- =============================================================================
ALTER TABLE public.conversations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations            FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments      FORCE  ROW LEVEL SECURITY;

-- conversations: touch updated_at + assert the creation basis.
DROP TRIGGER IF EXISTS conversations_touch ON public.conversations;
CREATE TRIGGER conversations_touch BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS conversations_assert_basis ON public.conversations;
CREATE TRIGGER conversations_assert_basis BEFORE INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.tg_assert_conversation_basis();

-- =============================================================================
-- SECTION 7 — Grants for the three non-partitioned tables (REVOKE Supabase defaults; re-grant the
-- policy-gated DML to authenticated only). No DELETE on conversations (archive via status) or
-- conversation_participants (leave via left_at); message_attachments gets DELETE (the sender may
-- remove an attachment from their own message).
-- =============================================================================
REVOKE ALL ON public.conversations            FROM anon, authenticated;
REVOKE ALL ON public.conversation_participants FROM anon, authenticated;
REVOKE ALL ON public.message_attachments      FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.conversations            TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.conversation_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_attachments      TO authenticated;

-- =============================================================================
-- SECTION 8 — Policies (TO authenticated; no anon, no ambient admin — DPDP minimisation). DROP
-- IF EXISTS first for idempotency.
-- =============================================================================

-- conversations: participants read; creation gated by the basis (mirrors tg_assert_conversation_basis);
-- participants may update (e.g. archive via status).
DROP POLICY IF EXISTS conversations_select ON public.conversations;
CREATE POLICY conversations_select ON public.conversations FOR SELECT TO authenticated
  USING (public.is_conversation_participant(id));
DROP POLICY IF EXISTS conversations_insert ON public.conversations;
CREATE POLICY conversations_insert ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (public.conversation_basis_ok(conversation_type, organization_id, subject_user_id));
DROP POLICY IF EXISTS conversations_update ON public.conversations;
CREATE POLICY conversations_update ON public.conversations FOR UPDATE TO authenticated
  USING (public.is_conversation_participant(id))
  WITH CHECK (public.is_conversation_participant(id));

-- conversation_participants: members read the roster. INSERT = an existing member adds someone,
-- OR a user adds THEMSELVES to a conversation whose basis they satisfy (self-join for peer/care).
-- UPDATE = a member maintains their OWN row (last_read_at; left_at to leave).
DROP POLICY IF EXISTS conversation_participants_select ON public.conversation_participants;
CREATE POLICY conversation_participants_select ON public.conversation_participants FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id));
DROP POLICY IF EXISTS conversation_participants_insert ON public.conversation_participants;
CREATE POLICY conversation_participants_insert ON public.conversation_participants FOR INSERT TO authenticated
  WITH CHECK ( public.is_conversation_participant(conversation_id)
               OR (user_id = auth.uid() AND public.can_join_conversation(conversation_id)) );
DROP POLICY IF EXISTS conversation_participants_update ON public.conversation_participants;
CREATE POLICY conversation_participants_update ON public.conversation_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- messages: active participants read; a participant inserts as themselves; the sender edits
-- (column scope via tg_protect_sender → body/edited_at/deleted_at only). No DELETE (soft-delete).
DROP POLICY IF EXISTS messages_select ON public.messages;
CREATE POLICY messages_select ON public.messages FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id));
DROP POLICY IF EXISTS messages_insert ON public.messages;
CREATE POLICY messages_insert ON public.messages FOR INSERT TO authenticated
  WITH CHECK ( sender_user_id = auth.uid()
               AND public.is_conversation_participant(conversation_id) );
DROP POLICY IF EXISTS messages_update ON public.messages;
CREATE POLICY messages_update ON public.messages FOR UPDATE TO authenticated
  USING (sender_user_id = auth.uid()) WITH CHECK (sender_user_id = auth.uid());

-- message_attachments: read via the parent message (participant); the sender manages attachments.
DROP POLICY IF EXISTS message_attachments_select ON public.message_attachments;
CREATE POLICY message_attachments_select ON public.message_attachments FOR SELECT TO authenticated
  USING (public.can_read_message(message_id, message_created_date_ist));
DROP POLICY IF EXISTS message_attachments_insert ON public.message_attachments;
CREATE POLICY message_attachments_insert ON public.message_attachments FOR INSERT TO authenticated
  WITH CHECK (public.can_attach_to_message(message_id, message_created_date_ist));
DROP POLICY IF EXISTS message_attachments_update ON public.message_attachments;
CREATE POLICY message_attachments_update ON public.message_attachments FOR UPDATE TO authenticated
  USING (public.can_attach_to_message(message_id, message_created_date_ist))
  WITH CHECK (public.can_attach_to_message(message_id, message_created_date_ist));
DROP POLICY IF EXISTS message_attachments_delete ON public.message_attachments;
CREATE POLICY message_attachments_delete ON public.message_attachments FOR DELETE TO authenticated
  USING (public.can_attach_to_message(message_id, message_created_date_ist));

-- notifications: recipient reads own; recipient flips the read flag (column scope via the
-- GRANT UPDATE (read, read_at) above). INSERT is service-role only → no authenticated INSERT
-- policy. No DELETE (partition-retention job).
DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS notifications_update ON public.notifications;
CREATE POLICY notifications_update ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- DEFERRED to Phase 9 (Realtime — spec lines 1136-1138): create the supabase_realtime publication
-- with ONLY messages, notifications (+ presence on conversations); thereafter the 0004
-- vitale_harden_new_partition event trigger ALTERs the publication to ADD each new monthly
-- partition automatically (it already no-ops gracefully until the publication exists). Configure
-- Realtime authorization to reuse these RLS predicates; channel naming conv:<id> / user:<id>.
--   CREATE PUBLICATION supabase_realtime FOR TABLE public.messages, public.notifications;
--   -- (+ presence on conversations per the Realtime design)
--
-- DEFERRED (not at launch — arch line 541): message_flags (DM abuse reporting); ships only if open
-- peer DMs warrant it (community already has post_flags).
-- =============================================================================
