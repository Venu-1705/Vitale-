-- =============================================================================
-- Vitalé — Migration 0005: RLS helper functions (capability / grant / care-team algebra)
-- Phase 1 (Database Foundations) · Implements VITALE_IMPLEMENTATION_SPEC Part 3 §3.2
-- verbatim, incl. the Blocker-3 rewritten shares_active_context(). Part 6 Phase 1 (0005).
--
-- All helpers: SECURITY DEFINER, SET search_path = public, pg_temp (fixed — High finding),
-- fully schema-qualified, STABLE (read-only within a statement). GRANT EXECUTE to authenticated.
--
-- ORDERING MECHANISM: these are LANGUAGE sql, whose bodies Postgres validates at CREATE
-- time. They reference tables built in later phases (organization_members, access_grants,
-- care_plans, care_team_members, community_memberships, program_enrollments,
-- admin_support_access, users). We therefore disable body validation for this migration so
-- the helpers can be created in Phase 1 as the spec dictates; they are not CALLED until the
-- RLS policies that use them are added in their domain phases (by which point the tables
-- exist). This is the standard Supabase pattern for forward-referencing helper SQL.
--
-- HARDENING NOTE (deferred to Phase 10): functions are SECURITY DEFINER owned by the
-- migration role here. Transferring ownership to the low-privilege `rls_owner` and granting
-- it only the minimal SELECTs requires the referenced tables to exist, so it is applied in a
-- later migration. The `rls_owner` NOLOGIN role is created now so it can be referenced.
--
-- Apply order: after 0004_fn_library. Idempotent: CREATE OR REPLACE; role create guarded.
-- =============================================================================

SET check_function_bodies = off;   -- allow forward references to not-yet-created tables

-- Low-privilege owner for SECURITY DEFINER helpers (defense-in-depth). Ownership transfer
-- + minimal grants happen in a Phase-10 hardening migration once target tables exist.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rls_owner') THEN
    CREATE ROLE rls_owner NOLOGIN;
  END IF;
END $$;

-- current identity (thin wrapper, lets policies read claims once)
CREATE OR REPLACE FUNCTION public.current_user_id() RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT auth.uid() $$;

-- platform admin (coarse flag)
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u
                 WHERE u.id = auth.uid() AND 'admin' = ANY(u.roles)
                   AND u.status = 'active');
$$;

-- owner => all caps; else an explicit permission row; member MUST be active
CREATE OR REPLACE FUNCTION public.has_capability(p_member uuid, p_cap public.coach_capability)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.id = p_member AND m.status = 'active'             -- liveness (Critical)
      AND ( m.member_role = 'owner_coach'                     -- owner => implicit all
            OR EXISTS (SELECT 1 FROM public.organization_member_permissions p
                       WHERE p.member_id = m.id AND p.capability = p_cap)));
$$;

-- caller is an ACTIVE member of org holding cap
CREATE OR REPLACE FUNCTION public.is_org_member(p_org uuid, p_cap public.coach_capability)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = p_org AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND ( m.member_role = 'owner_coach'
            OR EXISTS (SELECT 1 FROM public.organization_member_permissions p
                       WHERE p.member_id = m.id AND p.capability = p_cap)));
$$;

-- live, unexpired grant for a category
CREATE OR REPLACE FUNCTION public.org_has_active_grant(p_org uuid, p_subject uuid,
                                            p_cat public.grant_data_category)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.access_grants g
    WHERE g.organization_id = p_org AND g.user_id = p_subject
      AND g.status = 'active'
      AND (g.end_date IS NULL OR g.end_date > now())
      AND p_cat = ANY(g.data_categories_granted));
$$;

-- per-customer care-team scope intersection
CREATE OR REPLACE FUNCTION public.on_care_team(p_subject uuid, p_cap public.coach_capability)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.care_plans cp
    JOIN public.care_team_members ctm ON ctm.care_plan_id = cp.id
    WHERE cp.user_id = p_subject AND ctm.member_user_id = auth.uid()
      AND ctm.status = 'active' AND cp.status = 'active'       -- liveness (Critical)
      AND p_cap = ANY(ctm.capabilities));
$$;

-- the three-layer health gate: grant ∩ member-cap ∩ (care-team when a plan exists)
CREATE OR REPLACE FUNCTION public.can_read_health(p_subject uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT
    -- self
    (p_subject = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organization_members m
      JOIN public.access_grants g
        ON g.organization_id = m.organization_id AND g.user_id = p_subject
      WHERE m.user_id = auth.uid() AND m.status = 'active'
        AND g.status = 'active' AND (g.end_date IS NULL OR g.end_date > now())
        AND 'health_data' = ANY(g.data_categories_granted)
        AND ( m.member_role = 'owner_coach'
              OR EXISTS (SELECT 1 FROM public.organization_member_permissions p
                         WHERE p.member_id = m.id AND p.capability = 'view_client_health'))
        -- when a care plan exists for this subject, require care-team membership too
        AND ( NOT EXISTS (SELECT 1 FROM public.care_plans cp
                          WHERE cp.user_id = p_subject AND cp.status = 'active')
              OR public.on_care_team(p_subject, 'view_client_health')));
$$;

-- peer messaging gate: co-membership of a community or program cohort (Blocker 3 rewrite)
CREATE OR REPLACE FUNCTION public.shares_active_context(p_a uuid, p_b uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT
    EXISTS ( -- (Blocker 3) same org community: both hold an ACTIVE community_memberships row
      SELECT 1 FROM public.community_memberships ma
      JOIN public.community_memberships mb
        ON mb.organization_id = ma.organization_id
      WHERE ma.user_id = p_a AND mb.user_id = p_b
        AND ma.status = 'active' AND mb.status = 'active')
    OR EXISTS ( -- same active program cohort
      SELECT 1 FROM public.program_enrollments ea
      JOIN public.program_enrollments eb ON eb.program_id = ea.program_id
      WHERE ea.user_id = p_a AND eb.user_id = p_b
        AND ea.status = 'active' AND eb.status = 'active');
$$;

-- active, unexpired admin support case
CREATE OR REPLACE FUNCTION public.admin_has_support_access(p_subject uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.is_admin() AND EXISTS (
    SELECT 1 FROM public.admin_support_access a
    WHERE a.subject_user_id = p_subject AND a.status = 'active'
      AND a.expires_at > now()
      AND (a.requested_by_admin_id = auth.uid() OR a.approved_by_admin_id = auth.uid()));
$$;

-- Execute grants for the app identity. (anon intentionally excluded.)
GRANT EXECUTE ON FUNCTION
  public.current_user_id(),
  public.is_admin(),
  public.has_capability(uuid, public.coach_capability),
  public.is_org_member(uuid, public.coach_capability),
  public.org_has_active_grant(uuid, uuid, public.grant_data_category),
  public.on_care_team(uuid, public.coach_capability),
  public.can_read_health(uuid),
  public.shares_active_context(uuid, uuid),
  public.admin_has_support_access(uuid)
TO authenticated;

RESET check_function_bodies;
