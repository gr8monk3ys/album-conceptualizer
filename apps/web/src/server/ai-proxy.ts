/**
 * AI Proxy — forwards requests from Next.js API routes to the Python/CrewAI backend.
 *
 * The Python backend (FastAPI) runs on ENGINE_API_URL (default http://localhost:8000/api/v1).
 * This helper centralises the fetch-and-forward logic so individual route handlers stay thin.
 *
 * Expected Python backend endpoints (based on CrewAI agent workflows):
 *   POST /albums/{album_id}/generate        — full album generation (vision crew)
 *   POST /albums/{album_id}/songs/{song_id}/generate — single song development (song crew)
 *   POST /albums/{album_id}/songs/{song_id}/sections/{section_id}/generate — section content
 *
 * If the Python backend exposes different paths, update the constants in the route files
 * and this module will still handle the forwarding correctly.
 */

import { engineFetch } from "@/server/engine";

export interface ProxyResult {
  ok: boolean;
  status: number;
  data: unknown;
  headers?: Record<string, string>;
}

/**
 * Forward an arbitrary JSON request to the Python backend and return the
 * parsed result.  Streaming is supported — when `options.stream` is true the
 * raw `Response` object is returned so the caller can pipe it to the client.
 */
export async function proxyToAI(
  path: string,
  body: unknown,
  options?: { stream?: boolean; method?: string },
): Promise<Response> {
  const method = options?.method ?? "POST";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const response = await engineFetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  return response;
}

/**
 * Convenience wrapper that proxies and returns a standard JSON result.
 * Handles non-2xx gracefully so callers can forward the upstream error.
 */
export async function proxyToAIJson(
  path: string,
  body: unknown,
  options?: { method?: string },
): Promise<ProxyResult> {
  const response = await proxyToAI(path, body, { ...options, stream: false });

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = { detail: await response.text().catch(() => "Unknown error") };
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

/**
 * Proxy with streaming support — returns a ReadableStream suitable for
 * Next.js streaming responses.  Falls back to a regular JSON response
 * when the upstream does not stream.
 */
export async function proxyToAIStream(
  path: string,
  body: unknown,
): Promise<Response> {
  return proxyToAI(path, body, { stream: true });
}
