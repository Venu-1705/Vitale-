-- =============================================================================
-- Vitalé — Post-table migration 0129: rpc_transfer_org_ownership (Phase 1 / D0)
-- Implements VITALE_DB_ARCHITECTURE §"Ownership transfer = retarget owner_coach_id +
-- swap the owner_coach member row" and VITALE_IMPLEMENTATION_SPEC §D0
-- (coach_organizations: "ownership transfer via service-role RPC").
--
-- WHY AN RPC (not TypeScript): ownership transfer is an atomic, invariant-laden
-- operation that touches two tables and must satisfy three constraints at once —
--   • coach_organizations.UNIQUE(owner_coach_id)         (one org per coach, permanent)
--   • organization_members partial-unique owner seat      (one owner_coach row per org)
--   • organization_members partial-unique live (org,user) (one live membership per user)
--   • tg_sync_owner_member                                (owner row.user_id == org.owner_coach_id)
-- Doing this across round-trips from JS would be racy and would re-implement an
-- invariant the database already owns (Rules 2, 3, 9). It lives here, once.
--
-- AUTHORIZATION lives INSIDE the function (auth.uid() must be the current owner),
-- so it is GRANTed to `authenticated` and called in the caller's user-context
-- transaction (withUserContext) — NOT via service_role. SECURITY DEFINER is needed
-- only so the multi-table swap can bypass the per-table RLS write policies; it is
-- self-gated and therefore safe to expose to authenticated callers, exactly like the
-- rpc_read_* helpers (0120) which are also authenticated-granted and gate internally.
--
-- Apply order: after the D0 tables (organizations.ts) + 0101 (D0 RLS/triggers).
-- Idempotent: CREATE OR REPLACE.
-- =============================================================================

SET check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.rpc_transfer_org_ownership(
  p_org       uuid,
  p_new_owner uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_caller        uuid := auth.uid();
  v_current_owner uuid;
  v_owner_member  uuid;   -- id of the singleton owner_coach membership seat
  v_new_member    uuid;   -- id of the new owner's existing ACTIVE membership row
BEGIN
  -- Org must exist; lock it so the ownership pointer cannot move under us.
  SELECT owner_coach_id INTO v_current_owner
  FROM public.coach_organizations
  WHERE id = p_org
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'organization % not found', p_org
      USING ERRCODE = 'no_data_found';            -- P0002 → not_found → 404
  END IF;

  -- AUTHORIZATION: only the current owner may transfer (kept in the DB, not in JS).
  IF v_current_owner IS DISTINCT FROM v_caller THEN
    RAISE EXCEPTION 'only the current owner may transfer ownership'
      USING ERRCODE = 'insufficient_privilege';   -- 42501 → rls_denied → 403
  END IF;

  IF p_new_owner = v_current_owner THEN
    RAISE EXCEPTION 'new owner must differ from the current owner'
      USING ERRCODE = 'raise_exception';          -- P0001 → business_rule → 422
  END IF;

  -- New owner must already be an ACTIVE member of this org (transfer to insiders only).
  SELECT id INTO v_new_member
  FROM public.organization_members
  WHERE organization_id = p_org AND user_id = p_new_owner AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'new owner must be an active member of the organization'
      USING ERRCODE = 'raise_exception';          -- P0001 → business_rule → 422
  END IF;

  -- New owner must not already own a (different) org — the permanent single-owner rule.
  IF EXISTS (SELECT 1 FROM public.coach_organizations
             WHERE owner_coach_id = p_new_owner) THEN
    RAISE EXCEPTION 'new owner already owns an organization'
      USING ERRCODE = 'raise_exception';          -- P0001 → business_rule → 422
  END IF;

  -- The singleton owner seat (exactly one row WHERE member_role='owner_coach').
  SELECT id INTO v_owner_member
  FROM public.organization_members
  WHERE organization_id = p_org AND member_role = 'owner_coach'
  FOR UPDATE;

  -- 1. Archive the new owner's prior staff membership so the live (org,user) seat is
  --    free for the owner seat we are about to repoint at them.
  UPDATE public.organization_members
  SET status = 'removed', removed_at = now(), updated_at = now()
  WHERE id = v_new_member;

  -- 2. Retarget the org's ownership pointer FIRST — tg_sync_owner_member (step 3)
  --    requires the owner row's user_id to equal coach_organizations.owner_coach_id.
  UPDATE public.coach_organizations
  SET owner_coach_id = p_new_owner, updated_at = now()
  WHERE id = p_org;

  -- 3. Move the singleton owner seat to the new owner. The departing owner thereby
  --    relinquishes both ownership and membership (clean handoff; their prior owner
  --    row is now the new owner's). Exactly one owner_coach row persists throughout.
  UPDATE public.organization_members
  SET user_id = p_new_owner,
      joined_at = COALESCE(joined_at, now()),
      updated_at = now()
  WHERE id = v_owner_member;
END;
$$;

-- Self-gated SECURITY DEFINER RPC: callable by authenticated (gate is the auth.uid()
-- owner check inside); never by anon. Mirrors the rpc_read_* privilege shape (0120).
REVOKE ALL ON FUNCTION public.rpc_transfer_org_ownership(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_transfer_org_ownership(uuid, uuid) TO authenticated;

RESET check_function_bodies;
