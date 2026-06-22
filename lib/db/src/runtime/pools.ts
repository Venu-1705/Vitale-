// =============================================================================
// Vitalé — dual connection pools (the RLS boundary)
// -----------------------------------------------------------------------------
// VITALE_DB_ARCHITECTURE + AUTH_DEFERRED_STRATEGY: every database access goes
// through ONE of two pools, and the choice of pool is the security boundary:
//
//   • userPool    — connections used to run RLS-governed work AS the `authenticated`
//                   role with a per-transaction identity (request.jwt.claims.sub).
//                   This is the path for all end-user / coach requests. RLS is LIVE.
//
//   • servicePool — connections used to run trusted server work AS the `service_role`
//                   (BYPASSRLS): webhooks, background jobs, and SECURITY DEFINER-only
//                   paths that legitimately operate outside a single user's scope.
//
// Both pools connect with the same DATABASE_URL login role; the *effective* role is
// established per-transaction via `SET LOCAL ROLE` in context.ts (transaction-scoped,
// so it cannot leak across pooled connections). Two physical pools are kept — rather
// than one — for defence in depth, independent sizing, and so that a service-path
// connection is never even a candidate to serve a user-path request. The login role
// must be a member of both `authenticated` and `service_role` (granted in migration
// 0000 to the migration/owner role).
//
// This boundary is permanent and auth-independent: when real JWT auth lands, ONLY the
// source of the `sub` claim changes (see context.ts / identity middleware) — the pool
// topology does not.
// =============================================================================
import pg from "pg";

const { Pool } = pg;

function requireConnectionString(): string {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  return url;
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

const connectionString = requireConnectionString();

/**
 * RLS-governed pool. Transactions run as `authenticated` with a per-request
 * identity. Use via {@link withUserContext} — never query this pool directly.
 */
export const userPool: pg.Pool = new Pool({
  connectionString,
  max: intFromEnv("DB_USER_POOL_MAX", 10),
  idleTimeoutMillis: intFromEnv("DB_POOL_IDLE_MS", 30_000),
  application_name: "vitale-user",
});

/**
 * Trusted BYPASSRLS pool. Transactions run as `service_role` for webhooks/jobs.
 * Use via {@link withServiceContext} — never query this pool directly from a
 * user-facing request path.
 */
export const servicePool: pg.Pool = new Pool({
  connectionString,
  max: intFromEnv("DB_SERVICE_POOL_MAX", 5),
  idleTimeoutMillis: intFromEnv("DB_POOL_IDLE_MS", 30_000),
  application_name: "vitale-service",
});

// Idle-client errors (e.g. server-side termination) are emitted on the Pool, not on
// a query promise. Without a listener these crash the process. Log and let pg evict
// the dead client; the next acquire creates a fresh one.
userPool.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error({ err, pool: "userPool" }, "idle client error");
});
servicePool.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error({ err, pool: "servicePool" }, "idle client error");
});

/** Gracefully drain both pools (call on shutdown). */
export async function closePools(): Promise<void> {
  await Promise.allSettled([userPool.end(), servicePool.end()]);
}
