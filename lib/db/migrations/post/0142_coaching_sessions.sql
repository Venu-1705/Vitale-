-- =============================================================================
-- Vitalé — Migration post/0142: coaching_sessions (coach ↔ client scheduled sessions + Zoom)
-- -----------------------------------------------------------------------------
-- The dedicated backend for the coaching-session calendar (mobile previously rendered
-- this from a client-side mock). Drizzle owns the table model (lib/db/src/schema/sessions.ts);
-- this companion carries what Drizzle cannot express: the CREATE TABLE (idempotent so a fresh
-- db:raw run also builds it), the status CHECK, RLS + grants, and the updated_at touch trigger.
--
-- Authorization (org-scoped, RLS-ON like the D9 collaboration_* tables):
--   • SELECT  — the client (client_user_id = auth.uid()) OR an org coach with manage_programs.
--   • INSERT/UPDATE — an org coach with manage_programs. The Zoom attach (POST /sessions/:id/zoom)
--     is an UPDATE, so it is gated by the same coach policy.
-- Apply order: after the Drizzle migrate step + 0005 (is_org_member) + 0004 (tg_touch_updated_at).
-- Idempotent: CREATE TABLE IF NOT EXISTS; DROP ... IF EXISTS before every policy/trigger.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.coaching_sessions (
  id                uuid PRIMARY KEY,                       -- app-supplied uuidv7 (no DB default)
  organization_id   uuid NOT NULL REFERENCES public.coach_organizations(id),
  coach_user_id     uuid NOT NULL REFERENCES public.users(id),
  client_user_id    uuid NOT NULL REFERENCES public.users(id),
  title             text NOT NULL,
  description       text,
  scheduled_at      timestamptz NOT NULL,
  duration_minutes  integer NOT NULL DEFAULT 30,
  status            text NOT NULL DEFAULT 'scheduled',
  zoom_meeting_id   text,
  zoom_join_url     text,
  zoom_start_url    text,
  created_by        uuid NOT NULL REFERENCES public.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coaching_sessions_status_chk
    CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS coaching_sessions_client_scheduled_idx
  ON public.coaching_sessions (client_user_id, scheduled_at);
CREATE INDEX IF NOT EXISTS coaching_sessions_org_scheduled_idx
  ON public.coaching_sessions (organization_id, scheduled_at);
CREATE INDEX IF NOT EXISTS coaching_sessions_coach_scheduled_idx
  ON public.coaching_sessions (coach_user_id, scheduled_at);

-- ── RLS ────────────────────────────────────────────────────────────────────────
ALTER TABLE public.coaching_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL    ON public.coaching_sessions FROM anon, authenticated;
GRANT  SELECT, INSERT, UPDATE ON public.coaching_sessions TO authenticated;

-- SELECT — the client sees their own sessions; org coaches (manage_programs) see the org's.
DROP POLICY IF EXISTS coaching_sessions_select ON public.coaching_sessions;
CREATE POLICY coaching_sessions_select ON public.coaching_sessions FOR SELECT TO authenticated
  USING (
    client_user_id = auth.uid()
    OR public.is_org_member(organization_id, 'manage_programs')
  );

-- INSERT — an org coach with manage_programs creates the session (authored by self).
DROP POLICY IF EXISTS coaching_sessions_insert ON public.coaching_sessions;
CREATE POLICY coaching_sessions_insert ON public.coaching_sessions FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id, 'manage_programs')
    AND created_by = auth.uid()
  );

-- UPDATE — an org coach with manage_programs (covers status changes + the Zoom attach).
DROP POLICY IF EXISTS coaching_sessions_update ON public.coaching_sessions;
CREATE POLICY coaching_sessions_update ON public.coaching_sessions FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, 'manage_programs'))
  WITH CHECK (public.is_org_member(organization_id, 'manage_programs'));

-- ── updated_at touch trigger ─────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS coaching_sessions_touch ON public.coaching_sessions;
CREATE TRIGGER coaching_sessions_touch BEFORE UPDATE ON public.coaching_sessions
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
