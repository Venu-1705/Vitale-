-- =============================================================================
-- 0145 — Per-coach Zoom OAuth credentials
-- -----------------------------------------------------------------------------
-- Replaces the single platform-level S2S OAuth setup with per-coach tokens.
-- Each coach who connects their Zoom account via OAuth gets a row here with
-- their access/refresh tokens. The API server uses these to create meetings
-- under the coach's own Zoom identity.
--
-- RLS: coaches read/manage only their own row.
-- Service role (BYPASSRLS) handles token refresh on the server side.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.coach_zoom_credentials (
  id               uuid NOT NULL DEFAULT public.uuidv7(),
  coach_user_id    uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id  uuid NOT NULL REFERENCES public.coach_organizations(id) ON DELETE CASCADE,
  zoom_user_id     text NOT NULL,
  zoom_user_email  text NOT NULL,
  access_token     text NOT NULL,
  refresh_token    text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT coach_zoom_credentials_pkey PRIMARY KEY (id)
);

ALTER TABLE public.coach_zoom_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY czc_select ON public.coach_zoom_credentials
  FOR SELECT USING (coach_user_id = auth.uid());

CREATE POLICY czc_insert ON public.coach_zoom_credentials
  FOR INSERT WITH CHECK (coach_user_id = auth.uid());

CREATE POLICY czc_update ON public.coach_zoom_credentials
  FOR UPDATE USING (coach_user_id = auth.uid());

CREATE POLICY czc_delete ON public.coach_zoom_credentials
  FOR DELETE USING (coach_user_id = auth.uid());

GRANT INSERT, SELECT, UPDATE, DELETE
  ON public.coach_zoom_credentials TO authenticated;

CREATE TRIGGER tg_touch_czc_updated_at
  BEFORE UPDATE ON public.coach_zoom_credentials
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
