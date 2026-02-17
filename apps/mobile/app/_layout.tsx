import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { getToken, setOnUnauthorized } from "../src/api/client";
import { useAuthStore } from "../src/stores/auth-store";
import { colors } from "../src/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
});

export default function RootLayout() {
  const { initialize, initialized, signOut } = useAuthStore();

  // Hydrate auth state from SecureStore on mount
  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        // Validate the token by fetching the user profile
        try {
          const res = await fetch(
            `${process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000"}/api/auth/session`,
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

  // Redirect to sign-in on 401
  useEffect(() => {
    setOnUnauthorized(() => {
      signOut();
    });
  }, [signOut]);

  if (!initialized) {
    return null; // Show nothing until we know auth state
  }

  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );
}
