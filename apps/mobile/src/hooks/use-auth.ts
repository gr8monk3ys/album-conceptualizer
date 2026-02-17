/** Auth hooks — convenience wrappers around the auth store and session API. */
import { useQuery } from "@tanstack/react-query";

import { fetchSession } from "../api/auth";
import { useAuthStore } from "../stores/auth-store";
import type { User } from "../api/types";

// ── useAuth ──────────────────────────────────────────────────────────
interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const { user, isAuthenticated, signIn, signOut } = useAuthStore();
  return { user, isAuthenticated, signIn, signOut };
}

// ── useSession ───────────────────────────────────────────────────────
/**
 * Validates the stored JWT on mount by calling the session endpoint.
 * Returns the session query result so callers can check loading/error state.
 */
export function useSession() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ["session"],
    queryFn: fetchSession,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
    retry: false,
  });
}
