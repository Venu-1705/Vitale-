-- =============================================================================
-- Vitalé — Post-companion 0137: D3 Programs lifecycle (CANONICAL, production-grade)
-- Ground truth: VITALE_DB_ARCHITECTURE §D3 (programs / program_versions / program_modules /
-- program_sessions / program_enrollments / session_watches) + VITALE_IMPLEMENTATION_SPEC.
--
-- WHAT THIS FILE OWNS (and why it supersedes 0124):
--   The 6 D3 tables (Drizzle-owned DDL) and the base RLS layer (0106 — helpers can_read_program /
--   can_manage_program, no-edit-while-enrolled, progress rollup, version immutability, touch,
--   self-read policies) are already live. The lifecycle triggers that 0106 deferred — publish→
--   version snapshot, enrollment→access_grant, completion/cancel→grant revoke — were sketched in
--   0124 but (a) were never applied to the live cluster and (b) failed the production bar:
--     • 0124's snapshot was {title,description,published_at} only — NOT the architecture-required
--       program+modules+sessions snapshot, so a published version could not reconstruct curriculum.
--     • 0124's enrollment grant granted ['health_data','programs'] — 'health_data' violates DPDP
--       data-minimization for a mere program enrollment (a course enrollment does not justify PHI
--       access). The correct grant is ['programs'] ONLY.
--   This file authors the correct, complete versions, REUSING 0124's function/trigger names so that
--   on any full `db:raw:post` re-run the lexically-later 0137 is authoritative. 0124 is neutralized
--   to a no-op stub in the same change set.
--
-- COACH-TRANSFER & COLLABORATION CONTRACT (design decision, enforced below):
--   • Ownership axiom — an enrollment is keyed (program_id, user_id), stamped organization_id = the
--     program's owning org. It is owned by the ORG + SUBJECT, never by an individual coach (there is
--     no coach_id). The enrollment grant is ORG→SUBJECT (grantee = the organization).
--   • Coach transfer / member removal — since no coach owns an enrollment or its grant, replacing a
--     coach has zero effect; a new org member with manage_programs inherits visibility through the
--     same grant-gated read branch. A future D2 member-removal cascade revokes only grants sourced
--     from that member's OWN relationships (care_plan / collaboration_agreement they hold), never
--     program_enrollment grants (which bind to the enrollment + org).
--   • Org ownership transfer (rpc_transfer_org_ownership) — operates at org level; organization_id
--     is unchanged → enrollments and grants are unaffected.
--   • Collaboration (cross-org, D9) — the coach read branch is OWNING-ORG-scoped
--     (is_org_member(enrollment.organization_id,'manage_programs') AND org_has_active_grant(SAME org,
--     user_id,'programs')). org_has_active_grant is source-type-agnostic, so a collaborating org that
--     holds a 'programs' grant on the subject from ITS OWN enrollment must not thereby see a different
--     org's program details — the membership clause prevents that over-share. Cross-org program
--     visibility is a deliberate D9 extension; D3's owning-org branch is a strict subset → no rework.
--   • Consent revocation — if the subject's 'programs' grant is revoked, org_has_active_grant returns
--     false → coaches lose read immediately, while the enrollment + progress rows persist (subject's
--     own data; self-read retained).
--
-- DEFERRALS (clean, single flip-point each — no architectural rework when they land):
--   • D8 Payments — paid enrollment (price_paise>0) raises a clear business_rule (422). The free path
--     (price_paise=0) is fully built. program_enrollments.payment_id stays nullable / no FK (Blocker-1).
--   • D15 Assets — programs.cover_asset_id / program_sessions.video_url stay plain uuid / text.
--
-- Idempotent: CREATE OR REPLACE; DROP … IF EXISTS; DROP POLICY IF EXISTS/CREATE POLICY.
-- Apply order: after migrate + after 0106/0112/0114 (lexical; all live). Owner = migration role `v`
-- (BYPASSRLS) → all SECURITY DEFINER bodies below run with RLS bypass on the tables they touch.
-- =============================================================================

-- =============================================================================
-- SECTION 1 — publish → full-curriculum version snapshot.
-- =============================================================================

-- build_program_snapshot(program_id) → the immutable, self-contained publish artifact:
--   { "program": {…identity & commercial fields…}, "modules": [ {…, "sessions": [ … ]} ] }
-- Ordered by sort_order at both levels. SECURITY DEFINER so it can read curriculum regardless of
-- the caller's RLS view (the publish trigger is the only caller).
CREATE OR REPLACE FUNCTION public.build_program_snapshot(p_program_id uuid)
  RETURNS jsonb
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'program', (
      SELECT to_jsonb(p)
        FROM (
          SELECT id, organization_id, title, slug, description, cover_asset_id,
                 price_paise, currency, duration_days, visibility, max_enrollments
            FROM public.programs WHERE id = p_program_id
        ) p
    ),
    'modules', COALESCE((
      SELECT jsonb_agg(q.m_obj ORDER BY q.sort_order)
        FROM (
          SELECT m.sort_order,
                 jsonb_build_object(
                   'id', m.id, 'title', m.title, 'description', m.description,
                   'sort_order', m.sort_order,
                   'sessions', COALESCE((
                     SELECT jsonb_agg(jsonb_build_object(
                              'id', s.id, 'title', s.title, 'content_type', s.content_type,
                              'video_url', s.video_url, 'content', s.content,
                              'duration_seconds', s.duration_seconds, 'sort_order', s.sort_order)
                            ORDER BY s.sort_order)
                       FROM public.program_sessions s WHERE s.module_id = m.id
                   ), '[]'::jsonb)
                 ) AS m_obj
            FROM public.program_modules m WHERE m.program_id = p_program_id
        ) q
    ), '[]'::jsonb)
  );
$$;

-- tg_bump_program_version — BEFORE INSERT OR UPDATE OF status. On any transition INTO 'published'
-- it (1) refuses an empty curriculum, (2) inserts the next program_versions row with a FULL snapshot,
-- (3) stamps current_version + published_at on the row being written. BEFORE (not AFTER) so the new
-- version number and published_at land on the same row without a re-entrant UPDATE. SECURITY DEFINER
-- (owner v) so the program_versions INSERT bypasses that table's append-only RLS/immutability.
-- Invariant guaranteed: a program is 'published' ⇒ exactly one matching program_versions snapshot
-- exists ⇒ enrollment can always stamp program_version_id (NOT NULL).
CREATE OR REPLACE FUNCTION public.tg_bump_program_version()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_next integer;
BEGIN
  IF NEW.status = 'published'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN

    -- A program cannot be published with no sessions. (On INSERT this is always true — curriculum
    -- rows cannot exist before the program row — so insert-as-published is rejected by design;
    -- the supported flow is draft → author curriculum → publish.)
    IF NOT EXISTS (SELECT 1 FROM public.program_sessions WHERE program_id = NEW.id) THEN
      RAISE EXCEPTION 'cannot publish program % — it has no sessions', NEW.id
        USING ERRCODE = '23514';  -- check_violation → 422
    END IF;

    SELECT COALESCE(MAX(version_number), 0) + 1
      INTO v_next
      FROM public.program_versions
     WHERE program_id = NEW.id;

    INSERT INTO public.program_versions
      (id, program_id, version_number, snapshot, created_by_user_id, change_summary)
    VALUES
      (uuidv7(), NEW.id, v_next, public.build_program_snapshot(NEW.id),
       COALESCE(auth.uid(), NEW.created_by_user_id),
       'Published v' || v_next);

    NEW.current_version := v_next;
    NEW.published_at    := COALESCE(NEW.published_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS programs_bump_version ON public.programs;
CREATE TRIGGER programs_bump_version
  BEFORE INSERT OR UPDATE OF status ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.tg_bump_program_version();

-- =============================================================================
-- SECTION 2 — progress rollup + auto-completion.
-- =============================================================================

-- tg_rollup_progress — AFTER INSERT OR UPDATE ON session_watches. Recomputes the enrollment's
-- progress_pct from completed watches over total sessions in the program, stamps started_at on first
-- activity, and AUTO-COMPLETES (status active→completed, completed_at) when progress reaches 100.
-- The status change cascades into tg_enrollment_complete_cascade (Section 4). SECURITY DEFINER
-- (owner v) so it can UPDATE program_enrollments (which has no UPDATE grant to authenticated).
CREATE OR REPLACE FUNCTION public.tg_rollup_progress()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_total integer;
  v_done  integer;
  v_pct   smallint;
BEGIN
  SELECT count(*) INTO v_total
    FROM public.program_sessions s
    JOIN public.program_enrollments e ON e.program_id = s.program_id
   WHERE e.id = NEW.enrollment_id;

  SELECT count(*) INTO v_done
    FROM public.session_watches w
   WHERE w.enrollment_id = NEW.enrollment_id AND w.completed = true;

  v_pct := CASE WHEN COALESCE(v_total, 0) = 0
                THEN 0
                ELSE LEAST(100, round(100.0 * v_done / v_total))::smallint END;

  UPDATE public.program_enrollments e
     SET progress_pct = v_pct,
         started_at   = COALESCE(e.started_at, now()),
         status       = CASE WHEN v_pct >= 100 AND e.status = 'active'
                             THEN 'completed'::enrollment_status ELSE e.status END,
         completed_at = CASE WHEN v_pct >= 100 AND e.status = 'active'
                             THEN now() ELSE e.completed_at END
   WHERE e.id = NEW.enrollment_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS session_watches_rollup_progress ON public.session_watches;
CREATE TRIGGER session_watches_rollup_progress
  AFTER INSERT OR UPDATE ON public.session_watches
  FOR EACH ROW EXECUTE FUNCTION public.tg_rollup_progress();

-- =============================================================================
-- SECTION 3 — enrollment → access_grant (DPDP-minimized, consent-gated).
-- =============================================================================

-- tg_enrollment_grant — AFTER INSERT. An active enrollment justifies the OWNING ORG holding a
-- view-only grant on the SUBJECT for the 'programs' category ONLY (no PHI — DPDP minimization).
-- The grant is created only when the subject already has a live consent record; the enroll RPC
-- (Section 6) pre-checks this and returns a clean 'consent_required' so a caller never sees a raw
-- gate failure. The DB consent gate (access_grants_require_consent) remains the hard backstop.
-- Source-bound (source_id = enrollment id) so each enrollment owns exactly one grant — revocation
-- (Section 4) never over-revokes a sibling enrollment's access.
CREATE OR REPLACE FUNCTION public.tg_enrollment_grant()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status = 'active'
     AND EXISTS (SELECT 1 FROM public.dpdp_consent_records
                  WHERE user_id = NEW.user_id AND granted = true) THEN
    INSERT INTO public.access_grants
      (id, organization_id, user_id, source_type, source_id,
       data_categories_granted, grant_type, access_level, status, start_date)
    VALUES
      (uuidv7(), NEW.organization_id, NEW.user_id, 'program_enrollment', NEW.id,
       ARRAY['programs']::grant_data_category[], 'primary', 'view_only', 'active',
       (now() AT TIME ZONE 'Asia/Kolkata')::date)
    ON CONFLICT (organization_id, user_id, source_type, source_id)
      WHERE status = 'active' DO NOTHING;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS program_enrollments_grant ON public.program_enrollments;
CREATE TRIGGER program_enrollments_grant
  AFTER INSERT ON public.program_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.tg_enrollment_grant();

-- =============================================================================
-- SECTION 4 — completion / cancellation → grant lifecycle.
-- =============================================================================

-- tg_enrollment_complete_cascade — AFTER UPDATE OF status. The enrollment grant follows the
-- relationship: it is REVOKED when the enrollment ends as 'cancelled' or 'expired' (the engagement
-- is over), but RETAINED on 'completed' (a finished program is a valid past engagement the coach
-- should still be able to review). Source-bound revoke → only THIS enrollment's grant is touched.
CREATE OR REPLACE FUNCTION public.tg_enrollment_complete_cascade()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.status = 'active' AND NEW.status IN ('cancelled', 'expired') THEN
    UPDATE public.access_grants
       SET status = 'revoked', revoked_at = now(),
           revoked_by = COALESCE(auth.uid(), NEW.user_id)
     WHERE organization_id = NEW.organization_id
       AND user_id = NEW.user_id
       AND source_type = 'program_enrollment'
       AND source_id = NEW.id
       AND status = 'active';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS program_enrollments_complete_cascade ON public.program_enrollments;
CREATE TRIGGER program_enrollments_complete_cascade
  AFTER UPDATE OF status ON public.program_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.tg_enrollment_complete_cascade();

-- =============================================================================
-- SECTION 5 — coach (owning-org, grant-gated) read branches.
-- =============================================================================
-- These are PERMISSIVE additions OR'd with the existing self-read policies (0106). They implement
-- the coach-transfer/collaboration contract documented in the header: read requires membership in
-- the enrollment's OWNING org with manage_programs AND an active 'programs' grant on the subject.

DROP POLICY IF EXISTS program_enrollments_select_coach ON public.program_enrollments;
CREATE POLICY program_enrollments_select_coach ON public.program_enrollments
  FOR SELECT TO authenticated
  USING (
    is_org_member(organization_id, 'manage_programs')
    AND org_has_active_grant(organization_id, user_id, 'programs')
  );

DROP POLICY IF EXISTS session_watches_select_coach ON public.session_watches;
CREATE POLICY session_watches_select_coach ON public.session_watches
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.program_enrollments e
       WHERE e.id = session_watches.enrollment_id
         AND is_org_member(e.organization_id, 'manage_programs')
         AND org_has_active_grant(e.organization_id, e.user_id, 'programs')
    )
  );

-- =============================================================================
-- SECTION 6 — enrollment write RPCs (program_enrollments is SELECT-only to authenticated).
-- =============================================================================

-- rpc_enroll_in_program — the authoritative, atomic enroll path. Validates published + visible +
-- capacity + consent + free-only (D8 deferral), resolves the current published version, inserts the
-- enrollment (which fires Section 3's grant). Returns the new enrollment row as jsonb.
--   • 401 (42501) no caller identity.
--   • 404 (P0002) program not found OR not published (not-enrollable — we do not leak existence).
--   • 409 (23505) already actively enrolled (partial-unique).
--   • 422 (P0001) paid program (payment_required), no consent (consent_required), or at capacity.
-- SECURITY DEFINER (owner v): inserts into the SELECT-only table and lets the triggers run; the
-- caller gate is enforced on auth.uid() inside the body, so EXECUTE is granted to authenticated.
CREATE OR REPLACE FUNCTION public.rpc_enroll_in_program(p_program_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_prog   public.programs%ROWTYPE;
  v_ver_id uuid;
  v_active integer;
  v_id     uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'rpc_enroll_in_program: no caller identity' USING ERRCODE = '42501';
  END IF;

  -- Lock the program row so concurrent enrollments to the same program serialize for the capacity
  -- check (prevents over-filling max_enrollments under races).
  SELECT * INTO v_prog FROM public.programs WHERE id = p_program_id FOR UPDATE;
  IF NOT FOUND OR v_prog.status <> 'published' THEN
    RAISE EXCEPTION 'program % is not available for enrollment', p_program_id USING ERRCODE = 'P0002';
  END IF;

  -- D8 Payments deferred: only free programs are enrollable today.
  IF v_prog.price_paise > 0 THEN
    RAISE EXCEPTION 'payment_required: enrollment in a paid program is not available until Payments (D8) lands';
  END IF;

  -- DPDP: the org→subject 'programs' grant minted on enrollment requires the subject's live consent.
  IF NOT EXISTS (SELECT 1 FROM public.dpdp_consent_records
                  WHERE user_id = v_caller AND granted = true) THEN
    RAISE EXCEPTION 'consent_required: enrollment requires an active data-processing consent on file';
  END IF;

  -- Capacity (NULL max_enrollments = unlimited).
  IF v_prog.max_enrollments IS NOT NULL THEN
    SELECT count(*) INTO v_active
      FROM public.program_enrollments
     WHERE program_id = p_program_id AND status = 'active';
    IF v_active >= v_prog.max_enrollments THEN
      RAISE EXCEPTION 'program % is at capacity', p_program_id;
    END IF;
  END IF;

  -- Stamp the current published version (guaranteed to exist by tg_bump_program_version).
  SELECT id INTO v_ver_id
    FROM public.program_versions
   WHERE program_id = p_program_id AND version_number = v_prog.current_version;
  IF v_ver_id IS NULL THEN
    RAISE EXCEPTION 'program % has no published version to enroll into', p_program_id USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.program_enrollments
    (id, program_id, program_version_id, organization_id, user_id, status, progress_pct)
  VALUES
    (uuidv7(), p_program_id, v_ver_id, v_prog.organization_id, v_caller, 'active', 0)
  RETURNING id INTO v_id;

  RETURN (
    SELECT to_jsonb(e) FROM public.program_enrollments e WHERE e.id = v_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_enroll_in_program(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rpc_enroll_in_program(uuid) TO authenticated;

-- rpc_cancel_enrollment — caller cancels their OWN active enrollment. active→cancelled fires the
-- Section 4 cascade (grant revoke). Idempotent-ish: a non-active or non-owned row → 404/422.
--   • 401 (42501) no identity. 404 (P0002) not found / not owned. 422 (P0001) not active.
CREATE OR REPLACE FUNCTION public.rpc_cancel_enrollment(p_enrollment_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_status enrollment_status;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'rpc_cancel_enrollment: no caller identity' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_status
    FROM public.program_enrollments
   WHERE id = p_enrollment_id AND user_id = v_caller;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'enrollment % not found', p_enrollment_id USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'enrollment % is not active (status=%)', p_enrollment_id, v_status;
  END IF;

  UPDATE public.program_enrollments
     SET status = 'cancelled', cancelled_at = now()
   WHERE id = p_enrollment_id AND user_id = v_caller;

  RETURN (
    SELECT to_jsonb(e) FROM public.program_enrollments e WHERE e.id = p_enrollment_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_cancel_enrollment(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rpc_cancel_enrollment(uuid) TO authenticated;
