-- =============================================================================
-- Vitalé — Migration 0004: Trigger-function library
-- Phase 1 (Database Foundations) · Implements VITALE_IMPLEMENTATION_SPEC Part 4
-- (§4.1 immutability, §4.3 IST setters + partition hardening) and Part 6 Phase 1
-- (0004_fn_library).
--
-- These are REUSABLE plpgsql functions only. They are ATTACHED to tables (CREATE TRIGGER)
-- in the domain phases where those tables are created — NOT here. plpgsql bodies are not
-- validated for table/column existence at CREATE time, so defining them now is safe even
-- though most target tables do not exist yet.
--
-- The one exception that is BOTH defined and installed here is the partition-hardening
-- EVENT trigger: it must exist before the first partition is ever created so no partition
-- is ever born in an exposed state (Critical: partition isolation).
--
-- Apply order: after 0003_lookup_tables. Idempotent: CREATE OR REPLACE + guarded event trigger.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 4.1  Generic mutation guards
-- ----------------------------------------------------------------------------

-- Touch updated_at on any mutable table.
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- Absolute append-only (soft-delete category [B]): block all UPDATE/DELETE.
-- Attach to: dpdp_consent_records, coach_data_access_audit, clinical_notes,
-- program_versions, diet_chart_versions, care_plan_versions, credit_notes, shop_order_events.
CREATE OR REPLACE FUNCTION public.tg_block_update_delete() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'append-only: % on % denied', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END $$;

-- Per-table forward status-transition whitelist. Conservative default = allow (the money
-- columns are already frozen by tg_block_update_after_issue's column diff); per-table maps
-- are tightened when triggers are wired in Phase 5/8. Same-status is always allowed.
CREATE OR REPLACE FUNCTION public.is_valid_status_transition(p_table text, p_old text, p_new text)
  RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
BEGIN
  IF p_old = p_new THEN RETURN true; END IF;
  RETURN CASE p_table
    WHEN 'disputes'   THEN p_old = 'open'          AND p_new IN ('under_review','won','lost','accepted')
                        OR p_old = 'under_review'  AND p_new IN ('won','lost','accepted')
    WHEN 'settlements' THEN p_old = 'pending'      AND p_new IN ('reconciled','discrepancy')
    WHEN 'refunds'    THEN p_old = 'requested'     AND p_new IN ('processing','processed','failed')
                        OR p_old = 'processing'    AND p_new IN ('processed','failed')
    ELSE true   -- TODO(phase 5/8): enumerate remaining per-table maps; default allow for now
  END;
END $$;

-- Freeze financial [B] records once finalized: only status + audit-timestamp columns may
-- change after a terminal status; all money/identity columns are frozen.
-- Attach to: coach_subscriptions, coach_invoices, invoice_line_items, enrollment_payments,
-- revenue_splits, refunds, disputes, payouts, settlements, shop_orders, shop_order_items, invoices.
CREATE OR REPLACE FUNCTION public.tg_block_update_after_issue() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  terminal_states text[] := ARRAY['issued','captured','paid','reconciled','processed','placed'];
  mutable_keys    text[] := ARRAY['status','updated_at','processed_at','paid_at','reconciled_at',
                                   'captured_at','cancelled_at','revoked_at','resolved_at'];
  old_j jsonb; new_j jsonb; k text;
BEGIN
  IF OLD.status IS NOT NULL AND OLD.status::text = ANY(terminal_states) THEN
    old_j := to_jsonb(OLD); new_j := to_jsonb(NEW);
    FOREACH k IN ARRAY mutable_keys LOOP
      old_j := old_j - k; new_j := new_j - k;
    END LOOP;
    IF old_j IS DISTINCT FROM new_j THEN
      RAISE EXCEPTION 'record frozen after finalization on % (only status/audit cols may change)',
        TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
    END IF;
    IF NOT public.is_valid_status_transition(TG_TABLE_NAME, OLD.status::text, NEW.status::text) THEN
      RAISE EXCEPTION 'illegal status transition % -> % on %',
        OLD.status, NEW.status, TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Message identity immutable through edits/soft-deletes (authorship preserved).
CREATE OR REPLACE FUNCTION public.tg_protect_sender() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.sender_user_id   <> OLD.sender_user_id
     OR NEW.conversation_id <> OLD.conversation_id
     OR NEW.created_at      <> OLD.created_at
     OR NEW.created_date_ist <> OLD.created_date_ist THEN
    RAISE EXCEPTION 'immutable message identity' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

-- Webhook raw payload immutable; only processed / processed_at may flip.
CREATE OR REPLACE FUNCTION public.tg_payload_immutable() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.payload IS DISTINCT FROM OLD.payload
     OR NEW.provider_event_id <> OLD.provider_event_id
     OR NEW.event_type <> OLD.event_type THEN
    RAISE EXCEPTION 'webhook payload is immutable' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

-- ----------------------------------------------------------------------------
-- 4.3  IST partition-key setters (compute *_date_ist from the source timestamptz)
--      Centralized IST business-day rule: (ts AT TIME ZONE 'Asia/Kolkata')::date
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tg_set_logged_date_ist() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.logged_date_ist := (NEW.logged_at AT TIME ZONE 'Asia/Kolkata')::date;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tg_set_measured_date_ist() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.measured_date_ist := (NEW.measured_at AT TIME ZONE 'Asia/Kolkata')::date;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tg_set_created_date_ist() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.created_date_ist := (COALESCE(NEW.created_at, now()) AT TIME ZONE 'Asia/Kolkata')::date;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tg_set_calendar_day_ist() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.calendar_day_ist := (NEW.accessed_at AT TIME ZONE 'Asia/Kolkata')::date;
  RETURN NEW;
END $$;

-- ----------------------------------------------------------------------------
-- 4.3  Partition hardening EVENT trigger (defined AND installed here)
--      Every newly created partition of one of the 6 partitioned parents must be born
--      with RLS ENABLED+FORCED and REVOKE-d from anon/authenticated; messages/notifications
--      partitions are added to the supabase_realtime publication (if it exists yet).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tg_harden_new_partition() RETURNS event_trigger
  LANGUAGE plpgsql AS $$
DECLARE
  obj record;
  parent_name text;
  partitioned_parents text[] := ARRAY[
    'nutrition_logs','nutrition_log_items','coach_data_access_audit',
    'health_observations','messages','notifications'];
  pub_exists boolean;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands() WHERE command_tag = 'CREATE TABLE'
  LOOP
    SELECT pc.relname INTO parent_name
      FROM pg_inherits i
      JOIN pg_class pc ON pc.oid = i.inhparent
     WHERE i.inhrelid = obj.objid;

    IF parent_name = ANY(partitioned_parents) THEN
      EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', obj.object_identity);
      EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',  obj.object_identity);
      EXECUTE format('REVOKE ALL ON %s FROM anon, authenticated', obj.object_identity);

      IF parent_name IN ('messages','notifications') THEN
        SELECT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
          INTO pub_exists;
        IF pub_exists THEN
          EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %s', obj.object_identity);
        END IF;
      END IF;
    END IF;
  END LOOP;
END $$;

DROP EVENT TRIGGER IF EXISTS vitale_harden_new_partition;
CREATE EVENT TRIGGER vitale_harden_new_partition
  ON ddl_command_end WHEN TAG IN ('CREATE TABLE')
  EXECUTE FUNCTION public.tg_harden_new_partition();
