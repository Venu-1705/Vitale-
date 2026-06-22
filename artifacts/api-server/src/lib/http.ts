// =============================================================================
// Vitalé — HTTP error mapping (transport edge of the DB-first error model)
// -----------------------------------------------------------------------------
// The database decides business outcomes; lib/db/runtime/errors.ts classifies the
// resulting SQLSTATE into semantic categories. This module is the ONLY place that
// turns those categories — plus app-level ApiError and Zod validation failures —
// into HTTP status codes and a stable, safe response envelope.
//
// Response envelope (uniform across the whole API):
//   { "error": { "code": string, "message": string, "details"?: unknown } }
//
// Safety: 5xx responses NEVER leak internal/DB detail; the raw error is logged
// server-side via the pino request logger. 4xx responses carry a caller-actionable
// code and a safe message. RLS denials surface as 403 with a generic message (we do
// not reveal whether a row exists — only that access was denied).
//
// STATUS-CODE TAXONOMY (Finding #5 — one rule, applied API-wide):
//   • 400 Bad Request          — the request is STRUCTURALLY invalid: it fails input
//                                 schema validation (Zod) OR the database rejects the
//                                 literal value representation (SQLSTATE class 22, e.g.
//                                 22P02 invalid uuid/text). Both are "malformed input".
//   • 401 Unauthenticated      — no caller identity.
//   • 403 Forbidden            — RLS / authorization denial (42501).
//   • 404 Not Found            — missing resource (P0002 / handler ApiError).
//   • 409 Conflict             — unique/exclusion violation; serialization/deadlock
//                                 (40001/40P01, retryable).
//   • 422 Unprocessable Entity — the request is WELL-FORMED and passed input validation,
//                                 but violates a BUSINESS / DOMAIN invariant: explicit
//                                 RPC/trigger RAISE (P0001/business_rule), CHECK (23514),
//                                 FK (23503), NOT NULL (23502).
// The dividing line is: malformed input → 400; valid-but-rejected-by-a-rule → 422.
// Zod failures and DB 22xxx therefore BOTH map to 400 (previously Zod was 422).
// =============================================================================
import type { ErrorRequestHandler } from "express";
import { isDbError, type DbErrorCategory } from "@workspace/db";
import { ZodError } from "zod";

/** Application-level HTTP error thrown by handlers/wrappers (e.g. missing identity). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** Semantic DB outcome → HTTP status. */
const DB_CATEGORY_STATUS: Record<DbErrorCategory, number> = {
  rls_denied: 403,
  unique_violation: 409,
  foreign_key_violation: 422,
  not_null_violation: 422,
  check_violation: 422,
  exclusion_violation: 409,
  invalid_input: 400,
  not_found: 404,
  business_rule: 422,
  serialization: 409,
  unknown: 500,
};

/** Caller-facing code for each DB category (stable contract, not the SQLSTATE). */
const DB_CATEGORY_CODE: Record<DbErrorCategory, string> = {
  rls_denied: "forbidden",
  unique_violation: "conflict",
  foreign_key_violation: "unprocessable_entity",
  not_null_violation: "unprocessable_entity",
  check_violation: "unprocessable_entity",
  exclusion_violation: "conflict",
  invalid_input: "invalid_input",
  not_found: "not_found",
  business_rule: "unprocessable_entity",
  serialization: "conflict",
  unknown: "internal_error",
};

/**
 * Safe, caller-facing message per category. For `business_rule` (an explicit
 * trigger/RPC RAISE EXCEPTION) the DB message is intentional and safe to surface;
 * everything else uses a generic message so we never leak schema internals.
 */
function safeDbMessage(category: DbErrorCategory, rawMessage: string): string {
  switch (category) {
    case "rls_denied":
      return "You do not have access to this resource.";
    case "unique_violation":
      return "A conflicting resource already exists.";
    case "exclusion_violation":
      return "The request conflicts with an existing resource.";
    case "foreign_key_violation":
      return "A referenced resource does not exist.";
    case "not_null_violation":
      return "A required field is missing.";
    case "check_violation":
      return "The request violates a data constraint.";
    case "invalid_input":
      return "The request contains invalid input.";
    case "not_found":
      return "The requested resource was not found.";
    case "serialization":
      return "The request could not be completed due to concurrent activity. Please retry.";
    case "business_rule":
      // DB-authored, intentional invariant message — safe and useful to surface.
      return rawMessage;
    case "unknown":
    default:
      return "Internal server error.";
  }
}

/**
 * Terminal Express error handler. Mount LAST, after all routers. Translates
 * ApiError, DbError, and ZodError into the uniform envelope; anything else is a
 * 500 with no detail leaked.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // If a response was already partially sent, defer to Express' default handling.
  if (res.headersSent) {
    return _next(err);
  }

  const log = (req as { log?: { error: (o: unknown, m: string) => void } }).log;

  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  if (err instanceof ZodError) {
    // Malformed input at the request boundary → 400 (consistent with DB 22xxx).
    res.status(400).json({
      error: {
        code: "validation_error",
        message: "The request failed validation.",
        details: err.issues,
      },
    });
    return;
  }

  if (isDbError(err)) {
    const status = DB_CATEGORY_STATUS[err.category];
    if (status >= 500) {
      log?.error({ err }, "Unhandled database error");
      res.status(status).json({
        error: { code: "internal_error", message: "Internal server error." },
      });
      return;
    }
    res.status(status).json({
      error: {
        code: DB_CATEGORY_CODE[err.category],
        message: safeDbMessage(err.category, err.message),
      },
    });
    return;
  }

  // Unknown/unexpected error — log server-side, reveal nothing.
  log?.error({ err }, "Unhandled error");
  res.status(500).json({
    error: { code: "internal_error", message: "Internal server error." },
  });
};
