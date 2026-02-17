/** Base API client with auth token injection, 401 retry-after-refresh, and error handling. */
import * as SecureStore from "expo-secure-store";
import type { ApiError, AuthSession } from "./types";
import { config } from "../config/env";

const TOKEN_KEY = "auth_jwt";

let baseUrl = config.apiUrl;

export function setBaseUrl(url: string) {
  baseUrl = url;
}

// ── Token management ──────────────────────────────────────────────────
export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ── Fetch wrapper ─────────────────────────────────────────────────────
export class ApiClientError extends Error {
  constructor(
    public statusCode: number,
    public body: ApiError | null,
  ) {
    super(body?.message ?? `API error ${statusCode}`);
    this.name = "ApiClientError";
  }

  get isUnauthorized() {
    return this.statusCode === 401;
  }
  get isRateLimited() {
    return this.statusCode === 429;
  }
  get isPaymentRequired() {
    return this.statusCode === 402;
  }
  get isForbidden() {
    return this.statusCode === 403;
  }
  get isNotFound() {
    return this.statusCode === 404;
  }
}

/** Global handler called when refresh fails and user must be signed out. */
let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(handler: () => void) {
  onUnauthorized = handler;
}

/**
 * Global handler called when a token is silently refreshed.
 * Set by the auth provider so the store stays in sync.
 */
let onTokenRefreshed: ((jwt: string) => void) | null = null;

export function setOnTokenRefreshed(handler: (jwt: string) => void) {
  onTokenRefreshed = handler;
}

// ── Token refresh mutex ───────────────────────────────────────────────
// Ensures that if multiple requests get 401 simultaneously, only one
// refresh request is made. The others wait on the same promise.
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

/** The refresh endpoint path — called directly to avoid re-entering the interceptor. */
const REFRESH_PATH = "/api/auth/mobile-token/refresh";

/**
 * Attempt to refresh the JWT by calling the refresh endpoint directly
 * (bypassing fetchWithAuth to avoid infinite recursion).
 *
 * Returns the new token on success, or null on failure.
 */
async function doRefreshToken(currentToken: string): Promise<string | null> {
  try {
    const response = await fetch(`${baseUrl}${REFRESH_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as AuthSession;
    if (!data.jwt) return null;

    // Persist the new token
    await setToken(data.jwt);

    // Notify the auth store so in-memory state stays in sync
    if (onTokenRefreshed) {
      onTokenRefreshed(data.jwt);
    }

    return data.jwt;
  } catch {
    return null;
  }
}

/**
 * Coordinates a single refresh attempt across concurrent callers.
 * If a refresh is already in progress, subsequent callers await the same promise.
 */
async function refreshTokenWithMutex(): Promise<string | null> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;

  const token = await getToken();
  if (!token) {
    isRefreshing = false;
    refreshPromise = null;
    return null;
  }

  refreshPromise = doRefreshToken(token).finally(() => {
    isRefreshing = false;
    refreshPromise = null;
  });

  return refreshPromise;
}

// ── Core fetch with auth + 401 retry ─────────────────────────────────
async function fetchWithAuth<T>(
  path: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const token = await getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let errorBody: ApiError | null = null;
    try {
      errorBody = await response.json();
    } catch {
      // Response may not be JSON
    }

    // ── 401 Interceptor: attempt token refresh and retry ──────────
    if (response.status === 401 && path !== REFRESH_PATH && token) {
      const newToken = await refreshTokenWithMutex();

      if (newToken) {
        // Retry the original request with the fresh token
        const retryHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${newToken}`,
        };

        const retryResponse = await fetch(`${baseUrl}${path}`, {
          method,
          headers: retryHeaders,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!retryResponse.ok) {
          let retryErrorBody: ApiError | null = null;
          try {
            retryErrorBody = await retryResponse.json();
          } catch {
            // Response may not be JSON
          }
          const retryError = new ApiClientError(
            retryResponse.status,
            retryErrorBody,
          );

          // If the retry also returns 401, sign the user out
          if (retryError.isUnauthorized && onUnauthorized) {
            onUnauthorized();
          }

          throw retryError;
        }

        if (retryResponse.status === 204) {
          return undefined as T;
        }

        return retryResponse.json();
      }

      // Refresh failed — sign the user out
      if (onUnauthorized) {
        onUnauthorized();
      }

      throw new ApiClientError(response.status, errorBody);
    }

    // ── Non-401 errors or 401 without a token ─────────────────────
    const error = new ApiClientError(response.status, errorBody);

    if (error.isUnauthorized && onUnauthorized) {
      onUnauthorized();
    }

    throw error;
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// ── Convenience methods ───────────────────────────────────────────────
export const api = {
  get: <T>(path: string) => fetchWithAuth<T>(path, "GET"),
  post: <T>(path: string, body?: unknown) =>
    fetchWithAuth<T>(path, "POST", body),
  patch: <T>(path: string, body?: unknown) =>
    fetchWithAuth<T>(path, "PATCH", body),
  put: <T>(path: string, body?: unknown) =>
    fetchWithAuth<T>(path, "PUT", body),
  delete: <T>(path: string) => fetchWithAuth<T>(path, "DELETE"),
};
