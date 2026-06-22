import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CommunityProvider } from "@/context/CommunityContext";
import { MealProvider } from "@/context/MealContext";
import { HealthProvider } from "@/context/HealthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { MessagingProvider } from "@/context/MessagingContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { CartProvider } from "@/context/CartContext";
import { configureApi, apiGet } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { setAuthToken, setUserId } from "@/lib/session";

SplashScreen.preventAutoHideAsync();

// Point the shared API transport at API_BASE before any request is made.
configureApi();

// DEMO_MODE mirrors lib/session: when set, the app runs on the legacy x-user-id
// seam and does not require a real Supabase session.
const DEMO_MODE =
  process.env.EXPO_PUBLIC_DEMO_USER_ID != null || process.env.EXPO_PUBLIC_DEMO_MODE === "true";

/**
 * Hydrates the Supabase session, keeps the access token + user id current on every
 * auth-state change (sign-in / token-refresh / sign-out), and guards routes: an
 * unauthenticated user (outside DEMO_MODE) is sent to (auth)/login; an
 * authenticated user on an (auth) screen is sent into the app.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const segments = useSegments();
  const router = useRouter();
  const [ready, setReady] = useState(DEMO_MODE);
  const [hasSession, setHasSession] = useState(false);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    if (DEMO_MODE) return;
    let mounted = true;
    function apply(session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]) {
      setAuthToken(session?.access_token ?? null);
      setUserId(session?.user.id ?? null);
      setCreatedAt(session?.user.created_at ?? null);
      setHasSession(!!session);
    }
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      apply(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      apply(session);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!ready || DEMO_MODE) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!hasSession && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (hasSession && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [ready, hasSession, segments, router]);

  // First-run onboarding: a freshly-created account (< 5 min old) with NO active access
  // grant is routed to grant-access so they connect to a coach before using the app. Runs
  // once per session; older accounts and already-connected users are untouched.
  useEffect(() => {
    if (!ready || DEMO_MODE || !hasSession || onboardingChecked || !createdAt) return;
    const ageMs = Date.now() - new Date(createdAt).getTime();
    if (ageMs > 5 * 60 * 1000) {
      setOnboardingChecked(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const env = await apiGet<{ grants: Array<{ status: string }> }>("/access-grants");
        const hasActiveGrant = (env.grants ?? []).some((g) => g.status === "active");
        if (!cancelled && !hasActiveGrant) {
          router.replace("/grant-access?firstTime=true" as any);
        }
      } catch {
        /* non-fatal: leave the user on their current screen */
      } finally {
        if (!cancelled) setOnboardingChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, hasSession, createdAt, onboardingChecked, router]);

  if (!ready) return null;
  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="create-post" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="post/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="recipe/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="search-friends" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="meal/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="weekly-report" options={{ headerShown: false }} />
      <Stack.Screen name="program/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="session/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="health-profile" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="messages" options={{ headerShown: false }} />
      <Stack.Screen name="chat/[coachId]" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="badges" options={{ headerShown: false }} />
      <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
      <Stack.Screen name="my-sessions" options={{ headerShown: false }} />
      <Stack.Screen name="book-session" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <CartProvider>
                  <CommunityProvider>
                    <MealProvider>
                      <HealthProvider>
                        <NotificationProvider>
                          <MessagingProvider>
                            <AuthGate>
                              <RootLayoutNav />
                            </AuthGate>
                          </MessagingProvider>
                        </NotificationProvider>
                      </HealthProvider>
                    </MealProvider>
                  </CommunityProvider>
                </CartProvider>
              </KeyboardProvider>
            </GestureHandlerRootView>
          </QueryClientProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
