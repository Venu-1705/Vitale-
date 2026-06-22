// =============================================================================
// Vitalé — identity seam (the single demo→JWT cutover point on the HTTP edge)
// -----------------------------------------------------------------------------
// The entire platform reads "who is the caller" in exactly ONE place. In
// production it verifies a Supabase Auth JWT and reads its `sub`; in DEMO_MODE it
// falls back to the legacy `x-user-id` header. Every downstream handler consumes
// `req.userId` via withUserContext and is untouched by this change.
//
// Responsibilities (and their boundaries):
//   • Verify a presented `Authorization: Bearer <jwt>` (Supabase), or in DEMO_MODE
//     resolve the demo `x-user-id` header / DEMO_USER_ID fallback.
//   • Validate the resolved identity's SHAPE (must be a UUID — the Supabase `sub`
//     and public.users.id contract), and attach it as `req.userId`.
//   • This middleware does NOT enforce that an identity is present — public routes
//     run anonymously. Requiring identity is `authedRoute`'s job (lib/route.ts).
// =============================================================================
import type { RequestHandler, Response } from "express";
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import { isUuid } from "@workspace/db";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** The authenticated caller's id (uuid), if an identity was resolved. */
      userId?: string;
      /**
       * Verified identity claims used for JIT provisioning (lib/provision.ts):
       * the email + display name carried by the Supabase JWT (incl. Google OAuth,
       * where the name arrives in user_metadata). Absent in DEMO_MODE.
       */
      authClaims?: { email: string | null; fullName: string | null };
    }
  }
}

/** The verified-identity shape resolved from a token: id (sub) + provisioning claims. */
interface ResolvedIdentity {
  sub: string;
  email: string | null;
  fullName: string | null;
}

// ── Supabase JWT verification key (resolved once at module load) ──────────────
// Two supported modes, mirroring Supabase project types:
//   • SUPABASE_JWKS_URL  — asymmetric keys (ES256/RS256); verified via remote JWKS.
//   • SUPABASE_JWT_SECRET — legacy HS256 shared secret.
const JWKS_URL = process.env["SUPABASE_JWKS_URL"]?.trim();
const JWT_SECRET = process.env["SUPABASE_JWT_SECRET"]?.trim();
const DEMO_MODE = process.env["DEMO_MODE"]?.trim() === "true";

/** Lazily-built remote JWKS (jose caches the fetched keys across requests). */
let remoteJwks: JWTVerifyGetKey | null = null;

function reject(res: Response, code: string, message: string, status = 401): void {
  res.status(status).json({ error: { code, message } });
}

/**
 * Map a verified Supabase JWT payload to our identity shape. The `sub` is the
 * user id; `email` and the display name feed JIT provisioning. Supabase places the
 * name in `user_metadata` (Google OAuth → `full_name`/`name`); we also accept a
 * top-level `name` for robustness.
 */
function toIdentity(payload: JWTPayload): ResolvedIdentity | null {
  if (typeof payload.sub !== "string") return null;
  const meta = (payload["user_metadata"] ?? {}) as Record<string, unknown>;
  const pickString = (...vals: unknown[]): string | null => {
    for (const v of vals) if (typeof v === "string" && v.trim() !== "") return v;
    return null;
  };
  return {
    sub: payload.sub,
    email: pickString(payload["email"], meta["email"]),
    fullName: pickString(meta["full_name"], meta["name"], payload["name"]),
  };
}

/**
 * Verify a Supabase JWT, selecting the key by the token's `alg` header:
 *   • HS256 (legacy projects, shared secret) → SUPABASE_JWT_SECRET
 *   • ES256/RS256/EdDSA (asymmetric signing keys) → SUPABASE_JWKS_URL
 * This is robust whether one or both env vars are configured. Supabase remains the
 * sole token issuer — this never touches a Supabase database.
 */
async function verifyToken(token: string): Promise<ResolvedIdentity | null> {
  const alg = decodeProtectedHeader(token).alg ?? "";
  const symmetric = alg.startsWith("HS");

  if (symmetric && JWT_SECRET) {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    return toIdentity(payload);
  }
  if (!symmetric && JWKS_URL) {
    if (!remoteJwks) remoteJwks = createRemoteJWKSet(new URL(JWKS_URL));
    const { payload } = await jwtVerify(token, remoteJwks);
    return toIdentity(payload);
  }
  // Fallback: use whichever single key material is configured.
  if (JWT_SECRET) {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    return toIdentity(payload);
  }
  if (JWKS_URL) {
    if (!remoteJwks) remoteJwks = createRemoteJWKSet(new URL(JWKS_URL));
    const { payload } = await jwtVerify(token, remoteJwks);
    return toIdentity(payload);
  }
  return null; // no key configured
}

/**
 * Resolve the caller's identity into `req.userId`.
 *
 * Production: verify the Bearer JWT (Supabase) and use its `sub`.
 * DEMO_MODE:  resolve `x-user-id` header → `DEMO_USER_ID` env → anonymous.
 */
export const identityMiddleware: RequestHandler = (req, res, next) => {
  const authHeader = req.header("authorization") ?? req.header("Authorization");
  const bearer =
    authHeader && /^Bearer\s+/i.test(authHeader)
      ? authHeader.replace(/^Bearer\s+/i, "").trim()
      : undefined;

  // ── Production path: a token is present → it MUST verify ────────────────────
  if (bearer) {
    if (!JWKS_URL && !JWT_SECRET) {
      reject(res, "auth_not_configured", "Token verification is not configured (set SUPABASE_JWKS_URL or SUPABASE_JWT_SECRET).", 500);
      return;
    }
    verifyToken(bearer)
      .then((identity) => {
        if (!identity || !isUuid(identity.sub)) {
          reject(res, "invalid_identity", "Token `sub` is missing or not a UUID.");
          return;
        }
        req.userId = identity.sub;
        req.authClaims = { email: identity.email, fullName: identity.fullName };
        next();
      })
      .catch(() => {
        reject(res, "invalid_token", "The bearer token is invalid or expired.");
      });
    return;
  }

  // ── DEMO_MODE fallback: legacy x-user-id header / DEMO_USER_ID ───────────────
  if (DEMO_MODE) {
    const headerValue = req.header("x-user-id")?.trim();
    const resolved =
      headerValue && headerValue.length > 0 ? headerValue : process.env["DEMO_USER_ID"]?.trim();

    if (!resolved) {
      return next(); // anonymous; authedRoute rejects if identity is required
    }
    if (!isUuid(resolved)) {
      reject(res, "invalid_identity", "x-user-id must be a UUID.", 400);
      return;
    }
    req.userId = resolved;
    return next();
  }

  // ── Production, no token presented: anonymous (authedRoute enforces) ─────────
  next();
};
