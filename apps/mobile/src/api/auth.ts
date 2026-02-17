/** Auth API — GitHub OAuth flow and session management. */
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

import { api, clearToken } from "./client";
import type { AuthSession as AuthSessionResponse, User } from "./types";

WebBrowser.maybeCompleteAuthSession();

const GITHUB_CLIENT_ID = process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID ?? "";

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: "https://github.com/login/oauth/authorize",
  tokenEndpoint: "https://github.com/login/oauth/access_token",
};

const redirectUri = AuthSession.makeRedirectUri({
  scheme: "albumconceptualizer",
  path: "auth/callback",
});

/**
 * Starts the GitHub OAuth flow using expo-auth-session, then exchanges
 * the authorization code for a JWT via the Next.js BFF.
 */
export async function signInWithGitHub(): Promise<AuthSessionResponse> {
  const request = new AuthSession.AuthRequest({
    clientId: GITHUB_CLIENT_ID,
    scopes: ["read:user", "user:email"],
    redirectUri,
  });

  const result = await request.promptAsync(discovery);

  if (result.type !== "success") {
    throw new Error(`GitHub auth failed: ${result.type}`);
  }

  const { code } = result.params;
  if (!code) {
    throw new Error("No authorization code received from GitHub");
  }

  return api.post<AuthSessionResponse>("/api/auth/mobile", { code });
}

/** Validate the current JWT and return the active session. */
export function fetchSession(): Promise<{ user: User }> {
  return api.get<{ user: User }>("/api/auth/session");
}

/** Clear the stored JWT. */
export async function signOut(): Promise<void> {
  await clearToken();
}
