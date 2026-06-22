/**
 * The single typed entry point for every backend call (coach + admin platform).
 *
 * Mirrors the mobile app's `lib/api` so both clients share one mental model and
 * one transport. Responsibilities centralized here (never copy-pasted per page):
 *   - API base URL resolution (VITE_API_URL → absolute origin, else "/api")
 *   - identity header injection (via lib/session → demo `x-user-id`)
 *   - JSON (de)serialization
 *   - snake_case → camelCase response normalization
 *   - uniform error surface (ApiError, with the backend `{ error }` envelope)
 *
 * Thin wrapper over the shared `customFetch` transport from
 * @workspace/api-client-react (base-URL prefixing for "/"-relative paths).
 *
 * Request casing rule (identical to mobile): RESPONSES are camelized; query
 * strings and request BODIES are sent verbatim, so anything the backend Zod
 * validates by snake_case name (`organization_id`, `member_role`) is written
 * snake_case at the call site.
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
 * Resolved once at module load. A hosted build sets VITE_API_URL to an absolute
 * origin; locally it falls back to a same-origin "/api" prefix (Vite dev proxy
 * or a co-served API).
 */
export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ??
  "/api";

let configured = false;

/** Point the shared transport at API_BASE. Idempotent; only the first call acts. */
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
   * The backend is uniformly snake_case while the app reads camelCase; we
   * normalize once here. Set `false` to receive the raw payload verbatim.
   */
  camelize?: boolean;
}

/** snake_case / SCREAMING_SNAKE → camelCase for a single object key. */
function snakeToCamel(key: string): string {
  return key.replace(/_+([a-z0-9])/gi, (_m, c: string) => c.toUpperCase());
}

/** Only recurse into *plain* objects/arrays — never Blob/Date/Map/instances. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Recursively camelize every key of a JSON value (objects + arrays). */
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
 * response, with the parsed backend error envelope available as `err.data` and
 * the status as `err.status`.
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  configureApi();
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
