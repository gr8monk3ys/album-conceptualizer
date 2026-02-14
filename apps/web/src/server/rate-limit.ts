import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type LimiterName = "albums_create" | "export_zip" | "stripe";

type RateLimitResult = {
  ok: boolean;
  limit?: number;
  remaining?: number;
  reset?: number;
};

let redis: Redis | null = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = Redis.fromEnv();
  }
} catch {
  redis = null;
}

const limiters: Record<LimiterName, Ratelimit | null> = {
  albums_create: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "1 m"),
        prefix: "ac:ratelimit:albums_create",
        analytics: true,
      })
    : null,
  export_zip: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, "1 m"),
        prefix: "ac:ratelimit:export_zip",
        analytics: true,
      })
    : null,
  stripe: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "1 m"),
        prefix: "ac:ratelimit:stripe",
        analytics: true,
      })
    : null,
};

export function getRateLimitHeaders(result: RateLimitResult) {
  if (!result.limit) return {};
  const headers: Record<string, string> = {
    "x-ratelimit-limit": String(result.limit),
    "x-ratelimit-remaining": String(result.remaining ?? 0),
  };
  if (result.reset) {
    // reset is a unix timestamp in ms
    headers["x-ratelimit-reset"] = String(result.reset);
    const retryAfterSeconds = Math.max(0, Math.ceil((result.reset - Date.now()) / 1000));
    headers["retry-after"] = String(retryAfterSeconds);
  }
  return headers;
}

export async function checkRateLimit(name: LimiterName, key: string): Promise<RateLimitResult> {
  const limiter = limiters[name];
  if (!limiter) return { ok: true };

  const result = await limiter.limit(key);
  return {
    ok: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

