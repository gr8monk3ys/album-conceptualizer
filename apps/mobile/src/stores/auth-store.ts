/** Auth state store — manages JWT token and current user. */
import { create } from "zustand";
import { clearToken, getToken, setToken } from "../api/client";
import { config } from "../config/env";
import type { User } from "../api/types";

interface AuthState {
  /** Whether we've checked SecureStore for an existing token. */
  initialized: boolean;
  /** The current authenticated user, or null. */
  user: User | null;
  /** Whether the user is authenticated. */
  isAuthenticated: boolean;

  /** Called after loading token from SecureStore on app start. */
  initialize: (user: User | null, token: string | null) => void;
  /** Sign in with a JWT and user object. */
  signIn: (token: string, user: User) => Promise<void>;
  /**
   * Update the stored token without changing the user.
   * Used by the silent token refresh interceptor.
   */
  updateToken: (token: string) => Promise<void>;
  /** Clear auth state and remove stored token. */
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  initialized: false,
  user: null,
  isAuthenticated: false,

  initialize: (user, _token) => {
    set({
      initialized: true,
      user,
      isAuthenticated: user !== null,
    });
  },

  signIn: async (token, user) => {
    await setToken(token);
    set({ user, isAuthenticated: true });
  },

  updateToken: async (token) => {
    await setToken(token);
    // Token is updated in SecureStore; user/isAuthenticated stay the same.
  },

  signOut: async () => {
    // Best-effort push token deactivation
    try {
      const Notifications = await import("expo-notifications");
      const tokenData = await Notifications.getExpoPushTokenAsync();
      if (tokenData?.data) {
        const jwt = await getToken();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (jwt) {
          headers["Authorization"] = `Bearer ${jwt}`;
        }
        await fetch(`${config.apiUrl}/api/auth/push-token`, {
          method: "DELETE",
          headers,
          body: JSON.stringify({ token: tokenData.data }),
        }).catch(() => {});
      }
    } catch {
      // Ignore -- best-effort deactivation
    }
    await clearToken();
    set({ user: null, isAuthenticated: false });
  },
}));
