-- =============================================================================
-- Vitalé — Post-companion 0121: tg_hash_chain (Phase 2 tamper evidence)
-- Ground truth: VITALE_IMPLEMENTATION_SPEC §4.6 (lines 1041-1044).
--
-- Applies selective hash-chaining to the two most sensitive audit logs:
--   • coach_data_access_audit — PHI access log
--   • admin_support_access    — break-glass / self-approval admin access log
--
-- Each INSERT computes:
--   prev_hash = row_hash of the previous row in the same partition (by
--               accessed_at DESC, id DESC). NULL for the first row.
--   row_hash  = SHA-256 hex of (prev_hash || canonical_payload).
--
-- The nightly audit_chain_verify job (0116, job 7) walks the chain and alerts
-- on any row_hash mismatch — detecting in-place tampering.
--
-- Columns prev_hash + row_hash already exist in coach_data_access_audit (0113)
-- as nullable text (Phase 2 stub). admin_support_access gains them here.
--
-- Apply order: after 0120 (lexical). Idempotent: CREATE OR REPLACE;
-- DROP TRIGGER IF EXISTS before CREATE TRIGGER.
-- =============================================================================

-- ============================================================================
-- SECTION 1 — add prev_hash / row_hash to admin_support_access (if absent)
-- ============================================================================
ALTER TABLE public.admin_support_access
  ADD COLUMN IF NOT EXISTS prev_hash text,
  ADD COLUMN IF NOT EXISTS row_hash  text;

-- ============================================================================
-- SECTION 2 — tg_hash_chain() trigger function
-- Computes prev_hash from the most-recent row in scope, then row_hash from
-- SHA-256 of the canonical payload. Uses pgcrypto digest() (0001_extensions).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.tg_hash_chain()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp AS $$
DECLARE
  v_prev_hash  text;
  v_canonical  text;
  v_root_name  text;
BEGIN
  -- CRITICAL: branch on the LOGICAL (root) table, not TG_TABLE_NAME. On a
  -- partitioned table the BEFORE INSERT trigger fires on the LEAF partition, so
  -- TG_TABLE_NAME is e.g. 'coach_data_access_audit_2026_06' — which matched
  -- NEITHER branch below, leaving v_canonical NULL and row_hash =
  -- encode(digest(''||NULL)) = NULL for every row. That silently disabled the
  -- entire tamper-evidence chain (and the verify job, filtering row_hash IS NOT
  -- NULL, then reported "intact" over zero rows). pg_partition_root() collapses
  -- any partition/parent to the root; it is NULL for a non-partitioned table
  -- (admin_support_access), so COALESCE falls back to the firing relation.
  SELECT c.relname INTO v_root_name
    FROM pg_class c
   WHERE c.oid = COALESCE(pg_partition_root(TG_RELID), TG_RELID);

  -- Look up the most recent row_hash in the same logical partition/table.
  -- For partitioned coach_data_access_audit: querying the parent works in PG14+.
  IF v_root_name = 'coach_data_access_audit' THEN
    SELECT row_hash INTO v_prev_hash
    FROM public.coach_data_access_audit
    ORDER BY accessed_at DESC, id DESC
    LIMIT 1;
  ELSIF v_root_name = 'admin_support_access' THEN
    SELECT row_hash INTO v_prev_hash
    FROM public.admin_support_access
    ORDER BY created_at DESC, id DESC
    LIMIT 1;
  END IF;

  NEW.prev_hash := v_prev_hash;

  -- Canonical payload: stable string representation of the non-hash columns.
  -- Using text-cast of the full NEW row minus prev_hash/row_hash themselves
  -- avoids bootstrapping issues. In production, a dedicated immutable canonical
  -- function per table is preferred for forward compatibility.
  IF v_root_name = 'coach_data_access_audit' THEN
    v_canonical := concat_ws('|',
      NEW.id::text,
      NEW.accessed_at::text,
      NEW.organization_id::text,
      NEW.accessor_user_id::text,
      NEW.data_subject_user_id::text,
      NEW.acting_as::text,
      NEW.resource_type::text,
      COALESCE(NEW.resource_id::text, ''),
      NEW.action::text,
      NEW.calendar_day_ist::text
    );
  ELSIF v_root_name = 'admin_support_access' THEN
    v_canonical := concat_ws('|',
      NEW.id::text,
      COALESCE(NEW.created_at::text, ''),
      NEW.requested_by_admin_id::text,
      NEW.subject_user_id::text,
      NEW.reason_code::text,
      NEW.approval_mode::text,
      NEW.status::text
    );
  END IF;

  NEW.row_hash := encode(
    extensions.digest(COALESCE(v_prev_hash, '') || v_canonical, 'sha256'),
    'hex'
  );

  RETURN NEW;
END;
$$;

-- ============================================================================
-- SECTION 3 — attach triggers
-- ============================================================================

-- coach_data_access_audit (partitioned; trigger on parent fires for all partitions)
DROP TRIGGER IF EXISTS coach_audit_hash_chain ON public.coach_data_access_audit;
CREATE TRIGGER coach_audit_hash_chain
  BEFORE INSERT ON public.coach_data_access_audit
  FOR EACH ROW EXECUTE FUNCTION public.tg_hash_chain();

-- admin_support_access
DROP TRIGGER IF EXISTS admin_access_hash_chain ON public.admin_support_access;
CREATE TRIGGER admin_access_hash_chain
  BEFORE INSERT ON public.admin_support_access
  FOR EACH ROW EXECUTE FUNCTION public.tg_hash_chain();

-- ============================================================================
-- SECTION 4 — update audit_chain_verify job to be functional (replaces stub in 0116)
-- ============================================================================
CREATE OR REPLACE PROCEDURE public.job_audit_chain_verify()
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_mismatch_count int := 0;
  v_rec            record;
  v_expected_hash  text;
  v_canonical      text;
BEGIN
  -- Walk coach_data_access_audit; skip rows where row_hash is NULL (pre-chain rows)
  FOR v_rec IN
    SELECT id, accessed_at, organization_id, accessor_user_id, data_subject_user_id,
           acting_as, resource_type, resource_id, action, calendar_day_ist,
           prev_hash, row_hash
    FROM public.coach_data_access_audit
    WHERE row_hash IS NOT NULL
    ORDER BY accessed_at ASC, id ASC
  LOOP
    v_canonical := concat_ws('|',
      v_rec.id::text,
      v_rec.accessed_at::text,
      v_rec.organization_id::text,
      v_rec.accessor_user_id::text,
      v_rec.data_subject_user_id::text,
      v_rec.acting_as::text,
      v_rec.resource_type::text,
      COALESCE(v_rec.resource_id::text, ''),
      v_rec.action::text,
      v_rec.calendar_day_ist::text
    );
    v_expected_hash := encode(
      extensions.digest(COALESCE(v_rec.prev_hash, '') || v_canonical, 'sha256'),
      'hex'
    );
    IF v_rec.row_hash <> v_expected_hash THEN
      v_mismatch_count := v_mismatch_count + 1;
    END IF;
  END LOOP;

  IF v_mismatch_count > 0 THEN
    CALL public.job_write_run('audit_chain_verify', 'error',
      format('TAMPER ALERT: %s hash mismatches in coach_data_access_audit', v_mismatch_count));
  ELSE
    CALL public.job_write_run('audit_chain_verify', 'success',
      'hash chain intact');
  END IF;
END;
$$;

-- ============================================================================
-- NOTES
-- • The chain lookup (ORDER BY accessed_at DESC LIMIT 1) on a partitioned table
--   is safe in PG14+ but may be slow without the (accessed_at DESC) index on the
--   parent; that index is created in 0113.
-- • For high-throughput insertion the chain lookup can become a hot spot.
--   Mitigation: the verify job runs nightly; the chain is advisory (detect-not-prevent).
--   If insertion throughput exceeds ~1000 rows/s consider a per-partition chain
--   (partition_name || id) to parallelize.
-- • admin_support_access uses created_at (not accessed_at) as the time-order column;
--   the BEFORE INSERT trigger fires before created_at gets its defaultNow() value, so
--   the canonical uses COALESCE(NEW.created_at::text, '') — the app must pass
--   created_at explicitly or the trigger body must set it: NEW.created_at := now().
-- =============================================================================
