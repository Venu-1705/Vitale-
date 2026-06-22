// =============================================================================
// Vitalé — JIT user provisioning (Supabase-auth-only / local-Postgres edition)
// -----------------------------------------------------------------------------
// Supabase issues our JWTs (email/password + Google OAuth) but no longer hosts the
// database, so the legacy `AFTER INSERT ON auth.users` trigger can never fire. This
// module mirrors a verified identity into `public.users` Just-In-Time, on the first
// authenticated request, BEFORE the request enters its RLS-scoped transaction.
//
// • Runs via withServiceContext (BYPASSRLS service_role) → can write the FORCE-RLS
//   users table before any auth.uid() context exists.
// • Calls public.rpc_provision_user(id, email, full_name) — idempotent
//   (ON CONFLICT (id) DO NOTHING), so concurrent first-requests and repeats are safe.
// • An in-process cache of already-provisioned ids keeps this to ONE DB round-trip
//   per user per server process; every later request short-circuits.
//
// This file introduces NO dependency on a Supabase database — only the local pool.
// =============================================================================
import { sql } from "drizzle-orm";
import { withServiceContext } from "@workspace/db";

/** Ids we've already ensured this process lifetime — avoids a per-request upsert. */
const provisioned = new Set<string>();

export interface ProvisionClaims {
  email: string | null;
  fullName: string | null;
}

/**
 * Ensure `public.users.id = userId` exists, creating it from verified JWT claims if
 * not. Idempotent and cached. Safe to call on every authenticated request; only the
 * first call per user (per process) touches the database.
 */
export async function ensureUserProvisioned(
  userId: string,
  claims: ProvisionClaims | undefined,
): Promise<void> {
  if (provisioned.has(userId)) return;

  await withServiceContext((db) =>
    db.execute(
      sql`SELECT public.rpc_provision_user(${userId}::uuid, ${claims?.email ?? null}, ${claims?.fullName ?? null})`,
    ),
  );

  provisioned.add(userId);
}
