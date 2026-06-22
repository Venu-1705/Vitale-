/**
 * The single shared React Query client for the app.
 *
 * Centralizing it here (instead of `new QueryClient()` inline in _layout.tsx)
 * gives one place to tune cache/retry defaults and lets non-component code
 * (mutations, prefetch, cache invalidation helpers) import the same instance.
 */
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // One retry smooths transient network blips without masking real 4xx/5xx.
      retry: 1,
      // Most list/detail screens tolerate ~30s of staleness before refetch.
      staleTime: 30_000,
      // RN has no window focus; disable to avoid surprise refetches.
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Mutations (checkout, enroll, cart writes) must not auto-retry —
      // a silent retry risks double-submits against non-idempotent endpoints.
      retry: 0,
    },
  },
});
