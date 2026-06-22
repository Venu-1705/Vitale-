/**
 * The single typed entry point for every backend call.
 *
 * Responsibilities centralized here (previously copy-pasted across ~10 screens):
 *   - API base URL resolution (EXPO_PUBLIC_DOMAIN → absolute origin, else "/api")
 *   - identity header injection (via lib/session)
 *   - JSON (de)serialization
 *   - uniform error surface (ApiError, with the backend `{ error }` envelope in `.data`)
 *
 * It is a thin, opinionated wrapper over the shared `customFetch` transport from
 * @workspace/api-client-react, which already handles base-URL prefixing for
 * "/"-relative paths and React-Native-aware body parsing.
 */
import {
  ApiError,
  ResponseParseError,
  customFetch,
  setBaseUrl,
  type CustomFetchOptions,
} from "@workspace/api-client-react";

import { getAuthHeaders } from "./session";

export { ApiError, ResponseParseError };

/**
 * Resolved once at module load. Precedence:
 *   1. EXPO_PUBLIC_API_URL  — explicit absolute base for LOCAL dev, e.g.
 *      http://192.168.1.4:3000/api (a LAN IP reachable from the device/simulator).
 *      Use this to point at a locally-running API over http.
 *   2. EXPO_PUBLIC_DOMAIN   — hosted/tunnel host → https://<domain>/api.
 *   3. "/api"               — same-origin fallback (web).
 */
export const API_BASE = process.env.EXPO_PUBLIC_API_URL
  ? process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, "")
  : process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
    : "/api";

let configured = false;

/**
 * Point the shared transport at API_BASE. Idempotent and safe to call from
 * module scope; only the first call has an effect.
 */
export function configureApi(): void {
  if (configured) return;
  setBaseUrl(API_BASE);
  configured = true;
}

export interface ApiRequestOptions
  extends Omit<CustomFetchOptions, "body" | "headers"> {
  /** Plain JS value — serialized to JSON unless it is already a string. */
  body?: unknown;
  /** Extra headers, merged over (and able to override) the identity headers. */
  headers?: Record<string, string>;
  /**
   * Recursively rewrite snake_case response keys to camelCase (default `true`).
   *
   * The backend is uniformly snake_case while the entire app reads camelCase;
   * normalizing once here is the single highest-leverage seam, so every screen
   * consumes one consistent casing without per-call mapping. Set `false` to
   * receive the raw payload verbatim (e.g. when keys are semantically meaningful
   * user data that must not be transformed). Always skipped for blob responses.
   */
  camelize?: boolean;
}

/** snake_case / SCREAMING_SNAKE → camelCase for a single object key. */
function snakeToCamel(key: string): string {
  return key.replace(/_+([a-z0-9])/gi, (_m, c: string) => c.toUpperCase());
}

/**
 * Only recurse into *plain* objects/arrays — never Blob, Date, Map, typed
 * arrays, or other class instances, whose internal keys must be left intact.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Recursively camelize every key of a JSON value (objects and arrays of
 * objects), leaving scalars and non-plain objects untouched. Exported so
 * call sites that bypass `apiRequest` (or tests) can reuse the exact transform.
 */
export function camelizeKeys<T = unknown>(input: unknown): T {
  if (Array.isArray(input)) {
    return input.map((entry) => camelizeKeys(entry)) as T;
  }
  if (isPlainObject(input)) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      out[snakeToCamel(key)] = camelizeKeys(value);
    }
    return out as T;
  }
  return input as T;
}

/**
 * Perform an authenticated backend request. Throws `ApiError` on any non-2xx
 * response, with the parsed backend error envelope available as `err.data`
 * and the status as `err.status`.
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { body, headers, camelize, ...rest } = options;

  const init: CustomFetchOptions = {
    ...rest,
    headers: { ...getAuthHeaders(), ...(headers ?? {}) },
  };

  if (body !== undefined) {
    if (typeof body === "string") {
      init.body = body;
    } else {
      init.body = JSON.stringify(body);
      (init.headers as Record<string, string>)["content-type"] =
        "application/json";
    }
  }

  const result = await customFetch<unknown>(path, init);

  // Binary payloads are opaque; opting out (or a blob response) returns the
  // value verbatim. Otherwise normalize the backend's snake_case JSON to the
  // camelCase the app reads everywhere.
  if (camelize === false || rest.responseType === "blob") {
    return result as T;
  }
  return camelizeKeys<T>(result);
}

/** GET helper. */
export function apiGet<T = unknown>(
  path: string,
  options?: Omit<ApiRequestOptions, "method" | "body">,
): Promise<T> {
  return apiRequest<T>(path, { ...options, method: "GET" });
}

/** POST helper. */
export function apiPost<T = unknown>(
  path: string,
  body?: unknown,
  options?: Omit<ApiRequestOptions, "method" | "body">,
): Promise<T> {
  return apiRequest<T>(path, { ...options, method: "POST", body });
}

/** PUT helper. */
export function apiPut<T = unknown>(
  path: string,
  body?: unknown,
  options?: Omit<ApiRequestOptions, "method" | "body">,
): Promise<T> {
  return apiRequest<T>(path, { ...options, method: "PUT", body });
}

/** PATCH helper. */
export function apiPatch<T = unknown>(
  path: string,
  body?: unknown,
  options?: Omit<ApiRequestOptions, "method" | "body">,
): Promise<T> {
  return apiRequest<T>(path, { ...options, method: "PATCH", body });
}

/** DELETE helper. */
export function apiDelete<T = unknown>(
  path: string,
  options?: Omit<ApiRequestOptions, "method" | "body">,
): Promise<T> {
  return apiRequest<T>(path, { ...options, method: "DELETE" });
}

/** Fetch a binary payload (e.g. invoice PDF) as a Blob. */
export function apiGetBlob(
  path: string,
  options?: Omit<ApiRequestOptions, "method" | "body" | "responseType">,
): Promise<Blob> {
  return apiRequest<Blob>(path, {
    ...options,
    method: "GET",
    responseType: "blob",
  });
}
