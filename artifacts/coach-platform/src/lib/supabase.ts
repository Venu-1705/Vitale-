import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Auth client (coach + admin platform). Persists the session and
 * auto-refreshes the access token. The token is fed into the API transport via
 * lib/session (kept fresh by the onAuthStateChange listener in App.tsx).
 */
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
