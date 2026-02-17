/**
 * Tests for the in-memory sliding-window rate limiter.
 *
 * @module rate-limit.test
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { rateLimit, getRateLimitHeaders, checkRateLimit } from "@/server/rate-limit";

// ---------------------------------------------------------------------------
// Reset the module-level store between tests so they don't leak state.
// We do this by dynamically importing the module after resetting modules.
// Since the store is a module-level Map, we re-import fresh copies.
// ---------------------------------------------------------------------------

// The simpler approach: since `rateLimit` uses module-level state, we can
// use unique keys per test to avoid cross-contamination without needing
// module reloading.

describe("rateLimit()", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    const key = "test-under-limit";
    const result = rateLimit(key, 5, 60_000);

    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  it("decrements remaining with each call", () => {
    const key = "test-decrement";
    rateLimit(key, 3, 60_000);
    const second = rateLimit(key, 3, 60_000);
    const third = rateLimit(key, 3, 60_000);

    expect(second.ok).toBe(true);
    expect(second.remaining).toBe(1);

    expect(third.ok).toBe(true);
    expect(third.remaining).toBe(0);
  });

  it("blocks requests over the limit", () => {
    const key = "test-over-limit";
    const limit = 2;

    rateLimit(key, limit, 60_000);
    rateLimit(key, limit, 60_000);
    const blocked = rateLimit(key, limit, 60_000);

    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets after the window expires", () => {
    const key = "test-window-reset";
    const windowMs = 10_000;

    rateLimit(key, 1, windowMs);
    const blocked = rateLimit(key, 1, windowMs);
    expect(blocked.ok).toBe(false);

    // Advance time past the window
    vi.advanceTimersByTime(windowMs + 1);

    const afterReset = rateLimit(key, 1, windowMs);
    expect(afterReset.ok).toBe(true);
    expect(afterReset.remaining).toBe(0);
  });

  it("tracks different keys independently", () => {
    const keyA = "test-key-A";
    const keyB = "test-key-B";

    // Exhaust keyA
    rateLimit(keyA, 1, 60_000);
    const blockedA = rateLimit(keyA, 1, 60_000);
    expect(blockedA.ok).toBe(false);

    // keyB should still be fresh
    const resultB = rateLimit(keyB, 1, 60_000);
    expect(resultB.ok).toBe(true);
  });

  it("returns correct reset timestamp", () => {
    const key = "test-reset-timestamp";
    const now = Date.now();
    const windowMs = 30_000;

    const result = rateLimit(key, 5, windowMs);
    expect(result.reset).toBeGreaterThanOrEqual(now + windowMs);
  });
});

describe("getRateLimitHeaders()", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns standard rate-limit headers for an allowed request", () => {
    const key = "headers-ok";
    const result = rateLimit(key, 10, 60_000);
    const headers = getRateLimitHeaders(result);

    expect(headers["X-RateLimit-Limit"]).toBe("10");
    expect(headers["X-RateLimit-Remaining"]).toBe("9");
    expect(headers["X-RateLimit-Reset"]).toBeDefined();
    expect(headers["Retry-After"]).toBeUndefined();
  });

  it("includes Retry-After header for a blocked request", () => {
    const key = "headers-blocked";

    rateLimit(key, 1, 60_000);
    const blocked = rateLimit(key, 1, 60_000);
    const headers = getRateLimitHeaders(blocked);

    expect(headers["X-RateLimit-Remaining"]).toBe("0");
    expect(headers["Retry-After"]).toBeDefined();
    expect(Number(headers["Retry-After"])).toBeGreaterThan(0);
  });
});

describe("checkRateLimit() (named limiters)", () => {
  it("uses the correct limit for albums_create", async () => {
    const key = "named-albums-create";
    const result = await checkRateLimit("albums_create", key);

    expect(result.ok).toBe(true);
    expect(result.limit).toBe(10);
    expect(result.remaining).toBe(9);
  });

  it("blocks after exceeding the named limit", async () => {
    const key = "named-exhaust";
    // stripe has a limit of 5
    for (let i = 0; i < 5; i++) {
      await checkRateLimit("stripe", key);
    }
    const blocked = await checkRateLimit("stripe", key);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
  });
});
