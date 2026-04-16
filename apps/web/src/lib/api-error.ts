/**
 * Parse an error message from a failed API response.
 * Tries JSON { error: string } first, falls back to status code.
 */
export async function parseApiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown };
    if (typeof data?.error === "string") return data.error;
    return fallback;
  } catch {
    return `${fallback} (HTTP ${res.status})`;
  }
}
