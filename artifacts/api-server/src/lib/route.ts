// =============================================================================
// Vitalé — the canonical endpoint shape
// -----------------------------------------------------------------------------
// ARCHITECTURE_FIRST_ROADMAP, Rule 7: every endpoint is
//     validate input → establish user context → call database → map errors → respond.
// `authedRoute` encodes that pipeline ONCE so no handler re-implements identity
// plumbing, transaction/role management, or error handling. Handlers become pure:
// they receive validated input + an RLS-live `db` already bound to the caller's
// identity, and return a value to serialize.
//
// Why this prevents rework:
//   • Identity is taken only from `req.userId` (the single seam) and flows into
//     withUserContext — so the demo→JWT cutover never touches handlers.
//   • Validation, context, and error mapping are centralized — adding a domain is
//     "write a Zod schema + a db call", never re-deriving the cross-cutting plumbing.
//   • Errors are thrown, not handled inline; the terminal errorHandler maps them.
// =============================================================================
import type { Request, RequestHandler, Response } from "express";
import type { z, ZodType } from "zod";
import { withUserContext, type TxDatabase } from "@workspace/db";
import { ApiError } from "./http";
import { ensureUserProvisioned } from "./provision";

/** Optional Zod schemas for the three request input surfaces. */
export interface RouteSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

type Validated<T extends ZodType | undefined> = T extends ZodType
  ? z.infer<T>
  : undefined;

/** Everything a handler needs — validated input + an identity-scoped db handle. */
export interface RouteContext<S extends RouteSchemas> {
  /** RLS-live drizzle handle, already inside the caller's transaction. */
  db: TxDatabase;
  /** The authenticated caller's id (guaranteed present in an authedRoute). */
  userId: string;
  body: Validated<S["body"]>;
  query: Validated<S["query"]>;
  params: Validated<S["params"]>;
  req: Request;
  res: Response;
}

/** A handler returns the value to JSON-serialize, or undefined if it responded itself. */
export type RouteHandler<S extends RouteSchemas> = (
  ctx: RouteContext<S>,
) => Promise<unknown>;

/**
 * Build an Express handler that requires an authenticated identity and runs its
 * work inside a user-scoped, RLS-live transaction.
 *
 * Pipeline: require identity → validate(body/query/params) → withUserContext →
 * handler → respond. Any thrown error (ZodError, DbError, ApiError, unexpected) is
 * forwarded to the terminal errorHandler via `next`.
 */
export function authedRoute<S extends RouteSchemas>(
  schemas: S,
  handler: RouteHandler<S>,
): RequestHandler {
  return (req, res, next) => {
    void (async () => {
      const userId = req.userId;
      if (!userId) {
        throw new ApiError(401, "unauthenticated", "Authentication is required.");
      }

      // JIT provisioning: ensure public.users.id = sub exists before entering the
      // RLS-scoped transaction. Supabase issues the JWT (incl. Google) but no longer
      // hosts our DB, so this replaces the legacy auth.users INSERT trigger. Idempotent
      // and cached → at most one DB round-trip per user per process.
      await ensureUserProvisioned(userId, req.authClaims);

      // Validate BEFORE opening a transaction — never hold a DB connection while
      // rejecting malformed input. ZodError propagates to errorHandler (→ 400).
      const body = (
        schemas.body ? schemas.body.parse(req.body) : undefined
      ) as Validated<S["body"]>;
      const query = (
        schemas.query ? schemas.query.parse(req.query) : undefined
      ) as Validated<S["query"]>;
      const params = (
        schemas.params ? schemas.params.parse(req.params) : undefined
      ) as Validated<S["params"]>;

      const result = await withUserContext(userId, (db) =>
        handler({ db, userId, body, query, params, req, res }),
      );

      // A handler may respond itself (streaming, 204, custom status). Only
      // auto-serialize when it returned a value and nothing was sent yet.
      if (!res.headersSent && result !== undefined) {
        res.json(result);
      } else if (!res.headersSent) {
        res.status(204).end();
      }
    })().catch(next);
  };
}
