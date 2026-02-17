/**
 * Proactive token refresh — checks the JWT expiry when the app comes to
 * the foreground and refreshes if it expires within 24 hours.
 */
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import type { AppStateStatus } from "react-native";

import { getToken } from "../api/client";
import { refreshToken } from "../api/auth";
import { useAuthStore } from "../stores/auth-store";
import { isTokenExpiringSoon } from "../utils/token";

/** 24 hours in milliseconds. */
const REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/**
 * Hook that listens for app foreground events and proactively refreshes
 * the JWT if it is within 24 hours of expiry.
 *
 * Should be called once in the root layout.
 */
export function useTokenRefresh() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const updateToken = useAuthStore((s) => s.updateToken);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!isAuthenticated) return;

    async function checkAndRefresh() {
      try {
        const token = await getToken();
        if (!token) return;

        if (isTokenExpiringSoon(token, REFRESH_THRESHOLD_MS)) {
          const result = await refreshToken();
          if (result?.jwt) {
            await updateToken(result.jwt);
          }
        }
      } catch {
        // Refresh failed silently — the 401 interceptor will handle
        // actual expiry when the next API call is made.
      }
    }

    // Check immediately on mount (app just opened or user just signed in)
    checkAndRefresh();

    // Check every time the app returns to the foreground
    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === "active"
        ) {
          checkAndRefresh();
        }
        appState.current = nextAppState;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, updateToken]);
}
