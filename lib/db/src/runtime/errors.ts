// =============================================================================
// Vitalé — database error classification (transport-agnostic)
// -----------------------------------------------------------------------------
// The database is the source of truth for business invariants: RLS denies
// unauthorized reads/writes (SQLSTATE 42501), CHECK/EXCLUDE constraints enforce
// domain rules, triggers RAISE EXCEPTION (P0001) for richer invariants, and unique
// indexes guard identity. This module maps raw PostgreSQL SQLSTATE codes into a
// small set of *semantic categories* so the application never re-implements those
// rules — it simply surfaces what the DB already decided.
//
// This layer is intentionally HTTP-agnostic. The api-server (lib/http.ts) owns the
// category → HTTP-status mapping; a future worker or CLI can map the same
// categories to its own surface. Keeping classification here (next to the DB) means
// there is exactly ONE place that understands SQLSTATE.
// =============================================================================

/**
 * Semantic outcome categories derived from PostgreSQL SQLSTATE codes.
 * Ordering is by how a caller typically reacts, not by code number.
 */
export type DbErrorCategory =
  | "rls_denied" //            42501 insufficient_privilege (RLS/role denial)
  | "unique_violation" //      23505
  | "foreign_key_violation" // 23503
  | "not_null_violation" //    23502
  | "check_violation" //       23514
  | "exclusion_violation" //   23P01
  | "invalid_input" //         22xxx (e.g. 22P02 invalid uuid/text representation)
  | "not_found" //             P0002 no_data_found (e.g. SELECT ... STRICT)
  | "business_rule" //         P0001 raise_exception (explicit trigger/RPC invariant)
  | "serialization" //         40001 / 40P01 (serialization failure / deadlock — retryable)
  | "unknown"; //              anything else

/** Minimal structural shape of a `pg`/libpq error. */
export interface PgError {
  code: string;
  message: string;
  detail?: string;
  hint?: string;
  constraint?: string;
  table?: string;
  column?: string;
  schema?: string;
  severity?: string;
}

// Every PostgreSQL SQLSTATE is exactly five characters drawn from [0-9A-Z] (class +
// subclass). Matching this shape — rather than "has a string `code`" — is what keeps
// us from mis-capturing non-driver errors that merely happen to carry a `.code`
// (e.g. the api-server's ApiError, whose `code` is a semantic string like
// "not_found"). Without it, withUserContext's normalizeDbError would wrap a
// handler-thrown ApiError into an `unknown`-category DbError → a spurious 500.
const SQLSTATE_RE = /^[0-9A-Z]{5}$/;

/** Type guard: does this thrown value look like a PostgreSQL driver error? */
export function isPgError(err: unknown): err is PgError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string" &&
    SQLSTATE_RE.test((err as { code: string }).code)
  );
}

/**
 * A normalized database error. Carries the semantic `category` plus the original
 * SQLSTATE and the (safe-to-inspect) constraint/detail metadata. The raw driver
 * error is preserved on `cause` for logging — never expose it to clients directly.
 */
export class DbError extends Error {
  readonly category: DbErrorCategory;
  readonly code: string;
  readonly constraint?: string;
  readonly detail?: string;
  readonly table?: string;

  constructor(category: DbErrorCategory, pg: PgError) {
    super(pg.message);
    this.name = "DbError";
    this.category = category;
    this.code = pg.code;
    this.constraint = pg.constraint;
    this.detail = pg.detail;
    this.table = pg.table;
    this.cause = pg;
  }
}

export function isDbError(err: unknown): err is DbError {
  return err instanceof DbError;
}

function categorize(code: string): DbErrorCategory {
  switch (code) {
    case "42501":
      return "rls_denied";
    case "23505":
      return "unique_violation";
    case "23503":
      return "foreign_key_violation";
    case "23502":
      return "not_null_violation";
    case "23514":
      return "check_violation";
    case "23P01":
      return "exclusion_violation";
    case "23001":
      // restrict_violation — a trigger-enforced integrity invariant raised via
      // RAISE EXCEPTION ... USING ERRCODE='restrict_violation' (e.g. the D9
      // care-team capability-subset / cross-org-agreement guards). A deliberate
      // domain rule, not a server fault → same surface as P0001 (business_rule → 422).
      return "business_rule";
    case "P0002":
      return "not_found";
    case "P0001":
      return "business_rule";
    case "40001":
    case "40P01":
      return "serialization";
    default:
      // Class 22 = data exception (invalid text/uuid representation, numeric range,
      // etc.) → caller sent bad input.
      if (code.startsWith("22")) return "invalid_input";
      return "unknown";
  }
}

/**
 * Walk the `.cause` chain looking for a recognizable pg error.
 *
 * Drivers and ORMs wrap the raw libpq error: drizzle throws a `_DrizzleQueryError`
 * whose own `.code` is undefined and whose `.cause` holds the real pg error (which
 * carries the SQLSTATE). If we only inspected the top-level object we would miss the
 * SQLSTATE entirely and mis-map every DB error to 500. We bound the walk to avoid
 * pathological/cyclic chains.
 */
function findPgError(err: unknown, depth = 0): PgError | undefined {
  if (depth > 8 || err === null || typeof err !== "object") return undefined;
  if (isPgError(err)) return err;
  const cause = (err as { cause?: unknown }).cause;
  return cause === err ? undefined : findPgError(cause, depth + 1);
}

/**
 * Convert a PostgreSQL driver error into a {@link DbError}. Returns the value
 * unchanged if it is not a recognizable pg error (so application/Zod errors pass
 * through untouched for the transport layer to handle).
 */
export function normalizeDbError(err: unknown): unknown {
  if (err instanceof DbError) return err;
  const pg = findPgError(err);
  if (pg) return new DbError(categorize(pg.code), pg);
  return err;
}
