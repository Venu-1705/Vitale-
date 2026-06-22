-- =============================================================================
-- Vitalé — Post-table migration 0136: D10 Notifications — the notifications PARTITIONED parent,
-- its lockdown/index/trigger/policies, and the catalog read-grant for the notification_types
-- lookup. Carved from the combined 0108_messaging_notifications.sql (Sections 2 + 8 notifications
-- half), exactly as 0135 carved the messages half. Implements VITALE_DB_ARCHITECTURE §4 D10
-- (lines 497-501) + §5 (notifications line 473-474) + §7 RLS table + §8 policy catalog (line 474).
--
-- WHY A SEPARATE COMPANION (the no-pg_partman remediation — same as 0131/0134/0135):
--   0108 line 149 calls `provision_partition_parent('public.notifications', …)`, a Supabase/
--   pg_partman-only routine ABSENT on the local EDB binaries. This file instead creates the
--   partitioned parent + EXPLICIT monthly partitions; each `CREATE TABLE … PARTITION OF` fires the
--   live `vitale_harden_new_partition` event trigger (ddl_command_end) which ENABLE+FORCE RLS and
--   REVOKE anon/authenticated on every child. Behaviourally identical to the Supabase deployment
--   for the partitions in range. pg_partman is NOT installed.
--
-- RLS POSTURE (policy-gated, NOT deny-all): notifications are SELECT-grantable to `authenticated`
--   and gated by a recipient-match policy (user_id = auth.uid()); a column-level UPDATE (read,
--   read_at) lets the recipient flip ONLY the read flag. NO INSERT grant — notifications are written
--   by the service-role outbox path (BYPASSRLS), never by an authenticated client. NO DELETE grant —
--   retention is by the partition-retention job. So a recipient reads their OWN notifications via a
--   direct SELECT (no audited RPC: this is the subject's own data, not cross-user PHI).
--
-- DEPENDENCIES (all verified live before authoring): notification_priority enum (0002); users;
--   notification_types (0003 — applied as a scoped subset, badge_types/lab_vendors excluded);
--   tg_set_created_date_ist (0004); vitale_harden_new_partition event trigger (0004).
--
-- DEFERRED (not in this phase): the message→notification fan-out worker/trigger; push delivery
--   (FCM/APNs, external); Realtime publication/transport (the 0004 event trigger already ADDs each
--   new partition to supabase_realtime once that publication exists — nothing here changes).
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS; DROP TRIGGER/POLICY IF EXISTS before create;
--   partitions guarded IF NOT EXISTS; grants are declarative. Re-runnable, no forward references.
-- =============================================================================
\set ON_ERROR_STOP on

-- =============================================================================
-- SECTION 0 — notification_types catalog read-grant. 0003 authors NO RLS/grants for the lookup
-- tables (controlled vocabularies); on Supabase they inherit anon/authenticated SELECT via default
-- privileges, but this self-hosted clone has no such default, so notification_types landed
-- owner/service-role-only. Restore the intended public-catalog read posture explicitly (parity
-- with the other read catalogs, e.g. metric_definitions: anon + authenticated SELECT). Writes stay
-- owner/service-role only (no write grant) — the vocabulary evolves via admin tooling.
-- =============================================================================
GRANT SELECT ON public.notification_types TO anon, authenticated;

-- =============================================================================
-- SECTION 1 — notifications [A, PARTITIONED]: user-facing notification backbone. Columns per arch
-- §4 D10 (lines 497-501) + created_at. INSERT is service-role only (the DB enqueues; the worker
-- delivers); recipients only flip the read flag. body nullable (title-only notifications).
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

-- Lockdown FIRST (before partitions are created). FORCE RLS; REVOKE Supabase defaults; then GRANT
-- SELECT to authenticated and a COLUMN-level UPDATE on (read, read_at) ONLY — the declarative
-- enforcement of "UPDATE(read flag) = recipient" (spec line 474); row scope is the policy below.
-- No INSERT grant (service-role outbox). No DELETE grant (partition-retention job).
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE  ROW LEVEL SECURITY;
REVOKE ALL ON public.notifications FROM anon, authenticated;
GRANT SELECT                 ON public.notifications TO authenticated;
GRANT UPDATE (read, read_at) ON public.notifications TO authenticated;  -- read flag only

-- Partition-local read index (arch line 501; spec line 474): a recipient's unread, newest-first.
-- Created on the parent → cascades to all current/future partitions (native partitioning).
CREATE INDEX IF NOT EXISTS notifications_user_read_date_idx
  ON public.notifications (user_id, read, created_date_ist DESC);

-- IST partition-key trigger (tg_set_created_date_ist from 0004): BEFORE INSERT OR UPDATE OF
-- created_at, sets created_date_ist = (COALESCE(created_at, now()) AT TIME ZONE 'Asia/Kolkata')::date.
-- BEFORE-ROW → runs before tuple routing. (The service-role enqueue path also supplies the key
-- explicitly to dodge the partition-routing-vs-BEFORE-trigger trap — see Defect D5-1.)
DROP TRIGGER IF EXISTS notifications_set_date_ist ON public.notifications;
CREATE TRIGGER notifications_set_date_ist
  BEFORE INSERT OR UPDATE OF created_at ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_created_date_ist();

-- =============================================================================
-- SECTION 2 — EXPLICIT monthly partitions (the no-pg_partman adaptation). 2025 full-year, 2026
-- monthly, 2027 full-year, plus DEFAULT = 15 children. Each CREATE … PARTITION OF fires
-- vitale_harden_new_partition (ENABLE+FORCE RLS + REVOKE anon/authenticated on the child). Window
-- chosen identically to messages (0135) / nutrition_logs (0134) / health_observations (0131).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notifications_2025 PARTITION OF public.notifications
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE IF NOT EXISTS public.notifications_2026_01 PARTITION OF public.notifications
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE IF NOT EXISTS public.notifications_2026_02 PARTITION OF public.notifications
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE IF NOT EXISTS public.notifications_2026_03 PARTITION OF public.notifications
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE IF NOT EXISTS public.notifications_2026_04 PARTITION OF public.notifications
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS public.notifications_2026_05 PARTITION OF public.notifications
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS public.notifications_2026_06 PARTITION OF public.notifications
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS public.notifications_2026_07 PARTITION OF public.notifications
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS public.notifications_2026_08 PARTITION OF public.notifications
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS public.notifications_2026_09 PARTITION OF public.notifications
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS public.notifications_2026_10 PARTITION OF public.notifications
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS public.notifications_2026_11 PARTITION OF public.notifications
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS public.notifications_2026_12 PARTITION OF public.notifications
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE IF NOT EXISTS public.notifications_2027 PARTITION OF public.notifications
  FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');
CREATE TABLE IF NOT EXISTS public.notifications_default PARTITION OF public.notifications DEFAULT;

-- =============================================================================
-- SECTION 3 — Policies (TO authenticated; no anon, no ambient admin — DPDP minimisation). The
-- recipient reads own; the recipient flips the read flag (column scope via the GRANT UPDATE
-- (read, read_at) above). INSERT is service-role only → no authenticated INSERT policy. No DELETE.
-- =============================================================================
DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS notifications_update ON public.notifications;
CREATE POLICY notifications_update ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
