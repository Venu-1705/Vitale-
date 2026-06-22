// =============================================================================
// Vitalé — identity-context transaction wrappers (THE seam)
// -----------------------------------------------------------------------------
// AUTH_DEFERRED_STRATEGY: there is exactly ONE place in the platform that opens a
// user-scoped, RLS-live transaction and tells the database "who" the caller is —
// `withUserContext`. Every user-facing handler runs its database work inside this
// wrapper and never touches a pool, a role, or an identity GUC directly. Because of
// that, the eventual demo→JWT cutover is a change to a single argument source
// (the `userId` passed in by the identity middleware), not a platform-wide edit.
//
// How identity reaches the database (migration 0000, SECTION 3):
//   auth.uid() resolves from  request.jwt.claims ->> 'sub'.
// We populate that GUC with `set_config('request.jwt.claims', <json>, true)` where
// is_local = true makes it TRANSACTION-scoped. Combined with `SET LOCAL ROLE`, both
// the effective role and the identity reset automatically at COMMIT/ROLLBACK, so a
// pooled connection can never carry one user's identity into the next user's work.
//
// The claims object is the full PostgREST-shaped payload `{ sub, role }`. A verified
// JWT's decoded payload has exactly this shape, so at auth cutover the identity
// middleware simply supplies a verified `sub` instead of the demo one — this file
// does not change.
// =============================================================================
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type pg from "pg";
import * as schema from "../schema";
import { userPool, servicePool } from "./pools";
import { normalizeDbError } from "./errors";

/** A drizzle handle bound to a single pooled client inside an open transaction. */
export type TxDatabase = NodePgDatabase<typeof schema>;

/** Work to run inside an identity-scoped transaction. */
export type ContextCallback<T> = (db: TxDatabase) => Promise<T>;

// Effective roles are fixed string literals (never user input) — safe to inline in
// `SET LOCAL ROLE`, which cannot be parameterized. Defined as constants so the two
// allowed values are auditable in one place.
const ROLE_AUTHENTICATED = "authenticated" as const;
const ROLE_SERVICE = "service_role" as const;

async function runInContext<T>(
  pool: pg.Pool,
  role: typeof ROLE_AUTHENTICATED | typeof ROLE_SERVICE,
  claims: string | null,
  fn: ContextCallback<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Establish the effective role for this transaction (resets on COMMIT/ROLLBACK).
    await client.query(`SET LOCAL ROLE ${role}`);
    // Establish identity for RLS, if any. Transaction-local (is_local = true).
    if (claims !== null) {
      await client.query(
        "SELECT set_config('request.jwt.claims', $1::text, true)",
        [claims],
      );
    }

    const db = drizzle(client, { schema });
    const result = await fn(db);

    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // A failed ROLLBACK means the connection is already broken; pg discards it on
      // release. Surface the ORIGINAL error, not the rollback failure.
    }
    // Map raw pg/SQLSTATE errors to semantic DbError; pass app/Zod errors through.
    throw normalizeDbError(err);
  } finally {
    client.release();
  }
}

/**
 * Run `fn` inside an RLS-governed transaction as the `authenticated` role, with the
 * given user's identity exposed to the database via auth.uid(). This is the ONLY
 * sanctioned entry point for user-facing database work.
 *
 * @param userId  The caller's identity (the `sub` claim). Today sourced from the
 *                demo identity middleware; at auth cutover, a verified JWT subject.
 *                Must already be validated as a UUID by the caller (the seam does).
 */
export function withUserContext<T>(
  userId: string,
  fn: ContextCallback<T>,
): Promise<T> {
  const claims = JSON.stringify({ sub: userId, role: ROLE_AUTHENTICATED });
  return runInContext(userPool, ROLE_AUTHENTICATED, claims, fn);
}

/**
 * Run `fn` inside a transaction as the BYPASSRLS `service_role`. For trusted,
 * non-user-scoped server work ONLY: webhook intake, background jobs, and paths that
 * legitimately operate outside a single user's RLS scope. No identity GUC is set.
 * Never call this from a user-facing request path to "work around" RLS.
 */
export function withServiceContext<T>(fn: ContextCallback<T>): Promise<T> {
  return runInContext(servicePool, ROLE_SERVICE, null, fn);
}
