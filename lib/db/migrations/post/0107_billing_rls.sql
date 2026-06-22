-- =============================================================================
-- Vitalé — Post-table migration 0107: D8 Subscriptions, Payments, Billing & Compliance
-- (Phase 5). Raw companion for the 15 D8 tables modeled in lib/db/src/schema/billing.ts.
-- Implements VITALE_DB_ARCHITECTURE §4 D8 (399-461) + §7 policy catalog (737-745) +
-- VITALE_IMPLEMENTATION_SPEC Part 4 (§4.1 IMMUT-ISSUE/IMMUT-BLOCK, §4.4 reconciliation,
-- §4.5 tg_assign_invoice_number/tg_enforce_plan_limit) + Part 6 Phase 5 (line 1118).
--
-- ORDERING: POST-TABLE companion. Apply order:
--   1. `pnpm db:raw`        → foundation 0001-0006 (0004 tg_block_update_after_issue /
--      tg_block_update_delete / tg_payload_immutable / is_valid_status_transition;
--      0006 document_number_sequences for gap-free numbering)
--   2. `pnpm generate && pnpm migrate` → Drizzle creates the 15 D8 tables (billing.ts)
--   3. `pnpm db:raw:post`   → THIS file (after 0101-0106)
--
-- SCOPE IMPLEMENTED here:
--   • RLS + grants + policies for all 15 tables (public-read catalogs; owner/payer/admin reads
--     on REVOKE-API [B] financial tables; service-role writes).
--   • Numbering: tg_assign_invoice_number / tg_assign_credit_note_number (advisory-locked,
--     gap-free per Indian fiscal year, sequence in document_number_sequences).
--   • Reconciliation: tg_reconcile_revenue_split (DEFERRABLE CONSTRAINT TRIGGER, split = captured
--     payment); tg_check_refund_amount (refund ≤ captured — the arch §D8 refunds CHECK, which is
--     cross-row so a trigger, not a column CHECK). settlements gross=net+fees+tax is a same-row
--     CHECK declared in billing.ts.
--   • Immutability: IMMUT-ISSUE (tg_block_update_after_issue, 0004) on the 9 status-bearing [B]
--     tables; tg_freeze_line_item_after_issue (parent-aware "frozen with parent" for line items,
--     which have no status of their own); IMMUT-BLOCK (tg_block_update_delete) on credit_notes;
--     tg_payload_immutable on payment_webhook_events.
--   • Phase-5 refinements (the 0004 "tighten per-table maps in Phase 5/8" TODO): is_valid_status_
--     transition gains the D8 status machines; tg_block_update_after_issue's terminal set is
--     expanded with the unambiguous financial end-states (won/lost/accepted/cancelled/refunded)
--     so resolved disputes / cancelled subscriptions / refunded payments freeze too. The
--     expansion is monotonic (more freezing, never less) and only enumerated D8 tables are
--     tightened — shop-domain tables (built later) stay at the ELSE-true default.
--   • tg_enforce_plan_limit (advisory-locked live count) wired BEFORE INSERT on the metered
--     tables: organization_members, programs, diet_charts, active program_enrollments.
--   • Blocker-1 FK discharge: program_enrollments.payment_id → enrollment_payments(id)
--     (plain/VALID — empty at build; a partitioned-table caveat does not apply here).
--
-- DEFERRED (see footer): subscription_plans/_features/plan_limits SEED VALUES (business config,
-- not in the frozen docs); the coach_subscriptions amount/plan upgrade RPC carve-out; the B2C
-- shop `invoices` numbering (different series, built with the shop domain); the staff_count
-- enforcement at the invited→active UPDATE edge.
--
-- Idempotent: CREATE OR REPLACE; DROP ... IF EXISTS before CREATE TRIGGER/POLICY; FK guarded by
-- pg_constraint conname check.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Companion-local SECURITY DEFINER read helpers (mirrors the 0101/0106 pattern: introduce
-- definer helpers so child-table policies can test parent ownership while bypassing the
-- parent's own RLS — no nested-RLS reasoning, no recursion). All STABLE, fixed search_path.
-- ----------------------------------------------------------------------------

-- caller is the OWNER coach of the org (arch §7: financial reads = "org owner OR ADMIN").
CREATE OR REPLACE FUNCTION public.is_org_owner(p_org uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.coach_organizations o
                 WHERE o.id = p_org AND o.owner_coach_id = auth.uid());
$$;

-- caller owns the org that a coach_invoice belongs to (for invoice_line_items / credit_notes).
CREATE OR REPLACE FUNCTION public.is_invoice_org_owner(p_invoice uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.coach_invoices i
                 WHERE i.id = p_invoice AND public.is_org_owner(i.organization_id));
$$;

-- caller is the payer OR the org owner of the payment behind a refund.
CREATE OR REPLACE FUNCTION public.is_payment_payer_or_owner(p_payment uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.enrollment_payments p
                 WHERE p.id = p_payment
                   AND (p.user_id = auth.uid() OR public.is_org_owner(p.organization_id)));
$$;

-- caller owns the org of the payment behind a dispute (chargebacks: owner + admin, not payer).
CREATE OR REPLACE FUNCTION public.is_payment_org_owner(p_payment uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.enrollment_payments p
                 WHERE p.id = p_payment AND public.is_org_owner(p.organization_id));
$$;

GRANT EXECUTE ON FUNCTION
  public.is_org_owner(uuid),
  public.is_invoice_org_owner(uuid),
  public.is_payment_payer_or_owner(uuid),
  public.is_payment_org_owner(uuid)
TO authenticated;

-- ----------------------------------------------------------------------------
-- Phase-5 refinements to two foundation functions (0004). Both are CREATE OR REPLACE and
-- MONOTONIC — they only ADD freezing/transition knowledge for the D8 status machines; the
-- ELSE-true default and the original disputes/settlements/refunds maps are preserved verbatim,
-- so tables built in later phases keep the conservative "allow + column-freeze" default. This
-- discharges the 0004 "TODO(phase 5/8): enumerate remaining per-table maps" for the D8 tables.
-- ----------------------------------------------------------------------------

-- is_valid_status_transition — add the D8 forward whitelists. Only transitions FROM a terminal
-- status (see tg_block_update_after_issue) are ever consulted, but the pre-terminal edges are
-- enumerated too so the state machine is self-documenting and forward-safe if terminal_states
-- ever grows. Same signature/volatility (IMMUTABLE, pure — reads no tables).
CREATE OR REPLACE FUNCTION public.is_valid_status_transition(p_table text, p_old text, p_new text)
  RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
BEGIN
  IF p_old = p_new THEN RETURN true; END IF;
  RETURN CASE p_table
    -- ---- D8 (Phase 5) -------------------------------------------------------
    WHEN 'coach_invoices'      THEN p_old = 'draft'      AND p_new IN ('issued','cancelled')
                                 OR p_old = 'issued'     AND p_new = 'paid'
    WHEN 'enrollment_payments' THEN p_old = 'created'    AND p_new IN ('authorized','captured','failed')
                                 OR p_old = 'authorized' AND p_new IN ('captured','failed')
                                 OR p_old = 'captured'   AND p_new = 'refunded'
    WHEN 'revenue_splits'      THEN p_old = 'pending'    AND p_new IN ('processed','failed')
    WHEN 'payouts'             THEN p_old = 'pending'    AND p_new IN ('processing','paid','failed')
                                 OR p_old = 'processing' AND p_new IN ('paid','failed')
    WHEN 'coach_subscriptions' THEN p_old = 'active'     AND p_new IN ('past_due','paused','cancelled')
                                 OR p_old = 'past_due'   AND p_new IN ('active','paused','cancelled')
                                 OR p_old = 'paused'     AND p_new IN ('active','cancelled')
    -- ---- preserved from 0004 ------------------------------------------------
    WHEN 'disputes'   THEN p_old = 'open'          AND p_new IN ('under_review','won','lost','accepted')
                        OR p_old = 'under_review'  AND p_new IN ('won','lost','accepted')
    WHEN 'settlements' THEN p_old = 'pending'      AND p_new IN ('reconciled','discrepancy')
    WHEN 'refunds'    THEN p_old = 'requested'     AND p_new IN ('processing','processed','failed')
                        OR p_old = 'processing'    AND p_new IN ('processed','failed')
    ELSE true   -- shop-domain tables (built later) keep the conservative default-allow
  END;
END $$;

-- tg_block_update_after_issue — expand terminal_states with the unambiguous D8 financial
-- end-states so resolved disputes (won/lost/accepted), cancelled subscriptions, and refunded
-- payments freeze too. Body is otherwise byte-identical to 0004 (same mutable_keys, same diff +
-- transition check). Expansion is monotonic: more freezing, never less. 'failed'/'discrepancy'
-- are intentionally excluded (retryable / ambiguous → still mutable).
CREATE OR REPLACE FUNCTION public.tg_block_update_after_issue() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  terminal_states text[] := ARRAY['issued','captured','paid','reconciled','processed','placed',
                                   'won','lost','accepted','cancelled','refunded'];
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

-- ----------------------------------------------------------------------------
-- D8 business triggers (defined here; attached below). All SECURITY DEFINER (owned by the
-- BYPASSRLS migration role) so they may read/insert the FORCE-RLS financial + sequence tables
-- regardless of the caller's row visibility. Fixed search_path.
-- ----------------------------------------------------------------------------

-- tg_assign_invoice_number — gap-free statutory numbering at the draft→issued edge (spec §4.5).
-- Idempotent per row (only fires when status=issued AND number still NULL). Advisory-locked on
-- (series, fiscal_year) so concurrent issues never collide or leave gaps; the sequence row lives
-- in document_number_sequences (0006). Indian FY (Apr 1→Mar 31) computed in IST. BEFORE INSERT OR
-- UPDATE so it covers both a draft promoted to issued and an invoice inserted already-issued.
CREATE OR REPLACE FUNCTION public.tg_assign_invoice_number() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_ist date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_fy  integer;
  v_seq bigint;
BEGIN
  IF NEW.status = 'issued' AND NEW.invoice_number IS NULL THEN
    v_fy := (CASE WHEN extract(month FROM v_ist) >= 4
                  THEN extract(year FROM v_ist) ELSE extract(year FROM v_ist) - 1 END)::integer;
    PERFORM pg_advisory_xact_lock(hashtext('coach_invoice:' || v_fy::text)::bigint);
    INSERT INTO public.document_number_sequences AS dns (series, fiscal_year, last_value)
      VALUES ('coach_invoice', v_fy, 1)
      ON CONFLICT (series, fiscal_year)
      DO UPDATE SET last_value = dns.last_value + 1, updated_at = now()
      RETURNING dns.last_value INTO v_seq;
    -- VIT/<FY>-<YY+1>/<00001>  e.g. FY2025-26 ⇒ 'VIT/2025-26/00001'
    NEW.invoice_number := 'VIT/' || v_fy::text || '-'
                          || lpad(((v_fy + 1) % 100)::text, 2, '0') || '/'
                          || lpad(v_seq::text, 5, '0');
    IF NEW.issued_at IS NULL THEN NEW.issued_at := now(); END IF;
  END IF;
  RETURN NEW;
END $$;

-- tg_assign_credit_note_number — same machinery, distinct series ('credit_note') + prefix
-- ('VIT-CN/'). credit_notes are append-only (IMMUT-BLOCK) so this is BEFORE INSERT only and
-- always assigns (the row is born final). issued_at defaulted to now() if unset.
CREATE OR REPLACE FUNCTION public.tg_assign_credit_note_number() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_ist date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_fy  integer;
  v_seq bigint;
BEGIN
  v_fy := (CASE WHEN extract(month FROM v_ist) >= 4
                THEN extract(year FROM v_ist) ELSE extract(year FROM v_ist) - 1 END)::integer;
  IF NEW.credit_note_number IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('credit_note:' || v_fy::text)::bigint);
    INSERT INTO public.document_number_sequences AS dns (series, fiscal_year, last_value)
      VALUES ('credit_note', v_fy, 1)
      ON CONFLICT (series, fiscal_year)
      DO UPDATE SET last_value = dns.last_value + 1, updated_at = now()
      RETURNING dns.last_value INTO v_seq;
    NEW.credit_note_number := 'VIT-CN/' || v_fy::text || '-'
                              || lpad(((v_fy + 1) % 100)::text, 2, '0') || '/'
                              || lpad(v_seq::text, 5, '0');
  END IF;
  IF NEW.issued_at IS NULL THEN NEW.issued_at := now(); END IF;
  RETURN NEW;
END $$;

-- tg_reconcile_revenue_split — money conservation: a split must sum to the CAPTURED payment it
-- belongs to (arch §D8). Cross-row, so a trigger not a column CHECK. DEFERRABLE constraint trigger
-- (INITIALLY DEFERRED) so the payment row and its split can be written in either order inside the
-- enrollment transaction; the check runs at COMMIT. (A later refund leaves amount_paise intact, so
-- 'refunded' is accepted as well as 'captured'.)
CREATE OR REPLACE FUNCTION public.tg_reconcile_revenue_split() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_captured bigint;
BEGIN
  SELECT p.amount_paise INTO v_captured
    FROM public.enrollment_payments p
   WHERE p.id = NEW.payment_id AND p.status IN ('captured','refunded');
  IF v_captured IS NULL THEN
    RAISE EXCEPTION 'revenue split %: payment % is not captured', NEW.id, NEW.payment_id
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.platform_fee_paise + NEW.coach_amount_paise <> v_captured THEN
    RAISE EXCEPTION 'revenue split %: platform_fee(%) + coach_amount(%) <> captured payment(%)',
      NEW.id, NEW.platform_fee_paise, NEW.coach_amount_paise, v_captured
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

-- tg_check_refund_amount — a refund (and the CUMULATIVE non-failed refunds) may not exceed the
-- captured payment (arch §D8 refunds CHECK; cross-row → trigger). Failed refunds neither consume
-- nor are checked. BEFORE INSERT OR UPDATE.
CREATE OR REPLACE FUNCTION public.tg_check_refund_amount() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_captured bigint;
  v_prior    bigint;
BEGIN
  IF NEW.status = 'failed' THEN RETURN NEW; END IF;
  SELECT p.amount_paise INTO v_captured
    FROM public.enrollment_payments p
   WHERE p.id = NEW.payment_id AND p.status IN ('captured','refunded');
  IF v_captured IS NULL THEN
    RAISE EXCEPTION 'refund %: payment % is not captured', NEW.id, NEW.payment_id
      USING ERRCODE = 'restrict_violation';
  END IF;
  SELECT COALESCE(sum(r.amount_paise), 0) INTO v_prior
    FROM public.refunds r
   WHERE r.payment_id = NEW.payment_id AND r.id <> NEW.id AND r.status <> 'failed';
  IF v_prior + NEW.amount_paise > v_captured THEN
    RAISE EXCEPTION 'refund %: cumulative refunds (%+%) exceed captured payment(%)',
      NEW.id, v_prior, NEW.amount_paise, v_captured USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

-- tg_freeze_line_item_after_issue — invoice_line_items have no status of their own; they are
-- "frozen with parent". Any INSERT/UPDATE/DELETE is denied once the parent coach_invoice has left
-- 'draft' (draft is the only editable state). BEFORE INSERT OR UPDATE OR DELETE.
CREATE OR REPLACE FUNCTION public.tg_freeze_line_item_after_issue() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_invoice uuid := COALESCE(NEW.invoice_id, OLD.invoice_id);
  v_status  text;
BEGIN
  SELECT i.status INTO v_status FROM public.coach_invoices i WHERE i.id = v_invoice;
  IF v_status IS NOT NULL AND v_status <> 'draft' THEN
    RAISE EXCEPTION 'invoice line item frozen: parent invoice % is % (only draft invoices are editable)',
      v_invoice, v_status USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

-- tg_enforce_plan_limit — concurrency-safe metered ceilings (spec §4.5). Maps the metered table
-- to its limit_metric, takes an xact-scoped advisory lock on (org, metric) so racing inserts
-- serialize, reads the active plan's limit, and counts the live population with the metric's
-- "active predicate". NULL limit (no active plan, or an explicitly-unlimited row) ⇒ no ceiling.
-- active_clients counts DISTINCT users over active enrollments and a re-enroll by an already-active
-- client consumes no new slot. BEFORE INSERT.
CREATE OR REPLACE FUNCTION public.tg_enforce_plan_limit() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_org    uuid := NEW.organization_id;
  v_metric limit_metric;
  v_lim    bigint;
  v_cur    bigint;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'organization_members' THEN v_metric := 'staff_count';
    WHEN 'programs'             THEN v_metric := 'program_count';
    WHEN 'diet_charts'          THEN v_metric := 'diet_chart_count';
    WHEN 'program_enrollments'  THEN v_metric := 'active_clients';
    ELSE RETURN NEW;  -- defensive: trigger is only attached to the four metered tables
  END CASE;

  -- active_clients is measured over ACTIVE enrollments only → a non-active insert consumes nothing.
  -- NOTE: NEW.status / NEW.user_id are referenced ONLY inside the program_enrollments guard. They must
  -- be nested (not AND-ed on one line) because this trigger is polymorphic — for the programs /
  -- diet_charts rowtypes, NEW has no comparable status enum value 'active' and no user_id field, so a
  -- single-line `... AND NEW.status <> 'active'` forces Postgres to resolve those refs against the wrong
  -- rowtype and fails (22P02 / missing field). The outer IF short-circuits before the inner ref is read.
  IF TG_TABLE_NAME = 'program_enrollments' THEN
    IF NEW.status <> 'active' THEN
      RETURN NEW;
    END IF;
  END IF;

  -- serialize concurrent inserts for this (org, metric); two racing writes can't both pass the count.
  PERFORM pg_advisory_xact_lock(hashtext(v_org::text || ':' || v_metric::text)::bigint);

  -- a re-enroll by a client who is ALREADY an active client of this org consumes no new slot.
  IF TG_TABLE_NAME = 'program_enrollments' THEN
    IF EXISTS (SELECT 1 FROM public.program_enrollments e
                WHERE e.organization_id = v_org AND e.user_id = NEW.user_id AND e.status = 'active') THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT pl.limit_value INTO v_lim
    FROM public.plan_limits pl
    JOIN public.coach_subscriptions s ON s.plan_id = pl.plan_id
   WHERE s.organization_id = v_org AND s.status = 'active' AND pl.limit_key = v_metric
   LIMIT 1;
  IF v_lim IS NULL THEN RETURN NEW; END IF;   -- no active plan, or unlimited metric ⇒ no ceiling

  CASE TG_TABLE_NAME
    WHEN 'organization_members' THEN          -- live staff seats (owner_coach excluded; invited counts)
      SELECT count(*) INTO v_cur FROM public.organization_members m
       WHERE m.organization_id = v_org AND m.status <> 'removed' AND m.member_role <> 'owner_coach';
    WHEN 'programs' THEN                       -- non-archived programs
      SELECT count(*) INTO v_cur FROM public.programs p
       WHERE p.organization_id = v_org AND p.status <> 'archived';
    WHEN 'diet_charts' THEN                    -- non-archived diet charts
      SELECT count(*) INTO v_cur FROM public.diet_charts d
       WHERE d.organization_id = v_org AND d.status <> 'archived';
    WHEN 'program_enrollments' THEN            -- distinct active clients
      SELECT count(DISTINCT e.user_id) INTO v_cur FROM public.program_enrollments e
       WHERE e.organization_id = v_org AND e.status = 'active';
  END CASE;

  IF v_cur >= v_lim THEN
    RAISE EXCEPTION 'plan limit % reached (%/%)', v_metric, v_cur, v_lim
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

-- ----------------------------------------------------------------------------
-- Trigger attachments. DROP IF EXISTS first (idempotent). Naming: <table>_<purpose>; for the two
-- coach_invoices BEFORE triggers, alphabetical firing puts *_assign_number before *_immutable —
-- which is what we want (number assigned before the freeze check), though on the draft→issued edge
-- OLD.status='draft' is pre-terminal so the freeze is a no-op anyway.
-- ----------------------------------------------------------------------------

-- subscription_plans: the one D8 table with updated_at (the [A] catalog).
DROP TRIGGER IF EXISTS subscription_plans_touch ON public.subscription_plans;
CREATE TRIGGER subscription_plans_touch BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- coach_subscriptions: IMMUT-ISSUE (frozen once cancelled).
DROP TRIGGER IF EXISTS coach_subscriptions_immutable ON public.coach_subscriptions;
CREATE TRIGGER coach_subscriptions_immutable BEFORE UPDATE ON public.coach_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_update_after_issue();

-- coach_invoices: assign number at issue + IMMUT-ISSUE (frozen once issued/paid).
DROP TRIGGER IF EXISTS coach_invoices_assign_number ON public.coach_invoices;
CREATE TRIGGER coach_invoices_assign_number BEFORE INSERT OR UPDATE ON public.coach_invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_assign_invoice_number();
DROP TRIGGER IF EXISTS coach_invoices_immutable ON public.coach_invoices;
CREATE TRIGGER coach_invoices_immutable BEFORE UPDATE ON public.coach_invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_update_after_issue();

-- invoice_line_items: frozen with parent (no own status).
DROP TRIGGER IF EXISTS invoice_line_items_freeze ON public.invoice_line_items;
CREATE TRIGGER invoice_line_items_freeze BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_freeze_line_item_after_issue();

-- credit_notes: assign number at insert + IMMUT-BLOCK (append-only).
DROP TRIGGER IF EXISTS credit_notes_assign_number ON public.credit_notes;
CREATE TRIGGER credit_notes_assign_number BEFORE INSERT ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.tg_assign_credit_note_number();
DROP TRIGGER IF EXISTS credit_notes_immutable ON public.credit_notes;
CREATE TRIGGER credit_notes_immutable BEFORE UPDATE OR DELETE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_update_delete();

-- enrollment_payments: IMMUT-ISSUE (frozen once captured/refunded).
DROP TRIGGER IF EXISTS enrollment_payments_immutable ON public.enrollment_payments;
CREATE TRIGGER enrollment_payments_immutable BEFORE UPDATE ON public.enrollment_payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_update_after_issue();

-- revenue_splits: deferred money-conservation constraint + IMMUT-ISSUE.
DROP TRIGGER IF EXISTS revenue_splits_reconcile ON public.revenue_splits;
CREATE CONSTRAINT TRIGGER revenue_splits_reconcile
  AFTER INSERT OR UPDATE ON public.revenue_splits
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.tg_reconcile_revenue_split();
DROP TRIGGER IF EXISTS revenue_splits_immutable ON public.revenue_splits;
CREATE TRIGGER revenue_splits_immutable BEFORE UPDATE ON public.revenue_splits
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_update_after_issue();

-- refunds: amount ≤ captured (cumulative) + IMMUT-ISSUE (frozen once processed).
DROP TRIGGER IF EXISTS refunds_check_amount ON public.refunds;
CREATE TRIGGER refunds_check_amount BEFORE INSERT OR UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.tg_check_refund_amount();
DROP TRIGGER IF EXISTS refunds_immutable ON public.refunds;
CREATE TRIGGER refunds_immutable BEFORE UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_update_after_issue();

-- disputes: IMMUT-ISSUE (frozen once won/lost/accepted).
DROP TRIGGER IF EXISTS disputes_immutable ON public.disputes;
CREATE TRIGGER disputes_immutable BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_update_after_issue();

-- payouts: IMMUT-ISSUE (frozen once paid).
DROP TRIGGER IF EXISTS payouts_immutable ON public.payouts;
CREATE TRIGGER payouts_immutable BEFORE UPDATE ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_update_after_issue();

-- settlements: IMMUT-ISSUE (frozen once reconciled).
DROP TRIGGER IF EXISTS settlements_immutable ON public.settlements;
CREATE TRIGGER settlements_immutable BEFORE UPDATE ON public.settlements
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_update_after_issue();

-- payment_webhook_events: raw payload immutable; only processed/processed_at may flip.
DROP TRIGGER IF EXISTS payment_webhook_events_payload_immutable ON public.payment_webhook_events;
CREATE TRIGGER payment_webhook_events_payload_immutable BEFORE UPDATE ON public.payment_webhook_events
  FOR EACH ROW EXECUTE FUNCTION public.tg_payload_immutable();

-- plan-limit enforcement on the four metered tables (the 0004/0106 "Phase 5" TODO discharged).
DROP TRIGGER IF EXISTS organization_members_enforce_limit ON public.organization_members;
CREATE TRIGGER organization_members_enforce_limit BEFORE INSERT ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_plan_limit();
DROP TRIGGER IF EXISTS programs_enforce_limit ON public.programs;
CREATE TRIGGER programs_enforce_limit BEFORE INSERT ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_plan_limit();
DROP TRIGGER IF EXISTS diet_charts_enforce_limit ON public.diet_charts;
CREATE TRIGGER diet_charts_enforce_limit BEFORE INSERT ON public.diet_charts
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_plan_limit();
DROP TRIGGER IF EXISTS program_enrollments_enforce_limit ON public.program_enrollments;
CREATE TRIGGER program_enrollments_enforce_limit BEFORE INSERT ON public.program_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_plan_limit();

-- ----------------------------------------------------------------------------
-- Blocker-1 discharge: program_enrollments.payment_id → enrollment_payments(id). programs.ts
-- models payment_id as a plain nullable uuid (no .references()) to avoid the circular import; the
-- FK is added here now that enrollment_payments exists. Plain/VALID — both tables are empty at
-- build (instant, no scan). Guarded by conname for idempotency.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'program_enrollments_payment_id_fkey') THEN
    ALTER TABLE public.program_enrollments
      ADD CONSTRAINT program_enrollments_payment_id_fkey
      FOREIGN KEY (payment_id) REFERENCES public.enrollment_payments(id);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- RLS: ENABLE the 4 RLS-ON tables (3 public-read catalogs + billing_metrics owner-read);
-- ENABLE + FORCE the 11 [B] financial tables (arch §7 line 745: REVOKE-API). service_role has
-- BYPASSRLS so it still writes through FORCE.
-- ----------------------------------------------------------------------------
ALTER TABLE public.subscription_plans      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_features   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_limits             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_metrics         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_subscriptions     FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.coach_invoices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_invoices          FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items      FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.credit_notes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_notes            FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.enrollment_payments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollment_payments     FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.revenue_splits          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_splits          FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.refunds                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds                 FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.disputes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes                FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.payouts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts                 FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.settlements             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements             FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events  FORCE  ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Grants. Catalogs are PostgREST-readable (anon+authenticated SELECT; authenticated DML gated to
-- admins by policy). billing_metrics: authenticated SELECT only (policy-gated; service-role writes
-- the rollup). The 11 [B] tables: REVOKE ALL from the API roles, then GRANT SELECT to authenticated
-- (policy-gated owner/payer/admin reads); all writes are service-role only. payment_webhook_events
-- gets NO grant at all — it is service-role-only end to end (signature-verified intake).
-- ----------------------------------------------------------------------------
GRANT SELECT                         ON public.subscription_plans     TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE         ON public.subscription_plans     TO authenticated; -- admin-gated by policy
GRANT SELECT                         ON public.subscription_features  TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE         ON public.subscription_features  TO authenticated;
GRANT SELECT                         ON public.plan_limits            TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE         ON public.plan_limits            TO authenticated;
GRANT SELECT                         ON public.billing_metrics        TO authenticated; -- writes via rollup (service-role)

REVOKE ALL ON public.coach_subscriptions    FROM anon, authenticated;
REVOKE ALL ON public.coach_invoices          FROM anon, authenticated;
REVOKE ALL ON public.invoice_line_items      FROM anon, authenticated;
REVOKE ALL ON public.credit_notes            FROM anon, authenticated;
REVOKE ALL ON public.enrollment_payments     FROM anon, authenticated;
REVOKE ALL ON public.revenue_splits          FROM anon, authenticated;
REVOKE ALL ON public.refunds                 FROM anon, authenticated;
REVOKE ALL ON public.disputes                FROM anon, authenticated;
REVOKE ALL ON public.payouts                 FROM anon, authenticated;
REVOKE ALL ON public.settlements             FROM anon, authenticated;
REVOKE ALL ON public.payment_webhook_events  FROM anon, authenticated; -- service-role only (no SELECT)

GRANT SELECT ON public.coach_subscriptions  TO authenticated;
GRANT SELECT ON public.coach_invoices       TO authenticated;
GRANT SELECT ON public.invoice_line_items   TO authenticated;
GRANT SELECT ON public.credit_notes         TO authenticated;
GRANT SELECT ON public.enrollment_payments  TO authenticated;
GRANT SELECT ON public.revenue_splits       TO authenticated;
GRANT SELECT ON public.refunds              TO authenticated;
GRANT SELECT ON public.disputes             TO authenticated;
GRANT SELECT ON public.payouts              TO authenticated;
GRANT SELECT ON public.settlements          TO authenticated;
-- (payment_webhook_events: intentionally no GRANT — deny-all to API roles.)

-- ----------------------------------------------------------------------------
-- Policies (DROP IF EXISTS first). Catalogs: public SELECT + admin DML. [B] financial tables:
-- SELECT-only, owner/payer/admin via the SECURITY DEFINER helpers above; NO write policies (writes
-- are service-role, which bypasses RLS). payment_webhook_events: no policy at all (deny-all).
-- ----------------------------------------------------------------------------

-- subscription_plans — public catalog; admin writes.
DROP POLICY IF EXISTS subscription_plans_select_public ON public.subscription_plans;
CREATE POLICY subscription_plans_select_public ON public.subscription_plans FOR SELECT TO anon, authenticated
  USING (true);
DROP POLICY IF EXISTS subscription_plans_insert ON public.subscription_plans;
CREATE POLICY subscription_plans_insert ON public.subscription_plans FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS subscription_plans_update ON public.subscription_plans;
CREATE POLICY subscription_plans_update ON public.subscription_plans FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS subscription_plans_delete ON public.subscription_plans;
CREATE POLICY subscription_plans_delete ON public.subscription_plans FOR DELETE TO authenticated
  USING (public.is_admin());

-- subscription_features — public catalog; admin writes.
DROP POLICY IF EXISTS subscription_features_select_public ON public.subscription_features;
CREATE POLICY subscription_features_select_public ON public.subscription_features FOR SELECT TO anon, authenticated
  USING (true);
DROP POLICY IF EXISTS subscription_features_insert ON public.subscription_features;
CREATE POLICY subscription_features_insert ON public.subscription_features FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS subscription_features_update ON public.subscription_features;
CREATE POLICY subscription_features_update ON public.subscription_features FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS subscription_features_delete ON public.subscription_features;
CREATE POLICY subscription_features_delete ON public.subscription_features FOR DELETE TO authenticated
  USING (public.is_admin());

-- plan_limits — public catalog; admin writes.
DROP POLICY IF EXISTS plan_limits_select_public ON public.plan_limits;
CREATE POLICY plan_limits_select_public ON public.plan_limits FOR SELECT TO anon, authenticated
  USING (true);
DROP POLICY IF EXISTS plan_limits_insert ON public.plan_limits;
CREATE POLICY plan_limits_insert ON public.plan_limits FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS plan_limits_update ON public.plan_limits;
CREATE POLICY plan_limits_update ON public.plan_limits FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS plan_limits_delete ON public.plan_limits;
CREATE POLICY plan_limits_delete ON public.plan_limits FOR DELETE TO authenticated
  USING (public.is_admin());

-- billing_metrics — org owner + admin read (financial reporting); service-role writes the rollup.
DROP POLICY IF EXISTS billing_metrics_select ON public.billing_metrics;
CREATE POLICY billing_metrics_select ON public.billing_metrics FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_org_owner(organization_id));

-- coach_subscriptions — org owner + admin read.
DROP POLICY IF EXISTS coach_subscriptions_select ON public.coach_subscriptions;
CREATE POLICY coach_subscriptions_select ON public.coach_subscriptions FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_org_owner(organization_id));

-- coach_invoices — org owner + admin read.
DROP POLICY IF EXISTS coach_invoices_select ON public.coach_invoices;
CREATE POLICY coach_invoices_select ON public.coach_invoices FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_org_owner(organization_id));

-- invoice_line_items — inherit the parent invoice's org-owner read.
DROP POLICY IF EXISTS invoice_line_items_select ON public.invoice_line_items;
CREATE POLICY invoice_line_items_select ON public.invoice_line_items FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_invoice_org_owner(invoice_id));

-- credit_notes — inherit the parent invoice's org-owner read.
DROP POLICY IF EXISTS credit_notes_select ON public.credit_notes;
CREATE POLICY credit_notes_select ON public.credit_notes FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_invoice_org_owner(invoice_id));

-- enrollment_payments — the paying customer, the org owner, or admin.
DROP POLICY IF EXISTS enrollment_payments_select ON public.enrollment_payments;
CREATE POLICY enrollment_payments_select ON public.enrollment_payments FOR SELECT TO authenticated
  USING (public.is_admin() OR user_id = auth.uid() OR public.is_org_owner(organization_id));

-- revenue_splits — org owner + admin read.
DROP POLICY IF EXISTS revenue_splits_select ON public.revenue_splits;
CREATE POLICY revenue_splits_select ON public.revenue_splits FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_org_owner(organization_id));

-- refunds — the payer or the org owner of the underlying payment, or admin.
DROP POLICY IF EXISTS refunds_select ON public.refunds;
CREATE POLICY refunds_select ON public.refunds FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_payment_payer_or_owner(payment_id));

-- disputes — chargebacks: org owner of the underlying payment + admin (NOT the payer).
DROP POLICY IF EXISTS disputes_select ON public.disputes;
CREATE POLICY disputes_select ON public.disputes FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_payment_org_owner(payment_id));

-- payouts — org owner + admin read.
DROP POLICY IF EXISTS payouts_select ON public.payouts;
CREATE POLICY payouts_select ON public.payouts FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_org_owner(organization_id));

-- settlements — provider reconciliation: admin only (platform-level, not org-scoped).
DROP POLICY IF EXISTS settlements_select ON public.settlements;
CREATE POLICY settlements_select ON public.settlements FOR SELECT TO authenticated
  USING (public.is_admin());

-- payment_webhook_events — NO policy: with FORCE RLS + zero policies + no grant, anon/authenticated
-- are denied entirely; only service_role (BYPASSRLS) reads/writes it.

-- =============================================================================
-- DEFERRED (dependencies not yet pinned / built):
--   • SEED VALUES for subscription_plans / subscription_features / plan_limits — business config
--     (tier prices, feature flags, per-tier ceilings). Not in the frozen docs; ships with the
--     billing-config decision, as an idempotent seed (scripts/seed.ts or a data-only migration).
--   • coach_subscriptions plan/amount UPGRADE RPC — the one sanctioned path to change a live
--     subscription's plan_id/amount_paise (IMMUT-ISSUE only freezes AFTER cancellation, so a live
--     'active' row is mutable; the RPC is where the upgrade/proration invariants live). The §4.5
--     "documented upgrade RPC" carve-out — built with the billing service.
--   • B2C shop `invoices` numbering — the shop domain's own invoice series (distinct prefix/series
--     in document_number_sequences); lands with the shop tables (Phase 8). tg_assign_invoice_number
--     here is the SaaS 'coach_invoice' series only.
--   • staff_count enforcement at the invited→active UPDATE edge — tg_enforce_plan_limit is
--     BEFORE INSERT (a seat is reserved at invite). If invitations can be created without an
--     organization_members row until acceptance, the activation-edge check belongs with the
--     invitation-accept RPC; revisit when that flow is built.
-- =============================================================================
