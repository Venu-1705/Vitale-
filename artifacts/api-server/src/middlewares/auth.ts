// =============================================================================
// Vitalé — Supabase JWT auth middleware (requireAuth / optionalAuth)
// -----------------------------------------------------------------------------
// A self-contained authentication guard that verifies a Supabase Auth JWT and
// attaches `req.user = { id, email, role }`. It composes with the global identity
// seam (middlewares/identity.ts): when identity has already verified the token and
// populated `req.userId`, this middleware reuses that result (no double-verify) and
// only decodes the role/email claims; otherwise it verifies the presented Bearer
// token itself. Either way it is a correct, standalone guard.
//
//   • requireAuth   — 401 when no valid identity is present.
//   • optionalAuth  — attaches `req.user` when a token is present/valid; never rejects.
//
// To keep the rest of the platform untouched, this also keeps `req.userId` /
// `req.authClaims` in sync, so the downstream `authedRoute → withUserContext`
// pipeline (which reads `req.userId`) works whether or not identity ran first.
//
// Supabase remains AUTHENTICATION-ONLY: tokens are verified with the project's
// HS256 secret (SUPABASE_JWT_SECRET) or asymmetric JWKS (SUPABASE_JWKS_URL). No
// Supabase database is ever contacted. Google OAuth logins work unchanged — they
// carry the same `sub`/`email`/`role` claims this middleware reads.
// =============================================================================
import type { RequestHandler, Response } from "express";
import {
  createRemoteJWKSet,
  decodeJwt,
  decodeProtectedHeader,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from "jose";
import { isUuid } from "@workspace/db";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** The authenticated caller resolved from a verified Supabase JWT. */
      user?: AuthenticatedUser;
    }
  }
}

/** The authenticated principal attached to `req.user` by this middleware. */
export interface AuthenticatedUser {
  /** The Supabase `sub` claim == public.users.id (a UUID). */
  id: string;
  /** The caller's email, if the token carries one. */
  email: string | null;
  /** The Postgres role claim (Supabase issues `authenticated` for signed-in users). */
  role: string;
}

// ── Key material (resolved once at module load) ──────────────────────────────
const JWKS_URL = process.env["SUPABASE_JWKS_URL"]?.trim();
const JWT_SECRET = process.env["SUPABASE_JWT_SECRET"]?.trim();

/** Lazily-built remote JWKS (jose caches the fetched keys across requests). */
let remoteJwks: JWTVerifyGetKey | null = null;

function reject(res: Response, code: string, message: string, status = 401): void {
  res.status(status).json({ error: { code, message } });
}

/** Read the raw Bearer token from the Authorization header, if present. */
function readBearer(authHeader: string | undefined): string | undefined {
  if (!authHeader || !/^Bearer\s+/i.test(authHeader)) return undefined;
  return authHeader.replace(/^Bearer\s+/i, "").trim() || undefined;
}

function pickEmail(payload: JWTPayload): string | null {
  const meta = (payload["user_metadata"] ?? {}) as Record<string, unknown>;
  for (const v of [payload["email"], meta["email"]]) {
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return null;
}

function pickRole(payload: JWTPayload): string {
  const role = payload["role"];
  return typeof role === "string" && role.trim() !== "" ? role : "authenticated";
}

/**
 * Verify a Supabase JWT, selecting the key by the token's `alg` header:
 *   • HS256 (legacy projects, shared secret) → SUPABASE_JWT_SECRET
 *   • ES256/RS256/EdDSA (asymmetric signing keys) → SUPABASE_JWKS_URL
 * Returns the verified claims, or throws if verification fails / no key is configured.
 */
async function verifyToken(token: string): Promise<JWTPayload> {
  const alg = decodeProtectedHeader(token).alg ?? "";
  const symmetric = alg.startsWith("HS");

  if (symmetric && JWT_SECRET) {
    return (await jwtVerify(token, new TextEncoder().encode(JWT_SECRET))).payload;
  }
  if (!symmetric && JWKS_URL) {
    if (!remoteJwks) remoteJwks = createRemoteJWKSet(new URL(JWKS_URL));
    return (await jwtVerify(token, remoteJwks)).payload;
  }
  // Fallback: use whichever single key material is configured.
  if (JWT_SECRET) {
    return (await jwtVerify(token, new TextEncoder().encode(JWT_SECRET))).payload;
  }
  if (JWKS_URL) {
    if (!remoteJwks) remoteJwks = createRemoteJWKSet(new URL(JWKS_URL));
    return (await jwtVerify(token, remoteJwks)).payload;
  }
  throw new Error("No SUPABASE_JWT_SECRET or SUPABASE_JWKS_URL configured.");
}

/** Build `req.user` from an already-verified identity (set by identity.ts). */
function userFromResolvedIdentity(
  userId: string,
  bearer: string | undefined,
  authClaims: { email: string | null } | undefined,
): AuthenticatedUser {
  // The token (if any) was already verified upstream; decoding it here only reads
  // the role/email claims without re-verifying. Falls back to the identity claims.
  let email = authClaims?.email ?? null;
  let role = "authenticated";
  if (bearer) {
    try {
      const claims = decodeJwt(bearer);
      email = pickEmail(claims) ?? email;
      role = pickRole(claims);
    } catch {
      /* keep fallbacks */
    }
  }
  return { id: userId, email, role };
}

/**
 * Shared resolver. Returns:
 *   • { user } when an identity was established (token or upstream identity seam),
 *   • { user: null } when no identity is present,
 *   • { error } when a token was presented but failed verification / config.
 */
async function resolve(
  req: Parameters<RequestHandler>[0],
): Promise<{ user: AuthenticatedUser | null; error?: { code: string; message: string; status: number } }> {
  const bearer = readBearer(req.header("authorization") ?? req.header("Authorization"));

  // Fast path: the global identity seam already verified the token and set req.userId
  // (this also covers DEMO_MODE's x-user-id). Reuse it; do not verify twice.
  if (req.userId) {
    return { user: userFromResolvedIdentity(req.userId, bearer, req.authClaims) };
  }

  // No upstream identity. If a token is presented, it MUST verify here.
  if (bearer) {
    if (!JWT_SECRET && !JWKS_URL) {
      return {
        user: null,
        error: {
          code: "auth_not_configured",
          message: "Token verification is not configured (set SUPABASE_JWT_SECRET or SUPABASE_JWKS_URL).",
          status: 500,
        },
      };
    }
    try {
      const payload = await verifyToken(bearer);
      if (typeof payload.sub !== "string" || !isUuid(payload.sub)) {
        return { user: null, error: { code: "invalid_identity", message: "Token `sub` is missing or not a UUID.", status: 401 } };
      }
      const user: AuthenticatedUser = { id: payload.sub, email: pickEmail(payload), role: pickRole(payload) };
      // Keep the downstream pipeline (authedRoute → withUserContext) working.
      req.userId = user.id;
      req.authClaims = { email: user.email, fullName: null };
      return { user };
    } catch {
      return { user: null, error: { code: "invalid_token", message: "The bearer token is invalid or expired.", status: 401 } };
    }
  }

  // No token, no upstream identity → anonymous.
  return { user: null };
}

/**
 * Require a verified Supabase identity. Attaches `req.user` and continues, or
 * responds 401 (missing/invalid token) / 500 (no verification key configured).
 */
export const requireAuth: RequestHandler = (req, res, next) => {
  resolve(req)
    .then(({ user, error }) => {
      if (error) return reject(res, error.code, error.message, error.status);
      if (!user) return reject(res, "unauthenticated", "Authentication is required.");
      req.user = user;
      next();
    })
    .catch(next);
};

/**
 * Attach `req.user` when a valid token/identity is present, but never reject.
 * Used for public surfaces (storefront catalog, webhook intake) that still want to
 * personalize when a caller is signed in. A presented-but-INVALID token is ignored
 * (not rejected) so anonymous browsing always works.
 */
export const optionalAuth: RequestHandler = (req, res, next) => {
  resolve(req)
    .then(({ user }) => {
      if (user) req.user = user;
      next();
    })
    .catch(() => next());
};

/**
 * Back-compat default export. Older imports referenced `authMiddleware`; it now
 * maps to the real `requireAuth` guard (the legacy demo stub is gone).
 */
export const authMiddleware = requireAuth;
export default requireAuth;
