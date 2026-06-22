-- =============================================================================
-- Vitalé — Post-companion 0135: D13 Messaging — the `messages` PARTITIONED parent (no pg_partman),
-- the conversation-creation basis gate, the composite FK from message_attachments to messages, and
-- RLS/grants/policies/triggers for all four messaging tables (conversations, conversation_participants,
-- messages, message_attachments). Implements VITALE_DB_ARCHITECTURE §4 D13 (lines 524-539) + §5
-- detail (conversations/messages/attachments lines 551-561) + §7 RLS table (lines 693-694, 742-743)
-- + VITALE_IMPLEMENTATION_SPEC Part 6 Phase 6 (lines 1121-1124). Frozen Decision #10: messages are
-- editable + soft-deletable; authorship (sender_user_id) immutable.
--
-- GROUND TRUTH — this is the messages-only, no-pg_partman remediation of 0108. It carries forward
-- 0108's messaging sections VERBATIM in intent, with TWO deliberate departures (approved Decision A + B):
--   A. NO pg_partman. This EDB-binary cluster has no pg_partman, so 0108's
--      provision_partition_parent('public.messages', …) call is ABSENT here. Instead — exactly as
--      0131 (health_observations) and 0134 (nutrition_logs) do — the parent is created and EXPLICIT
--      monthly partitions are laid down. Each CREATE TABLE … PARTITION OF fires the always-on
--      vitale_harden_new_partition event trigger (0004), which ENABLE+FORCE RLS + REVOKE anon/
--      authenticated on every child, so partitions inherit the parent lockdown. (The event trigger
--      allowlist already lists 'messages'; it also no-ops the supabase_realtime ADD until that
--      publication exists — Phase 9.)
--   B. NO D10 notifications. 0108's notifications parent + policies are DEFERRED to a dedicated D10
--      phase: notifications is a service-role outbox (no user-facing API), and its FK to
--      notification_types (0003, unapplied here) would otherwise halt application. Nothing in THIS
--      file references notification_types, notification_priority, or notifications.
--
-- WHY RAW SQL (messages): [A, PARTITIONED] — Drizzle's pgTable cannot express PARTITION BY RANGE
-- (arch §6 line 613) nor the composite PK (id, created_date_ist). The three NON-partitioned D13
-- tables (conversations, conversation_participants, message_attachments) ARE Drizzle pgTables
-- (messaging.ts); this file only adds their RLS/grants/policies/triggers + the composite FK that
-- Drizzle cannot express.
--
-- RLS POSTURE (NOT health-observations deny-all): messages are policy-gated for `authenticated`
-- (participant match for SELECT/INSERT; sender for UPDATE), because Realtime authorization reuses
-- the SAME RLS predicates (§1.5). "REVOKE-API" here = clear Supabase default grants + lock to
-- policy-gated authenticated DML (anon fully revoked), NOT the deny-all REVOKE of health_observations.
-- NO ambient admin branch on any messaging table (DPDP minimisation).
--
-- DEPENDENCIES (all verified present on this cluster before authoring):
--   tg_set_created_date_ist / tg_protect_sender / tg_touch_updated_at (0004); vitale_harden_new_partition
--   event trigger (0004, allowlist includes 'messages'); shares_active_context / org_has_active_grant /
--   is_org_member (0005); enums conversation_type / conversation_status, grant_data_category('messages'),
--   coach_capability('message_clients'); tables users / coach_organizations / assets / conversations /
--   conversation_participants / message_attachments (Drizzle). auth.uid() shim.
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS; CREATE OR REPLACE FUNCTION; DROP TRIGGER/POLICY IF
-- EXISTS before create; guarded ADD CONSTRAINT.
-- =============================================================================

-- =============================================================================
-- SECTION 1 — messages [A, PARTITIONED]: chat. Editable + soft-deletable; authorship immutable.
-- Columns per arch §4 D13 (lines 533-537) + created_at (§2 universal). body nullable to allow
-- attachment-only messages and tombstone clears on soft-delete (deleted_at is the tombstone marker).
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

-- Lockdown FIRST (before partitions are created). FORCE RLS; REVOKE Supabase defaults; re-GRANT the
-- policy-gated DML to authenticated only (anon gets nothing). No DELETE grant: deletion is the
-- soft-delete UPDATE (deleted_at). Children are auto-hardened identically by the event trigger.
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages FORCE  ROW LEVEL SECURITY;
REVOKE ALL ON public.messages FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;  -- row/column scope via policy + tg_protect_sender

-- Partition-local read index (arch line 537; spec line 558): newest-first within a conversation.
-- Created on the parent → cascades to all current/future partitions (native partitioning).
CREATE INDEX IF NOT EXISTS messages_conversation_date_idx
  ON public.messages (conversation_id, created_date_ist DESC);

-- IST partition-key trigger (tg_set_created_date_ist from 0004): BEFORE INSERT OR UPDATE OF created_at,
-- sets created_date_ist from created_at in Asia/Kolkata. BEFORE-ROW → runs before tuple routing, so
-- callers need not supply the partition key.
DROP TRIGGER IF EXISTS messages_set_date_ist ON public.messages;
CREATE TRIGGER messages_set_date_ist
  BEFORE INSERT OR UPDATE OF created_at ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_created_date_ist();

-- Authorship immutability (tg_protect_sender from 0004): BEFORE UPDATE, blocks any change to
-- sender_user_id / conversation_id / created_at / created_date_ist → the sender may only mutate
-- body / edited_at / deleted_at. This is the spec's "UPDATE sender, body/edited_at/deleted_at only"
-- column scope (line 742), enforced in the DB rather than via column grants.
DROP TRIGGER IF EXISTS messages_protect_sender ON public.messages;
CREATE TRIGGER messages_protect_sender
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_protect_sender();

-- -----------------------------------------------------------------------------
-- Explicit monthly partitions (NO pg_partman — Decision A). Mirrors 0131/0134: a full-year 2025
-- partition, twelve monthly 2026 partitions (the operating year), a full-year 2027 partition, and a
-- DEFAULT backstop so no INSERT can ever fail to route. Each CREATE … PARTITION OF fires
-- vitale_harden_new_partition (0004) → per-child ENABLE+FORCE RLS + REVOKE anon/authenticated.
-- The pg_cron partition-maintenance job (0116) rolls new months forward; this seed covers launch.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages_2025
  PARTITION OF public.messages FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE IF NOT EXISTS public.messages_2026_01
  PARTITION OF public.messages FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE IF NOT EXISTS public.messages_2026_02
  PARTITION OF public.messages FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE IF NOT EXISTS public.messages_2026_03
  PARTITION OF public.messages FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE IF NOT EXISTS public.messages_2026_04
  PARTITION OF public.messages FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS public.messages_2026_05
  PARTITION OF public.messages FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS public.messages_2026_06
  PARTITION OF public.messages FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS public.messages_2026_07
  PARTITION OF public.messages FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS public.messages_2026_08
  PARTITION OF public.messages FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS public.messages_2026_09
  PARTITION OF public.messages FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS public.messages_2026_10
  PARTITION OF public.messages FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS public.messages_2026_11
  PARTITION OF public.messages FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS public.messages_2026_12
  PARTITION OF public.messages FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE IF NOT EXISTS public.messages_2027
  PARTITION OF public.messages FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');
CREATE TABLE IF NOT EXISTS public.messages_default
  PARTITION OF public.messages DEFAULT;

-- =============================================================================
-- SECTION 2 — message_attachments → messages composite FK (Drizzle cannot express a 2-col FK, and
-- messages is a raw partitioned parent). Added now that the messages parent exists. A FK to a
-- PARTITIONED parent cannot be NOT VALID; message_attachments is empty at build time, so a plain ADD
-- is instant. Guarded for idempotency. (NOTE: the attachments DATA layer is built here for schema
-- coherence; the attachment-linking API is DEFERRED until D15 assets have a secured creation path.)
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
-- SECTION 3 — Companion-local read/basis helpers. SECURITY DEFINER (owned by the migration role,
-- which has BYPASSRLS) so a policy that calls them does not re-trigger the referenced tables' RLS
-- (avoids recursion + lets a child read inherit the parent's visibility). All tables they read
-- (conversation_participants, conversations, messages) exist by Sections 1-2 / Drizzle.
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
-- coach_user/staff_user/care_team: an active 'messages' access_grant for the subject AND the coaching
-- side can message clients (caller is an org member w/ message_clients, OR the caller IS the subject —
-- customer-initiated). community_peer: caller shares an active context (community co-membership or
-- program cohort) with the subject. Mirrors §8 line 743 + spec line 526 gate.
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
-- SECTION 4 — tg_assert_conversation_basis: BEFORE INSERT on conversations, enforce the creation
-- precondition by conversation_type (arch line 552; spec line 1123). The authoritative enforcer
-- (fires for every role); the conversations_insert policy below mirrors it for the PostgREST
-- `authenticated` path. SECURITY DEFINER so the embedded grant/cap/context lookups see past the
-- referenced tables' RLS. A NULL auth.uid() (service-role / system seeding) is trusted and skips the
-- check, matching service_role's BYPASSRLS posture.
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
-- SECTION 5 — Non-partitioned table RLS enable/FORCE + trigger attachments. (The three tables
-- themselves are Drizzle-owned; messages was enabled inline in Section 1.) All three are RLS-FORCE
-- (spec lines 552/555/560).
-- =============================================================================
ALTER TABLE public.conversations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations             FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments       FORCE  ROW LEVEL SECURITY;

-- conversations: touch updated_at + assert the creation basis.
DROP TRIGGER IF EXISTS conversations_touch ON public.conversations;
CREATE TRIGGER conversations_touch BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS conversations_assert_basis ON public.conversations;
CREATE TRIGGER conversations_assert_basis BEFORE INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.tg_assert_conversation_basis();

-- =============================================================================
-- SECTION 6 — Grants for the three non-partitioned tables (REVOKE Supabase defaults; re-grant the
-- policy-gated DML to authenticated only). No DELETE on conversations (archive via status) or
-- conversation_participants (leave via left_at); message_attachments gets DELETE (the sender may
-- remove an attachment from their own message).
-- =============================================================================
REVOKE ALL ON public.conversations             FROM anon, authenticated;
REVOKE ALL ON public.conversation_participants FROM anon, authenticated;
REVOKE ALL ON public.message_attachments       FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.conversations             TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.conversation_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_attachments       TO authenticated;

-- =============================================================================
-- SECTION 7 — Policies (TO authenticated; no anon, no ambient admin — DPDP minimisation). DROP IF
-- EXISTS first for idempotency.
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

-- conversation_participants: members read the roster. INSERT = an existing member adds someone, OR a
-- user adds THEMSELVES to a conversation whose basis they satisfy (self-join for peer/care). UPDATE =
-- a member maintains their OWN row (last_read_at; left_at to leave).
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

-- messages: active participants read; a participant inserts as themselves; the sender edits (column
-- scope via tg_protect_sender → body/edited_at/deleted_at only). No DELETE (soft-delete).
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

-- =============================================================================
-- DEFERRED (Decision B / Phase 9):
--   • D10 notifications parent + policies (service-role outbox; needs notification_types/0003) — a
--     dedicated D10 phase, NOT here.
--   • supabase_realtime publication for messages (+ presence on conversations); the 0004
--     vitale_harden_new_partition event trigger already ADDs each new partition once it exists.
--   • message_attachments API linking — until D15 assets are secured + have a creation path.
--   • message_flags (DM abuse reporting — arch line 541).
-- =============================================================================
