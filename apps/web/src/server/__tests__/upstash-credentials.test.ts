import { afterEach, describe, expect, it, vi } from "vitest";

import { getUpstashRestCredentials, hasWebRateLimitingConfigured } from "@/server/production";

function clearUpstashEnv() {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  vi.stubEnv("KV_REST_API_URL", "");
  vi.stubEnv("KV_REST_API_TOKEN", "");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Upstash rate-limit credentials", () => {
  it("is not configured when neither pair is set", () => {
    clearUpstashEnv();
    expect(getUpstashRestCredentials()).toBeNull();
    expect(hasWebRateLimitingConfigured()).toBe(false);
  });

  it("uses the UPSTASH_REDIS_REST names", () => {
    clearUpstashEnv();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://upstash.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "upstash-token");
    expect(getUpstashRestCredentials()).toEqual({ url: "https://upstash.test", token: "upstash-token" });
    expect(hasWebRateLimitingConfigured()).toBe(true);
  });

  it("falls back to the KV_REST_API names the Vercel integration sets", () => {
    clearUpstashEnv();
    vi.stubEnv("KV_REST_API_URL", "https://kv.test");
    vi.stubEnv("KV_REST_API_TOKEN", "kv-token");
    expect(getUpstashRestCredentials()).toEqual({ url: "https://kv.test", token: "kv-token" });
    expect(hasWebRateLimitingConfigured()).toBe(true);
  });

  it("prefers the UPSTASH names when both pairs are set", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://upstash.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "upstash-token");
    vi.stubEnv("KV_REST_API_URL", "https://kv.test");
    vi.stubEnv("KV_REST_API_TOKEN", "kv-token");
    expect(getUpstashRestCredentials()?.url).toBe("https://upstash.test");
  });

  it("does not mix a URL from one pair with a token from the other", () => {
    clearUpstashEnv();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://upstash.test");
    vi.stubEnv("KV_REST_API_TOKEN", "kv-token");
    expect(getUpstashRestCredentials()).toBeNull();
  });
});
