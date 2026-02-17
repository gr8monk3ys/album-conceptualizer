// ---------------------------------------------------------------------------
// In-memory sliding-window rate limiter
// ---------------------------------------------------------------------------
// Provides request rate limiting without requiring Redis/Upstash. In a
// multi-instance deployment each process maintains its own window, which is
// acceptable for moderate traffic. For high-scale production deployments
// consider swapping in a Redis-backed store (the public API is compatible).
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// ---------------------------------------------------------------------------
// Periodic cleanup — sweep expired entries every 60 seconds to prevent the
// store from growing without bound.
// ---------------------------------------------------------------------------
const CLEANUP_INTERVAL_MS = 60_000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanupTimer() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) {
        store.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  // Allow the Node.js process to exit even if the timer is still running.
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

// ---------------------------------------------------------------------------
// Core rate-limit function
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp (ms) when the window resets
}

/**
 * Check and increment the rate limit for `key`.
 *
 * @param key       Unique identifier (e.g. IP address, user id, ...)
 * @param limit     Maximum number of requests allowed in the window
 * @param windowMs  Window duration in milliseconds
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  ensureCleanupTimer();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { ok: true, limit, remaining: limit - 1, reset: resetAt };
  }

  if (entry.count >= limit) {
    return { ok: false, limit, remaining: 0, reset: entry.resetAt };
  }

  entry.count++;
  return { ok: true, limit, remaining: limit - entry.count, reset: entry.resetAt };
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/**
 * Build standard rate-limit response headers from a RateLimitResult.
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.reset),
  };
  if (!result.ok) {
    const retryAfterSeconds = Math.max(
      0,
      Math.ceil((result.reset - Date.now()) / 1000),
    );
    headers["Retry-After"] = String(retryAfterSeconds);
  }
  return headers;
}

// ---------------------------------------------------------------------------
// Named rate limiters (backward-compatible with existing route code)
// ---------------------------------------------------------------------------
// The previous implementation used Upstash Redis. These named limiters match
// the old API so existing call-sites (`checkRateLimit("albums_create", key)`)
// continue to work without changes.
// ---------------------------------------------------------------------------

type LimiterName =
  | "albums_create"
  | "export_zip"
  | "preview_midi"
  | "preview_audio"
  | "stripe";

const NAMED_LIMITS: Record<LimiterName, { limit: number; windowMs: number }> = {
  albums_create: { limit: 10, windowMs: 60_000 },
  export_zip: { limit: 30, windowMs: 60_000 },
  preview_midi: { limit: 60, windowMs: 60_000 },
  preview_audio: { limit: 20, windowMs: 60_000 },
  stripe: { limit: 5, windowMs: 60_000 },
};

/**
 * Check a named rate limiter. Drop-in replacement for the previous
 * Upstash-based `checkRateLimit`.
 */
export async function checkRateLimit(
  name: LimiterName,
  key: string,
): Promise<RateLimitResult> {
  const cfg = NAMED_LIMITS[name];
  return rateLimit(`${name}:${key}`, cfg.limit, cfg.windowMs);
}
