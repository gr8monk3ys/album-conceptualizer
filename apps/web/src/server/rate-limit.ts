import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { hasWebRateLimitingConfigured, isStrictProductionRuntime } from "@/server/production";

type LimiterName = "albums_create" | "export_zip" | "preview_midi" | "preview_audio" | "stripe";

type RateLimitResult = {
  ok: boolean;
  limit?: number;
  remaining?: number;
  reset?: number;
  error?: string;
  status?: number;
};

let redis: Redis | null = null;
let rateLimitInitializationIssue: string | null = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = Redis.fromEnv();
  }
} catch (err) {
  rateLimitInitializationIssue =
    err instanceof Error ? err.message : "Unable to initialize Upstash Redis.";
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
  preview_midi: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(60, "1 m"),
        prefix: "ac:ratelimit:preview_midi",
        analytics: true,
      })
    : null,
  preview_audio: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, "1 m"),
        prefix: "ac:ratelimit:preview_audio",
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

const STRICT_PRODUCTION_RATE_LIMIT_MESSAGE =
  "Rate limiting is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.";
const STRICT_PRODUCTION_RATE_LIMIT_INIT_MESSAGE =
  "Rate limiting is misconfigured. Upstash Redis could not be initialized.";

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

export function getRateLimitInitializationIssue() {
  return rateLimitInitializationIssue;
}

export function getRateLimitFailure(rate: RateLimitResult, fallbackMessage: string) {
  if (rate.error) {
    return {
      body: { error: rate.error },
      status: rate.status ?? 503,
    };
  }

  if (!rate.ok) {
    return {
      body: { error: fallbackMessage },
      headers: getRateLimitHeaders(rate),
      status: 429,
    };
  }

  return null;
}

export async function checkRateLimit(name: LimiterName, key: string): Promise<RateLimitResult> {
  const limiter = limiters[name];
  if (!limiter) {
    if (isStrictProductionRuntime()) {
      return {
        ok: false,
        error: hasWebRateLimitingConfigured()
          ? `${STRICT_PRODUCTION_RATE_LIMIT_INIT_MESSAGE} ${rateLimitInitializationIssue ?? ""}`.trim()
          : STRICT_PRODUCTION_RATE_LIMIT_MESSAGE,
        status: 503,
      };
    }
    return { ok: true };
  }

  const result = await limiter.limit(key);
  return {
    ok: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}
