-- =============================================================================
-- Vitalé — Post-table migration 0140: JIT provisioning (Supabase-auth-only edition)
-- -----------------------------------------------------------------------------
-- ARCHITECTURE: Supabase is the AUTHENTICATION provider ONLY — it issues the JWTs
-- (email/password + Google OAuth) but does NOT host this database. The database is
-- LOCAL PostgreSQL. There is no `auth.users` table and no INSERT-trigger
-- provisioning; the API verifies the Supabase JWT and creates the local
-- `public.users` row Just-In-Time on the first authenticated request, calling
-- public.rpc_provision_user() (this file) — see the API's lib/provision.ts +
-- authedRoute (it runs before withUserContext).
--
-- RLS, the local auth.uid()/role()/jwt() helpers, roles, and every domain policy
-- are UNCHANGED. `public.users.id` has no FK to any auth table, so the mirror row is
-- written directly.
--
-- Idempotent: guarded drops; ON CONFLICT DO NOTHING; CREATE OR REPLACE.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. Legacy cleanup — remove any Supabase-auth-coupled provisioning objects left
--    by older runs. Guarded so a fresh database (which never created auth.users)
--    applies this without error. The fresh path no longer creates ANY of these:
--    0000 no longer defines auth.users; 0101 no longer defines the trigger/function.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS vitale_provision_user ON auth.users';
    EXECUTE 'DROP TABLE auth.users';
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.tg_provision_user();

-- ----------------------------------------------------------------------------
-- 2. Phone is no longer mandatory.
--    The original schema assumed phone-OTP signup (users.phone NOT NULL UNIQUE).
--    Supabase email/password and Google OAuth users have NO phone, so JIT must be
--    able to create a phone-less row. Mirror how `email` is already handled:
--    nullable column + UNIQUE only WHERE NOT NULL. (Fresh DBs get this shape from
--    the Drizzle schema; this ALTER keeps already-migrated DBs in sync.)
-- ----------------------------------------------------------------------------
ALTER TABLE public.users ALTER COLUMN phone DROP NOT NULL;

DROP INDEX IF EXISTS public.users_phone_key;
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_key
  ON public.users (phone) WHERE phone IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. rpc_provision_user — idempotent JIT mirror of an authenticated identity into
--    public.users. SECURITY DEFINER owned by rls_owner: this is the codebase's
--    established pattern for trusted writes to FORCE-RLS tables (service_role is
--    BYPASSRLS but deliberately holds NO table grants; every trusted write goes
--    through an rls_owner-owned definer + its grant + permissive policy — see 0128).
--    The body runs as rls_owner, which has INSERT on users + a permissive INSERT
--    policy (granted just below). The API calls this as service_role
--    (withServiceContext), which holds only EXECUTE.
--    Keyed on id (the Supabase `sub`); ON CONFLICT (id) DO NOTHING makes concurrent
--    first-requests and repeats safe. p_email / p_full_name come from verified JWT
--    claims and may be null (Google may omit name).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_provision_user(
  p_id        uuid,
  p_email     text DEFAULT NULL,
  p_full_name text DEFAULT NULL
) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.users (id, phone, email, full_name, roles, status)
  VALUES (p_id, NULL, p_email, p_full_name, '{}', 'active')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Own the definer by the low-privilege rls_owner (never the migration superuser),
-- consistent with 0119's SECURITY DEFINER ownership transfers.
ALTER FUNCTION public.rpc_provision_user(uuid, text, text) OWNER TO rls_owner;

-- rls_owner needs to write users (FORCE RLS): a table grant + a permissive INSERT
-- policy. (Mirrors the path the former tg_provision_user relied on.)
GRANT INSERT ON public.users TO rls_owner;
DROP POLICY IF EXISTS users_rls_owner_insert ON public.users;
CREATE POLICY users_rls_owner_insert ON public.users
  FOR INSERT TO rls_owner WITH CHECK (true);

-- Trusted server only. The API path calls this as service_role (withServiceContext).
REVOKE ALL ON FUNCTION public.rpc_provision_user(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_provision_user(uuid, text, text) TO service_role;
