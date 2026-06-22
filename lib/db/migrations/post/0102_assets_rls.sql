-- =============================================================================
-- Vitalé — Post-table migration 0102: D15 assets RLS, grants & touch trigger (Phase 3)
-- Implements VITALE_IMPLEMENTATION_SPEC Part 2 D15 + policy catalog (assets: read = via
-- owning-row policy + is_phi / signed-URL post-check; write = uploader / owning-row writers;
-- delete = uploader, PHI delete = anonymize) + VITALE_DB_ARCHITECTURE §4 D15 / §7.
--
-- ORDERING: this is a POST-TABLE companion. Apply order is:
--   1. `pnpm db:raw`        → foundation 0001–0006 (extensions, enums, fn library, helpers)
--   2. `pnpm generate && pnpm migrate` → Drizzle creates the assets table (assets.ts) —
--      columns/FKs/indexes (incl. the `(subject_user_id) WHERE is_phi` partial index)
--   3. `pnpm db:raw:post`   → THIS file: RLS enable/force, grants, policies, touch trigger
-- It references helpers from 0005 (is_admin) + 0101 (is_active_org_member) and the trigger
-- library from 0004 (tg_touch_updated_at), plus the assets table created in step 2.
--
-- THE PHI MEDIA GATEWAY (arch §4 D15): object storage is NOT under Postgres RLS. The API
-- mints a signed URL only AFTER a permission check on the OWNING row (users.avatar_asset_id,
-- organization_profiles.logo_asset_id, professional_profiles.photo_asset_id, and — later —
-- programs.cover_asset_id, lab_reports.report_asset_id), and (when is_phi) writes an audit
-- row. The assets-table policies below are therefore the DEFENCE-IN-DEPTH BACKSTOP for direct
-- (PostgREST) table access — keyed off the asset's own denormalized stakeholder columns
-- (uploaded_by_user_id / subject_user_id / organization_id / is_phi) — NOT the primary gate
-- for file serving. Broader "reachable via owning row" reads (public coach photos, program
-- covers, another user's avatar) are served by the API's owning-row check + service-role URL
-- minting, never by widening this direct-SELECT policy.
--
-- DPDP POSTURE: a PHI asset (is_phi) is reachable here ONLY by its uploader and its subject —
-- NEVER ambiently by org members, NEVER ambiently by admins (arch §4 D15: "never ambiently
-- by admins"). The coach three-layer health read (can_read_health) and time-boxed admin
-- support read (admin_has_support_access) are DEFERRED below — both call helpers whose bodies
-- query tables (access_grants / care_plans / care_team_members / admin_support_access) that do
-- not exist until later phases; calling them now would raise "relation does not exist" at
-- query time (OR branches are not guaranteed to short-circuit). Marked TODO.
--
-- Idempotent: CREATE OR REPLACE / DROP ... IF EXISTS before CREATE TRIGGER/POLICY.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Trigger attachment: touch updated_at (tg_touch_updated_at from 0004).
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS assets_touch ON public.assets;
CREATE TRIGGER assets_touch BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- TODO(Phase 3 health / Phase 8 erasure): tg_assets_retention_sweep is NOT a row trigger —
-- the retention purge (status→'deleted', object purge, PHI anonymize) is the scheduled
-- `asset_retention_sweep` job (spec Part 6 jobs), run as service-role (BYPASSRLS). It keys
-- off retention_until and the `assets_subject_phi_idx` partial index. Added with the jobs
-- module; nothing to attach here.

-- ----------------------------------------------------------------------------
-- RLS: ENABLE + FORCE (assets can hold PHI; a row is reachable via the owning row's policy +
-- is_phi, never ambiently by admins — so the table owner is subject to RLS too). Grant DML so
-- PostgREST (authenticated) can reach the table; policies below do the row filtering.
-- ----------------------------------------------------------------------------
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets FORCE  ROW LEVEL SECURITY;

-- No DELETE grant: soft-delete is an UPDATE (status='deleted' + deleted_at); the hard object
-- purge + PHI anonymization is the service-role retention sweep (BYPASSRLS), never a client
-- DELETE. Mirrors the users-table "anonymize, don't delete" posture in 0101.
GRANT SELECT, INSERT, UPDATE ON public.assets TO authenticated;

-- ----------------------------------------------------------------------------
-- Policies (TO authenticated). DROP IF EXISTS first for idempotency.
-- ----------------------------------------------------------------------------

-- SELECT (backstop): the asset's own stakeholders only.
--   • uploader            — always sees rows they created (needs bucket/path for lifecycle)
--   • subject             — the PHI subject sees assets about themselves
--   • org non-PHI         — active org members see their org's NON-PHI assets (logos, media)
--   • admin non-PHI       — admins see NON-PHI only; never ambient PHI (arch §4 D15)
-- PHI rows (is_phi) thus collapse to uploader OR subject — the DPDP-safe minimum.
DROP POLICY IF EXISTS assets_select ON public.assets;
CREATE POLICY assets_select ON public.assets FOR SELECT TO authenticated
  USING (
    uploaded_by_user_id = auth.uid()
    OR subject_user_id = auth.uid()
    OR (organization_id IS NOT NULL AND NOT is_phi AND public.is_active_org_member(organization_id))
    OR (public.is_admin() AND NOT is_phi)
    -- TODO(Phase 8 care): coach three-layer health read —
    --   OR (is_phi AND subject_user_id IS NOT NULL AND public.can_read_health(subject_user_id))
    -- deferred: can_read_health() queries access_grants/care_plans/care_team_members (absent).
    -- TODO(Phase 9 admin): time-boxed admin support read —
    --   OR (is_phi AND subject_user_id IS NOT NULL AND public.admin_has_support_access(subject_user_id))
    -- deferred: admin_has_support_access() queries admin_support_access (absent).
  );

-- INSERT: the caller is the uploader; org-scoped uploads require active membership of that org.
-- (Finer "owning-row writer" gating — e.g. only an org-profile editor may attach a logo — is
-- enforced where the owning row's *_asset_id FK is set, by that row's own UPDATE policy.)
DROP POLICY IF EXISTS assets_insert ON public.assets;
CREATE POLICY assets_insert ON public.assets FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by_user_id = auth.uid()
    AND (organization_id IS NULL OR public.is_active_org_member(organization_id))
  );

-- UPDATE: uploader-self lifecycle (status, checksum after processing, soft-delete). uploader
-- cannot be reassigned (WITH CHECK pins it to self).
-- TODO(Phase 4/8): owning-row writers (org owner, program/lab managers) update path, added
-- with those owning rows' write semantics; for now uploader-self covers attach + lifecycle.
DROP POLICY IF EXISTS assets_update_uploader ON public.assets;
CREATE POLICY assets_update_uploader ON public.assets FOR UPDATE TO authenticated
  USING (uploaded_by_user_id = auth.uid())
  WITH CHECK (uploaded_by_user_id = auth.uid());
