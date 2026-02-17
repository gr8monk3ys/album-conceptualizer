import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import { Redirect, Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  getToken,
  setOnUnauthorized,
  setOnTokenRefreshed,
} from "../src/api/client";
import { config } from "../src/config/env";
import { ErrorBoundary, OfflineBanner } from "../src/components/ui";
import { usePushNotifications } from "../src/hooks/use-push-notifications";
import { useTokenRefresh } from "../src/hooks/use-token-refresh";
import { useAuthStore } from "../src/stores/auth-store";
import { colors } from "../src/theme";

// ── Sync React Query online state with NetInfo ────────────────────────
// This makes React Query automatically pause mutations when offline and
// retry them when the device comes back online.
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  });
});

// ── Global error handlers ─────────────────────────────────────────────
// Capture uncaught JS exceptions so the app can log them instead of
// silently crashing to a white screen.

if (typeof ErrorUtils !== "undefined") {
  const defaultHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    console.error("[Global Error]", { isFatal, error });
    // Future: report to Sentry / crash analytics here
    if (!isFatal && defaultHandler) {
      defaultHandler(error, isFatal);
    }
  });
}

// Handle unhandled promise rejections (React Native surfaces these
// through the global `unhandledrejection` event when available).
if (typeof globalThis !== "undefined") {
  // @ts-ignore -- `onunhandledrejection` exists at runtime in Hermes / RN
  globalThis.onunhandledrejection = (event: PromiseRejectionEvent) => {
    console.error("[Unhandled Promise Rejection]", event.reason);
    // Future: report to error tracking service
  };
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes — avoid refetching stale data on every focus
      gcTime: 1000 * 60 * 60 * 24, // 24 hours — keep cached data available while offline
      retry: 2,
    },
    mutations: {
      retry: 1, // Retry failed mutations once (e.g. after a brief network blip)
    },
  },
});

export default function RootLayout() {
  // ── All hooks first (React requires stable hook ordering) ───────────
  const { initialize, initialized, signOut, updateToken } = useAuthStore();
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);
  const queryClientRef = useRef(queryClient);
  // Guard to prevent sign-out from being triggered multiple times
  // concurrently (e.g. several 401s arriving at once).
  const isSigningOut = useRef(false);

  // Stable reference to the sign-out + cache-clear sequence.
  // Used by the 401 interceptor callback so we can safely await the
  // async signOut before clearing the query cache.
  const handleUnauthorized = useCallback(async () => {
    if (isSigningOut.current) return;
    isSigningOut.current = true;
    try {
      // 1. Sign out: deactivate push token, clear SecureStore, reset state
      await signOut();
      // 2. Clear query cache AFTER sign-out completes so that cache-miss
      //    refetches don't fire while auth state is still being torn down.
      queryClientRef.current.clear();
    } finally {
      isSigningOut.current = false;
    }
  }, [signOut]);

  // Hydrate auth state from SecureStore on mount
  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        // Validate the token by fetching the user profile
        try {
          const res = await fetch(
            `${config.apiUrl}/api/auth/session`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (res.ok) {
            const session = await res.json();
            initialize(session.user ?? null, token);
            return;
          }
        } catch {
          // Token invalid or network error
        }
      }
      initialize(null, null);
    })();
  }, [initialize]);

  // Check whether the user has completed onboarding
  useEffect(() => {
    (async () => {
      const value = await SecureStore.getItemAsync("hasOnboarded");
      setHasOnboarded(value === "true");
    })();
  }, []);

  // Wire up the silent-refresh callback so the auth store stays in sync
  // when the 401 interceptor refreshes a token behind the scenes.
  useEffect(() => {
    setOnTokenRefreshed((jwt: string) => {
      updateToken(jwt);
    });
  }, [updateToken]);

  // Handle unrecoverable 401: sign out and clear all cached data.
  // The callback is async and guarded against concurrent invocations
  // so that multiple simultaneous 401 responses don't race each other.
  useEffect(() => {
    setOnUnauthorized(() => {
      handleUnauthorized();
    });
  }, [handleUnauthorized]);

  // Proactive token refresh when app comes to foreground.
  // Internally guarded by isAuthenticated — no-op until auth is initialized.
  useTokenRefresh();

  // Register push notification token and subscribe to tap-to-navigate.
  // Internally guarded by isAuthenticated — no-op until auth is initialized.
  usePushNotifications();

  // ── Early returns AFTER all hooks ───────────────────────────────────
  if (!initialized || hasOnboarded === null) {
    return null; // Show nothing until we know auth + onboarding state
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <OfflineBanner />
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: "600" },
            contentStyle: { backgroundColor: colors.background },
            animation: "slide_from_right",
          }}
        >
          {!hasOnboarded && <Redirect href="/(onboarding)" />}
          <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="album/[albumId]"
            options={{ headerShown: false }}
          />
          <Stack.Screen name="create" options={{ title: "New Album" }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen name="share/[token]" options={{ title: "Shared Album" }} />
        </Stack>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
