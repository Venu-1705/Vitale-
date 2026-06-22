import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Auth client (mobile). Persists the session in AsyncStorage and
 * auto-refreshes the access token. `detectSessionInUrl` is off (no web URL flow
 * in a native app). The access token feeds the API transport via lib/session,
 * kept fresh by the onAuthStateChange listener in app/_layout.tsx.
 */
const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").trim();
const anonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
