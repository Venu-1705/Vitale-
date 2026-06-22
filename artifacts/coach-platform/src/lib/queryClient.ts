/**
 * Shared React Query client for the coach + admin platform.
 *
 * One instance app-wide (imported by App.tsx) so every page's hooks share the
 * same cache and invalidation graph. Defaults mirror the mobile app: queries
 * stay fresh briefly and don't refetch on window focus (admin dashboards are
 * data-dense; aggressive refetch is noisy).
 */
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
