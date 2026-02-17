/** Base API client with auth token injection and error handling. */
import * as SecureStore from "expo-secure-store";
import type { ApiError } from "./types";

const TOKEN_KEY = "auth_jwt";

let baseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

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

/** Global handler called when we receive a 401. Set by the auth provider. */
let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(handler: () => void) {
  onUnauthorized = handler;
}

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
