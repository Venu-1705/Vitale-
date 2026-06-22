-- =============================================================================
-- Vitalé — Migration 0002: Enums (complete closed-set vocabulary)
-- Phase 1 (Database Foundations) · Implements VITALE_DB_ARCHITECTURE §3 verbatim
-- and VITALE_IMPLEMENTATION_SPEC Part 6 Phase 1 (0002_enums).
--
-- Policy (arch §2): Postgres ENUMs are used for STABLE closed sets only. EVOLVING sets
-- (badge_types, notification_types, lab_vendors) are LOOKUP TABLES (see 0003), because
-- Postgres cannot drop an enum value.
--
-- Blocker 3 note: community_memberships.status is implemented as a CHECK constraint
-- ('active' | 'left'), NOT a new enum, so this frozen enum list stays untouched.
-- Removed per freeze: friend_status, health_metric_type (DO NOT recreate).
--
-- Apply order: after 0001_extensions. Idempotent: each CREATE TYPE is wrapped so a
-- re-run is a no-op (catches duplicate_object).
-- =============================================================================

DO $$
BEGIN
  -- ----- Identity & org -----------------------------------------------------
  CREATE TYPE user_role            AS ENUM ('admin','coach','nutritionist','community_manager','customer');
  CREATE TYPE user_status          AS ENUM ('active','suspended','anonymized');
  CREATE TYPE gender               AS ENUM ('male','female','other','prefer_not_to_say');
  CREATE TYPE kyc_status           AS ENUM ('pending','verified','rejected');
  CREATE TYPE org_status           AS ENUM ('active','suspended','closed');
  CREATE TYPE member_role          AS ENUM ('owner_coach','nutritionist','community_manager'); -- no 'coach'
  CREATE TYPE member_status        AS ENUM ('invited','active','suspended','removed');
  CREATE TYPE invitation_status    AS ENUM ('pending','accepted','revoked','expired');
  CREATE TYPE coach_capability     AS ENUM (
      'view_client_health','manage_programs','manage_diet_charts','message_clients',
      'moderate_community','manage_staff','view_revenue','manage_lab_recommendations',
      'manage_products','write_clinical_notes','manage_care_plans');

  -- ----- Access control & DPDP ----------------------------------------------
  CREATE TYPE grant_data_category  AS ENUM ('health_data','meals','programs','lab_results','community','orders','messages','clinical');
  CREATE TYPE access_source_type   AS ENUM ('program_enrollment','diet_assignment','lab_review','care_plan','collaboration_agreement','manual_consent');
  CREATE TYPE grant_type           AS ENUM ('primary','collaborating');
  CREATE TYPE access_level         AS ENUM ('view_only','full');
  CREATE TYPE grant_status         AS ENUM ('active','revoked','expired');
  CREATE TYPE consent_type         AS ENUM ('data_processing','health_data_sharing','marketing','terms','coach_access','clinical_care');
  CREATE TYPE audit_acting_as      AS ENUM ('owner_coach','nutritionist','community_manager','collaborating_specialist','admin');
  -- audit_resource_type / audit_action: trailing values ('access_grant',
  -- 'member_permission' / 'grant','revoke') are an authorized ARCHITECTURE
  -- HARDENING CORRECTION so the access-control audit triggers can record
  -- grant/permission CHANGE events. Under the migrate-first pipeline the
  -- AUTHORITATIVE applier is migrations/post/0100_audit_enum_hardening.sql
  -- (ALTER TYPE ... ADD VALUE IF NOT EXISTS); these inline definitions are kept
  -- in parity for the raw-only path. See VITALE_DB_ARCHITECTURE.md §2.
  CREATE TYPE audit_resource_type  AS ENUM ('lab_report','health_observation','nutrition_log','program','diet_chart','care_plan','clinical_note','message','asset','profile','community','access_grant','member_permission');
  CREATE TYPE audit_action         AS ENUM ('view','export','update','download','grant','revoke');
  CREATE TYPE deletion_status      AS ENUM ('requested','processing','completed','rejected');
  CREATE TYPE support_reason_code  AS ENUM ('support_ticket','compliance_investigation','legal_request','fraud_review');
  CREATE TYPE support_approval_mode AS ENUM ('self','dual','break_glass');
  CREATE TYPE support_status       AS ENUM ('requested','active','expired','revoked');

  -- ----- Programs & nutrition -----------------------------------------------
  CREATE TYPE program_status       AS ENUM ('draft','published','archived');
  CREATE TYPE program_visibility   AS ENUM ('public','private','invite_only');
  CREATE TYPE session_content_type AS ENUM ('video','article','live','task');
  CREATE TYPE enrollment_status    AS ENUM ('active','completed','cancelled','expired');
  CREATE TYPE meal_type            AS ENUM ('breakfast','lunch','dinner','snack');
  CREATE TYPE diet_chart_status    AS ENUM ('draft','active','archived');
  CREATE TYPE assignment_status    AS ENUM ('active','paused','ended');
  CREATE TYPE nutrition_source     AS ENUM ('manual','diet_chart','recipe');
  CREATE TYPE food_source          AS ENUM ('system','coach','user');

  -- ----- Health (catalog + observations) ------------------------------------
  CREATE TYPE metric_category      AS ENUM ('vital','body_composition','activity','sleep','nutrition_derived','lab','wearable');
  CREATE TYPE metric_value_type    AS ENUM ('numeric','integer','boolean','enum');
  CREATE TYPE health_obs_source    AS ENUM ('manual','wearable','lab','coach_entered');

  -- ----- Gamification (badge kinds -> badge_types lookup, not an enum) -------
  CREATE TYPE streak_type          AS ENUM ('meal_logging','health_logging','program','overall');
  CREATE TYPE leaderboard_scope    AS ENUM ('program','platform');
  CREATE TYPE leaderboard_period   AS ENUM ('weekly','monthly','all_time');

  -- ----- Community ----------------------------------------------------------
  CREATE TYPE post_type            AS ENUM ('text','image','recipe','poll','announcement');
  CREATE TYPE post_status          AS ENUM ('active','hidden','removed');
  CREATE TYPE flag_reason          AS ENUM ('spam','abuse','misinformation','inappropriate','other');
  CREATE TYPE flag_status          AS ENUM ('open','reviewed','actioned','dismissed');

  -- ----- Messaging ----------------------------------------------------------
  CREATE TYPE conversation_type    AS ENUM ('coach_user','staff_user','care_team','community_peer');
  CREATE TYPE conversation_status  AS ENUM ('active','archived');

  -- ----- Clinical coaching --------------------------------------------------
  CREATE TYPE clinical_note_type   AS ENUM ('observation','assessment','progress_note','recommendation','addendum');
  CREATE TYPE note_visibility      AS ENUM ('internal','shared_with_user');
  CREATE TYPE clinical_author_role AS ENUM ('owner_coach','nutritionist','collaborating_specialist');
  CREATE TYPE intervention_status  AS ENUM ('active','completed','cancelled');
  CREATE TYPE outcome_status       AS ENUM ('on_track','achieved','missed','abandoned');

  -- ----- Assets -------------------------------------------------------------
  CREATE TYPE asset_type           AS ENUM ('lab_report_pdf','health_photo','message_attachment','profile_image','program_media','clinical_attachment','other');
  CREATE TYPE asset_status         AS ENUM ('active','deleted');

  -- ----- Subscriptions, payments, billing & compliance ----------------------
  CREATE TYPE billing_interval     AS ENUM ('monthly','yearly');
  CREATE TYPE limit_metric         AS ENUM ('staff_count','active_clients','program_count','diet_chart_count','monthly_revenue_paise','storage_mb');
  CREATE TYPE subscription_status  AS ENUM ('active','past_due','cancelled','paused');
  CREATE TYPE payment_status       AS ENUM ('created','authorized','captured','failed','refunded');
  CREATE TYPE revenue_split_status AS ENUM ('pending','processed','failed');
  CREATE TYPE webhook_provider     AS ENUM ('razorpay','lab_vendor');
  CREATE TYPE invoice_status       AS ENUM ('draft','issued','paid','cancelled');
  CREATE TYPE credit_note_status   AS ENUM ('issued','applied');
  CREATE TYPE refund_status        AS ENUM ('requested','processing','processed','failed');
  CREATE TYPE dispute_status       AS ENUM ('open','under_review','won','lost','accepted');
  CREATE TYPE payout_status        AS ENUM ('pending','processing','paid','failed');
  CREATE TYPE settlement_status    AS ENUM ('pending','reconciled','discrepancy');

  -- ----- Collaboration & care -----------------------------------------------
  CREATE TYPE collab_request_status   AS ENUM ('pending','accepted','declined','cancelled');
  CREATE TYPE collab_meeting_status   AS ENUM ('scheduled','completed','cancelled');
  CREATE TYPE collab_agreement_status AS ENUM ('active','ended');
  CREATE TYPE care_plan_status        AS ENUM ('active','completed','archived');
  CREATE TYPE care_team_role          AS ENUM ('lead','nutritionist','community_manager','collaborating_specialist');
  CREATE TYPE care_member_status      AS ENUM ('active','removed');

  -- ----- Notifications & lab (kinds & vendors -> lookup tables) --------------
  CREATE TYPE notification_priority AS ENUM ('low','normal','high');
  CREATE TYPE lab_booking_status    AS ENUM ('pending','booked','sample_collected','processing','reported','cancelled');
  CREATE TYPE lab_payment_status    AS ENUM ('pending','paid','refunded');
  CREATE TYPE lab_report_status     AS ENUM ('pending','ready');

EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'enum(s) already present — 0002_enums is idempotent, skipping creation.';
END $$;
