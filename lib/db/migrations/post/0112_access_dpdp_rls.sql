-- =============================================================================
-- Vitalé — Post-companion 0112: D2 Access Control & DPDP (net-new tables)
-- Ground truth: VITALE_DB_ARCHITECTURE §4 D2 (lines 242-278) + VITALE_IMPLEMENTATION_SPEC
-- Part 2 D2 (lines 234-272).
--
-- Tables (Drizzle-owned DDL in lib/db/src/schema/access.ts), all RLS-FORCE:
--   data_deletion_requests [B] — DPDP right-to-erasure. SELECT subject+admin; INSERT subject; the
--                                requested→processing→completed|rejected transitions run via a
--                                service-role RPC (status-machine guard below + tg_touch_updated_at).
--   admin_support_access   [B] — REVOKE-API. The ONLY admin→PHI path (self|dual|break_glass + post-
--                                review). INSERT by an admin recording themselves as requester; reads
--                                and approve/review/revoke transitions go through audited/service-role
--                                RPCs (Phase 8). Closes the admin_has_support_access() fwd-ref (0005).
--   dpdp_consent_records   [B immutable] — REVOKE-API + IMMUT-BLOCK. Append-only consent ledger;
--                                a revocation is a NEW row, never an edit.
--
-- The other two D2 tables are deferred to Phase 8 (they collide with the legacy users.ts shapes that
-- labs.ts + scripts/seed.ts still import): the new-shape access_grants (Drizzle) and the partitioned
-- coach_data_access_audit (raw-only). Until those land, the audited read RPCs referenced below are
-- not yet present → these REVOKE-API tables are INSERT-only via the API, the safe default.
--
-- Reuses foundation helpers: is_admin (0005); tg_touch_updated_at / tg_block_update_delete (0004).
-- Apply order: after the Drizzle migrate step; lexical order places it after 0111. No forward
-- references in this file's own function bodies, so no check_function_bodies toggle is needed.
--
-- Idempotent: CREATE OR REPLACE; DROP ... IF EXISTS before every trigger/policy.
-- =============================================================================

-- ============================================================================
-- SECTION 1 — trigger functions (row-local only → plain plpgsql, no SECURITY DEFINER; search_path
-- pinned for hygiene). None query other tables, so no GRANT EXECUTE is required.
-- ============================================================================

-- admin_support_access: dual mode demands a SECOND, DISTINCT approver. The dual-approver CHECK on the
-- table is the hard guarantee; this BEFORE INSERT/UPDATE trigger raises a clear, specific error for
-- the API. self/break_glass need no approver here — their accountability is the mandatory post-review
-- (review_deadline + the admin_access_sla job).
CREATE OR REPLACE FUNCTION public.tg_enforce_support_approval()
  RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.approval_mode = 'dual'
     AND (NEW.approved_by_admin_id IS NULL OR NEW.approved_by_admin_id = NEW.requested_by_admin_id) THEN
    RAISE EXCEPTION 'admin_support_access: dual approval requires a distinct approved_by_admin_id (approver %, requester %)',
      NEW.approved_by_admin_id, NEW.requested_by_admin_id;
  END IF;
  RETURN NEW;
END;
$$;

-- admin_support_access: Blocker 6 — self/break_glass cases carry a machine-readable post-review
-- deadline, computed at INSERT from the grant moment + the policy review window (launch default
-- below; configurable per arch §7 with NO schema change). dual cases need no post-review → the
-- deadline stays NULL (allowed by the review_deadline CHECK). requested_at is NOT NULL (default
-- now()), so the COALESCE is never NULL for self/break_glass and the CHECK always passes.
CREATE OR REPLACE FUNCTION public.tg_set_review_deadline()
  RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.approval_mode IN ('self', 'break_glass') THEN
    NEW.review_deadline := COALESCE(NEW.granted_at, NEW.requested_at) + INTERVAL '24 hours';
  END IF;
  RETURN NEW;
END;
$$;

-- data_deletion_requests: DPDP erasure lifecycle is requested → processing → completed | rejected.
-- No transition out of a terminal state; no jumping straight to completed. (Service-role RPCs drive
-- the transitions; a same-status UPDATE — e.g. a touch — is allowed.)
CREATE OR REPLACE FUNCTION public.tg_deletion_status_machine()
  RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (
       (OLD.status = 'requested'  AND NEW.status = 'processing')
       OR (OLD.status = 'processing' AND NEW.status IN ('completed', 'rejected'))
     ) THEN
    RAISE EXCEPTION 'invalid data_deletion_requests status transition: % -> %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- SECTION 2 — enable RLS-FORCE on all three (owner cannot bypass; compliance access boundary).
-- ============================================================================
ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_deletion_requests FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.admin_support_access   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_support_access   FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.dpdp_consent_records   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dpdp_consent_records   FORCE  ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 3 — triggers.
-- ============================================================================
-- data_deletion_requests: validate the lifecycle transition, then touch updated_at.
DROP TRIGGER IF EXISTS data_deletion_requests_status_machine ON public.data_deletion_requests;
CREATE TRIGGER data_deletion_requests_status_machine BEFORE UPDATE ON public.data_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_deletion_status_machine();
DROP TRIGGER IF EXISTS data_deletion_requests_touch ON public.data_deletion_requests;
CREATE TRIGGER data_deletion_requests_touch BEFORE UPDATE ON public.data_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- admin_support_access: enforce dual approval (INSERT+UPDATE); set the review deadline (INSERT only,
-- Blocker 6); touch updated_at (UPDATE).
DROP TRIGGER IF EXISTS admin_support_access_enforce_approval ON public.admin_support_access;
CREATE TRIGGER admin_support_access_enforce_approval BEFORE INSERT OR UPDATE ON public.admin_support_access
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_support_approval();
DROP TRIGGER IF EXISTS admin_support_access_set_review_deadline ON public.admin_support_access;
CREATE TRIGGER admin_support_access_set_review_deadline BEFORE INSERT ON public.admin_support_access
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_review_deadline();
DROP TRIGGER IF EXISTS admin_support_access_touch ON public.admin_support_access;
CREATE TRIGGER admin_support_access_touch BEFORE UPDATE ON public.admin_support_access
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- dpdp_consent_records IMMUT-BLOCK: append-only. UPDATE/DELETE denied to ALL roles (a revocation is
-- a new ledger row).
DROP TRIGGER IF EXISTS dpdp_consent_records_immutable ON public.dpdp_consent_records;
CREATE TRIGGER dpdp_consent_records_immutable BEFORE UPDATE OR DELETE ON public.dpdp_consent_records
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_update_delete();

-- ============================================================================
-- SECTION 4 — table privileges.
--   data_deletion_requests: SELECT+INSERT (subject reads own + creates; transitions are service-role).
--   admin_support_access:   REVOKE-API → INSERT only (admin records a case); SELECT/UPDATE via audited
--                           + service-role RPCs (Phase 8). No direct client SELECT.
--   dpdp_consent_records:   REVOKE-API → INSERT only (append a consent event); SELECT via audited RPC.
-- ============================================================================
REVOKE ALL ON public.data_deletion_requests FROM anon, authenticated;
REVOKE ALL ON public.admin_support_access   FROM anon, authenticated;
REVOKE ALL ON public.dpdp_consent_records   FROM anon, authenticated;

GRANT SELECT, INSERT ON public.data_deletion_requests TO authenticated;
GRANT INSERT         ON public.admin_support_access   TO authenticated; -- REVOKE-API: no SELECT grant
GRANT INSERT         ON public.dpdp_consent_records   TO authenticated; -- REVOKE-API: no SELECT grant

-- ============================================================================
-- SECTION 5 — policies (all TO authenticated).
-- ============================================================================

-- data_deletion_requests — subject sees/creates their own erasure request; admins may read (to
-- process). The requested→processing→completed|rejected transitions are service-role (BYPASSRLS),
-- so no UPDATE policy is exposed to authenticated.
DROP POLICY IF EXISTS data_deletion_requests_select ON public.data_deletion_requests;
CREATE POLICY data_deletion_requests_select ON public.data_deletion_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS data_deletion_requests_insert ON public.data_deletion_requests;
CREATE POLICY data_deletion_requests_insert ON public.data_deletion_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- admin_support_access — admins only. SELECT is REVOKED above (REVOKE-API) so this policy is not
-- reachable by a raw client query; it documents/defends the predicate for the audited read RPC and
-- any non-bypassing reader. INSERT: an admin recording THEMSELVES as the requester. The dual-approver
-- invariant is the table CHECK + tg_enforce_support_approval; the review-deadline is tg_set_review_deadline.
DROP POLICY IF EXISTS admin_support_access_select ON public.admin_support_access;
CREATE POLICY admin_support_access_select ON public.admin_support_access FOR SELECT TO authenticated
  USING (public.is_admin());
DROP POLICY IF EXISTS admin_support_access_insert ON public.admin_support_access;
CREATE POLICY admin_support_access_insert ON public.admin_support_access FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND requested_by_admin_id = auth.uid());

-- dpdp_consent_records — the subject appends their own consent events; subject + admins may read.
-- SELECT is REVOKED above (REVOKE-API) → reads go through the audited RPC; this policy documents the
-- predicate. INSERT records the subject's own consent. UPDATE/DELETE are denied by IMMUT-BLOCK.
DROP POLICY IF EXISTS dpdp_consent_records_select ON public.dpdp_consent_records;
CREATE POLICY dpdp_consent_records_select ON public.dpdp_consent_records FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS dpdp_consent_records_insert ON public.dpdp_consent_records;
CREATE POLICY dpdp_consent_records_insert ON public.dpdp_consent_records FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- NOTES
-- • admin_has_support_access(subject) (0005) now resolves against admin_support_access: an admin has
--   access iff a LIVE case (status='active', expires_at > now()) names them as requester (self/
--   break_glass) or approver (dual). Every PHI read under such a case must emit a coach_data_access_audit
--   row acting_as='admin' (the audit RPCs land in Phase 8 with the new-shape audit table).
-- • review_deadline (Blocker 6) is the stored, machine-readable post-review SLA stamp; the Part-5
--   admin_access_sla job queries it directly (review_deadline < now()) instead of recomputing from
--   granted_at + config. The 24h launch default in tg_set_review_deadline is a policy value (arch §7).
-- • dpdp_consent_records is the consent ledger that the Phase-8 access_grants trigger
--   tg_require_consent_on_activate asserts against before activating a grant.
-- =============================================================================
