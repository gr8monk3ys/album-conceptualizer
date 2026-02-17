/** Auth state store — manages JWT token and current user. */
import { create } from "zustand";
import { clearToken, setToken } from "../api/client";
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

  signOut: async () => {
    await clearToken();
    set({ user: null, isAuthenticated: false });
  },
}));
