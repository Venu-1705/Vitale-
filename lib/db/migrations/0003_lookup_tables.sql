-- =============================================================================
-- Vitalé — Migration 0003: Lookup tables (evolving controlled vocabularies)
-- Phase 1 (Database Foundations) · Implements VITALE_DB_ARCHITECTURE §2 (evolving sets
-- are tables, not enums), §D6/§D10/§D11, and VITALE_IMPLEMENTATION_SPEC Part 6 Phase 1.
--
-- These three are TABLES (not enums) because their value sets evolve and Postgres cannot
-- drop enum values: badge_types, notification_types, lab_vendors.
--
-- Apply order: after 0002_enums. Idempotent: CREATE TABLE IF NOT EXISTS + ON CONFLICT seeds.
-- Cross-table FKs that target not-yet-created tables (e.g. badge_types.icon_asset_id ->
-- assets, built in Phase 3) are added in a later migration; the column is created here
-- without the constraint so this file applies standalone.
-- =============================================================================

-- ----- badge_types (D6) ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.badge_types (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- app may supply UUIDv7; default is convenience for SQL seeds
  key           text NOT NULL UNIQUE,
  name          text NOT NULL,
  description   text,
  icon_asset_id uuid,                                        -- FK -> assets added in Phase 3 (assets not yet created)
  criteria      jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ----- notification_types (D10) ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_types (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key              text NOT NULL UNIQUE,
  name             text NOT NULL,
  default_priority notification_priority NOT NULL DEFAULT 'normal',
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ----- lab_vendors (D11) — de-vendors Labs ----------------------------------
CREATE TABLE IF NOT EXISTS public.lab_vendors (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text NOT NULL UNIQUE,
  name       text NOT NULL,
  config     jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ----- Minimal seeds (illustrative; expand via admin tooling) ----------------
INSERT INTO public.notification_types (key, name, default_priority) VALUES
  ('enrollment_confirmed', 'Program enrollment confirmed', 'normal'),
  ('message_received',     'New message',                  'normal'),
  ('lab_report_ready',     'Lab report ready',             'high'),
  ('consent_required',     'Consent action required',      'high'),
  ('payout_processed',     'Payout processed',             'normal'),
  ('care_plan_updated',    'Care plan updated',            'normal')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.lab_vendors (code, name, config, is_active) VALUES
  ('thyrocare', 'Thyrocare', '{}'::jsonb, true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.badge_types (key, name, description, criteria) VALUES
  ('first_log',     'First Log',      'Logged your first meal or measurement', '{"event":"first_log"}'::jsonb),
  ('streak_7',      '7-Day Streak',   'Seven consecutive days of logging',     '{"streak":7}'::jsonb),
  ('program_done',  'Program Finisher','Completed a coaching program',          '{"event":"program_completed"}'::jsonb)
ON CONFLICT (key) DO NOTHING;
