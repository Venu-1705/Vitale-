import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { setAuthToken } from '@/lib/session';
import type { Session } from '@supabase/supabase-js';

export type Role = 'admin' | 'coach' | 'team' | 'collab';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  organizationId: string;
  title?: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  role: Role | null;
  hydrated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithOtp: (email: string, otp: string) => Promise<boolean>;
  /** Coach signup: create the account; the org is bootstrapped on first session. */
  signUp: (email: string, password: string, businessName: string) => Promise<{ ok: boolean; error?: string; needsConfirmation?: boolean }>;
  logout: () => Promise<void>;
  /** Load any persisted Supabase session on app start. */
  hydrate: () => Promise<void>;
  /** Apply a session from supabase.auth.onAuthStateChange (sign-in/refresh/out). */
  applySession: (session: Session | null) => Promise<void>;
}

const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '/api').replace(/\/+$/, '');

// Business name captured at signup, replayed on the first authenticated session to
// bootstrap the org. Needed because email confirmation is on (signUp returns no
// session), so the org can only be created after the coach confirms + signs in.
const PENDING_ORG_KEY = 'vitale_pending_org_name';

function slugify(name: string): string {
  return (
    name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) ||
    `org-${Date.now()}`
  );
}

/** Create the coach's org via D0 — the caller becomes owner_coach (tg_sync_owner_member). */
async function createOrg(token: string, businessName: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/organizations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ businessName, slug: slugify(businessName) }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Resolve the coach's org + role from D0. owner_coach of an org ⇒ admin; any other
 * visible org membership ⇒ coach. Uses a direct fetch (not the api transport) to
 * avoid an import cycle, with the freshly-issued access token.
 */
async function resolveProfile(userId: string, token: string): Promise<{ role: Role; organizationId: string }> {
  try {
    const res = await fetch(`${API_BASE}/organizations`, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) return { role: 'coach', organizationId: '' };
    const body = (await res.json()) as { organizations?: Array<Record<string, unknown>> };
    const orgs = body.organizations ?? [];
    const ownerKey = (o: Record<string, unknown>) => (o.ownerCoachId ?? o.owner_coach_id) as string | undefined;
    const owned = orgs.find((o) => ownerKey(o) === userId);
    if (owned) return { role: 'admin', organizationId: owned.id as string };
    if (orgs[0]) return { role: 'coach', organizationId: orgs[0].id as string };
    return { role: 'coach', organizationId: '' };
  } catch {
    return { role: 'coach', organizationId: '' };
  }
}

function nameFromSession(session: Session, email: string): string {
  const meta = session.user.user_metadata as { full_name?: string; name?: string } | undefined;
  return meta?.full_name ?? meta?.name ?? email;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,
  role: null,
  hydrated: false,

  applySession: async (session) => {
    if (!session) {
      setAuthToken(null);
      set({ user: null, isAuthenticated: false, role: null, hydrated: true });
      return;
    }
    setAuthToken(session.access_token);
    const email = session.user.email ?? '';
    let { role, organizationId } = await resolveProfile(session.user.id, session.access_token);
    // First authenticated session for a coach with no org ⇒ bootstrap one. Uses the
    // name captured at signup; falls back to the profile name / email.
    if (!organizationId) {
      const pending = (() => {
        try { return localStorage.getItem(PENDING_ORG_KEY) ?? ''; } catch { return ''; }
      })();
      const businessName = pending || nameFromSession(session, email) || email || 'My Practice';
      if (await createOrg(session.access_token, businessName)) {
        try { localStorage.removeItem(PENDING_ORG_KEY); } catch { /* ignore */ }
        ({ role, organizationId } = await resolveProfile(session.user.id, session.access_token));
      }
    }
    set({
      user: { id: session.user.id, email, name: nameFromSession(session, email), role, organizationId },
      isAuthenticated: true,
      role,
      hydrated: true,
    });
  },

  hydrate: async () => {
    const { data } = await supabase.auth.getSession();
    await useAuthStore.getState().applySession(data.session);
  },

  login: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) return false;
    await useAuthStore.getState().applySession(data.session);
    return true;
  },

  loginWithOtp: async (email, otp) => {
    const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
    if (error || !data.session) return false;
    await useAuthStore.getState().applySession(data.session);
    return true;
  },

  signUp: async (email, password, businessName) => {
    // Stash the org name so applySession can bootstrap the org on the first session,
    // whether that session comes back now (auto-confirm) or after email confirmation.
    try { localStorage.setItem(PENDING_ORG_KEY, businessName); } catch { /* ignore */ }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: businessName } },
    });
    if (error) return { ok: false, error: error.message };
    // Email confirmation on ⇒ no session yet; org is bootstrapped after confirm + sign in.
    if (!data.session) return { ok: true, needsConfirmation: true };

    await useAuthStore.getState().applySession(data.session);
    return { ok: true };
  },

  logout: async () => {
    await supabase.auth.signOut();
    setAuthToken(null);
    set({ user: null, isAuthenticated: false, role: null });
  },
}));
