-- =============================================================================
-- Vitalé — Post-companion 0132: rpc_update_health_observation (D5 owner self-correction)
-- Ground truth: VITALE_IMPLEMENTATION_SPEC Part 2 D5 (line 736 "UPDATE/DELETE owner only" +
-- the ho_update_owner policy, line 780) + §4.2 (health_observations is REVOKE-API; the raw
-- client holds INSERT+UPDATE but NO SELECT — reads go through rpc_read_health_observations).
--
-- Why this RPC exists (defect found in D5 live validation):
--   ho_update_owner is FOR UPDATE TO authenticated USING/ WITH CHECK (subject_user_id = auth.uid()),
--   and 0131 GRANTs UPDATE to authenticated. But a direct `UPDATE … WHERE id = $1` is rejected with
--   "permission denied for table health_observations": PostgreSQL requires SELECT privilege on every
--   column read to evaluate the WHERE/targeting, and health_observations is REVOKE-API (SELECT is
--   intentionally NOT granted — granting it would let a coach read PHI directly, bypassing the
--   audited rpc_read_health_observations). So the owner UPDATE path is unusable from a raw client
--   for the same reason the read path is: no SELECT grant. The architecture's answer for row access
--   on a REVOKE-API table is a SECURITY DEFINER RPC. This is the write sibling of the read RPCs:
--   it re-enforces the ho_update_owner predicate (owner only) in the definer body and performs the
--   correction. Owner self-correction is NOT coach/admin data access → NOT audited (mirrors the
--   self path of rpc_read_health_observations, which is also unaudited).
--
-- Correction model: a correction RESTATES the reading — exactly one of value_numeric / value_bool /
-- value_text must be supplied (the table CHECK num_nonnulls(...) = 1 enforces this), and the RPC
-- replaces the whole value triplet so the post-state still holds exactly one value. unit is
-- replaced when p_unit is provided, otherwise left unchanged. measured_at / measured_date_ist /
-- source / subject are NOT correctable here (those define identity & partition routing; a wrong
-- timestamp is a new reading, not a value correction).
--
-- SECURITY DEFINER + owned by the BYPASSRLS migration role (default owner `v`, same as the read
-- RPCs): the definer context both SELECTs and UPDATEs the REVOKE-API table. The owner gate is
-- enforced on auth.uid() inside the body, so EXECUTE may be granted to authenticated.
--
-- Idempotent: CREATE OR REPLACE; grants re-runnable. Apply order: after 0131 (policies + grants).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_update_health_observation(
  p_id            uuid,
  p_value_numeric numeric DEFAULT NULL,
  p_value_bool    boolean DEFAULT NULL,
  p_value_text    text    DEFAULT NULL,
  p_unit          text    DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_rows   integer;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'rpc_update_health_observation: no caller identity' USING ERRCODE = '42501';
  END IF;

  -- Exactly one value must be supplied (mirrors the table CHECK; fail fast & clearly).
  IF num_nonnulls(p_value_numeric, p_value_bool, p_value_text) <> 1 THEN
    RAISE EXCEPTION 'rpc_update_health_observation: exactly one of value_numeric/value_bool/value_text required'
      USING ERRCODE = '23514';  -- check_violation → business_rule → 422
  END IF;

  -- Owner-only correction (re-enforces ho_update_owner: subject_user_id = auth.uid()). The whole
  -- value triplet is replaced so num_nonnulls stays 1; unit replaced only when explicitly provided.
  UPDATE public.health_observations ho
     SET value_numeric = p_value_numeric,
         value_bool    = p_value_bool,
         value_text    = p_value_text,
         unit          = COALESCE(p_unit, ho.unit)
   WHERE ho.id = p_id
     AND ho.subject_user_id = v_caller;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;  -- 0 ⇒ row not found or not owned by caller (router maps to 404)
END;
$$;

-- Gate is enforced on auth.uid() inside the body → safe to grant to authenticated.
REVOKE ALL ON FUNCTION public.rpc_update_health_observation(uuid, numeric, boolean, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rpc_update_health_observation(uuid, numeric, boolean, text, text) TO authenticated;
