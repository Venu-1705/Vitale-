-- =============================================================================
-- Vitalé — Post-companion 0115: supabase_realtime publication
-- Ground truth: VITALE_IMPLEMENTATION_SPEC Part 9 / VITALE_DB_ARCHITECTURE §8.
--
-- Creates the supabase_realtime publication covering ONLY the two messaging
-- tables (messages + notifications). Their monthly partitions are automatically
-- added to this publication by tg_harden_new_partition (0004) when each
-- partition's CREATE TABLE fires. No PHI, financial, audit, or consent table
-- is included — all other tables are intentionally excluded.
--
-- Apply order: after 0114 (lexical). Idempotent: DROP IF EXISTS before CREATE.
-- =============================================================================

-- Drop the publication if it exists so this script is re-runnable.
DROP PUBLICATION IF EXISTS supabase_realtime;

-- Create publication for the two non-partitioned messaging parent tables.
-- messages + notifications are PARTITION BY RANGE; Supabase/PG14+ requires
-- each partition to be added individually — tg_harden_new_partition (0004)
-- handles that automatically for every CREATE TABLE partition event.
CREATE PUBLICATION supabase_realtime FOR TABLE
  public.conversations,
  public.conversation_participants,
  public.message_attachments;

-- ============================================================================
-- NOTES
-- • Partition tables (messages_YYYY_MM, notifications_YYYY_MM) are NOT listed
--   here — tg_harden_new_partition adds them to the publication on CREATE.
-- • The parent partitioned tables (messages, notifications) themselves cannot
--   be directly added to a publication in PG14 (only their leaf partitions
--   can). The event trigger covers all future partitions.
-- • PHI fence: health_observations, nutrition_logs, lab_reports, care_plans,
--   clinical_notes, access_grants, coach_data_access_audit, billing tables,
--   dpdp_consent_records — none are in this publication.
-- =============================================================================
