/**
 * Tests for JWT token utilities used by the mobile app.
 *
 * @module token.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { decodeJwtPayload, isTokenExpiringSoon, isTokenExpired } from "../../utils/token";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal JWT (unsigned) with the given payload for testing purposes.
 * The header and signature are placeholders since we only decode, not verify.
 */
function buildTestJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  const signature = "test-signature";

  // Convert to base64url
  const toBase64Url = (s: string) => s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${toBase64Url(header)}.${toBase64Url(body)}.${toBase64Url(signature)}`;
}

// ---------------------------------------------------------------------------
// decodeJwtPayload()
// ---------------------------------------------------------------------------

describe("decodeJwtPayload()", () => {
  it("correctly decodes a valid JWT payload", () => {
    const payload = { sub: "user_123", email: "test@example.com", iat: 1700000000, exp: 1700086400 };
    const token = buildTestJwt(payload);
    const decoded = decodeJwtPayload(token);

    expect(decoded).not.toBeNull();
    expect(decoded!.sub).toBe("user_123");
    expect(decoded!.email).toBe("test@example.com");
    expect(decoded!.iat).toBe(1700000000);
    expect(decoded!.exp).toBe(1700086400);
  });

  it("returns null for a token with fewer than 3 parts", () => {
    expect(decodeJwtPayload("only.two")).toBeNull();
    expect(decodeJwtPayload("single")).toBeNull();
    expect(decodeJwtPayload("")).toBeNull();
  });

  it("returns null for an invalid base64 payload", () => {
    const result = decodeJwtPayload("header.!!!invalid-base64!!!.signature");
    expect(result).toBeNull();
  });

  it("handles base64url encoding with URL-safe characters", () => {
    // Create a payload that would produce + and / in standard base64
    const payload = { sub: "user/with+special=chars", data: "test" };
    const token = buildTestJwt(payload);
    const decoded = decodeJwtPayload(token);

    expect(decoded).not.toBeNull();
    expect(decoded!.sub).toBe("user/with+special=chars");
  });

  it("handles payloads with extra fields", () => {
    const payload = { sub: "user_1", custom_field: "hello", nested: { a: 1 } };
    const token = buildTestJwt(payload);
    const decoded = decodeJwtPayload(token);

    expect(decoded).not.toBeNull();
    expect(decoded!.custom_field).toBe("hello");
    expect(decoded!.nested).toEqual({ a: 1 });
  });
});

// ---------------------------------------------------------------------------
// isTokenExpiringSoon()
// ---------------------------------------------------------------------------

describe("isTokenExpiringSoon()", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true for tokens expiring within the default threshold (24h)", () => {
    const now = Date.now();
    const expiresIn12Hours = Math.floor((now + 12 * 60 * 60 * 1000) / 1000);
    const token = buildTestJwt({ sub: "user_1", exp: expiresIn12Hours });

    expect(isTokenExpiringSoon(token)).toBe(true);
  });

  it("returns false for tokens with plenty of time remaining", () => {
    const now = Date.now();
    const expiresIn48Hours = Math.floor((now + 48 * 60 * 60 * 1000) / 1000);
    const token = buildTestJwt({ sub: "user_1", exp: expiresIn48Hours });

    expect(isTokenExpiringSoon(token)).toBe(false);
  });

  it("returns true for already-expired tokens", () => {
    const now = Date.now();
    const expiredOneHourAgo = Math.floor((now - 60 * 60 * 1000) / 1000);
    const token = buildTestJwt({ sub: "user_1", exp: expiredOneHourAgo });

    expect(isTokenExpiringSoon(token)).toBe(true);
  });

  it("returns true when token has no exp claim", () => {
    const token = buildTestJwt({ sub: "user_1" });
    expect(isTokenExpiringSoon(token)).toBe(true);
  });

  it("respects a custom threshold", () => {
    const now = Date.now();
    const expiresIn5Minutes = Math.floor((now + 5 * 60 * 1000) / 1000);
    const token = buildTestJwt({ sub: "user_1", exp: expiresIn5Minutes });

    // With 10-minute threshold: should be expiring soon
    expect(isTokenExpiringSoon(token, 10 * 60 * 1000)).toBe(true);

    // With 1-minute threshold: should NOT be expiring soon
    expect(isTokenExpiringSoon(token, 1 * 60 * 1000)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isTokenExpired()
// ---------------------------------------------------------------------------

describe("isTokenExpired()", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true for expired tokens", () => {
    const now = Date.now();
    const expiredOneHourAgo = Math.floor((now - 60 * 60 * 1000) / 1000);
    const token = buildTestJwt({ sub: "user_1", exp: expiredOneHourAgo });

    expect(isTokenExpired(token)).toBe(true);
  });

  it("returns false for valid (non-expired) tokens", () => {
    const now = Date.now();
    const expiresInOneHour = Math.floor((now + 60 * 60 * 1000) / 1000);
    const token = buildTestJwt({ sub: "user_1", exp: expiresInOneHour });

    expect(isTokenExpired(token)).toBe(false);
  });

  it("returns true when token has no exp claim", () => {
    const token = buildTestJwt({ sub: "user_1" });
    expect(isTokenExpired(token)).toBe(true);
  });

  it("returns true for tokens that expire exactly now (edge case)", () => {
    const now = Date.now();
    const expiresExactlyNow = Math.floor(now / 1000);
    const token = buildTestJwt({ sub: "user_1", exp: expiresExactlyNow });

    // exp * 1000 - now <= 0, so it should be expired
    expect(isTokenExpired(token)).toBe(true);
  });
});
