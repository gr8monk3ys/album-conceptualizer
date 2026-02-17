/**
 * Tests for the body size validation utility.
 *
 * @module validate-body-size.test
 */
import { describe, it, expect } from "vitest";
import {
  validateBodySize,
  rejectOversizedBody,
  DEFAULT_MAX_BODY_SIZE,
  VOICE_MEMO_MAX_BODY_SIZE,
} from "@/server/validate-body-size";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requestWithContentLength(bytes: number | null): Request {
  const headers = new Headers();
  if (bytes !== null) {
    headers.set("content-length", String(bytes));
  }
  return new Request("http://localhost:3000/api/test", { headers });
}

// ---------------------------------------------------------------------------
// validateBodySize()
// ---------------------------------------------------------------------------

describe("validateBodySize()", () => {
  it("accepts requests under the default limit", () => {
    const request = requestWithContentLength(1024); // 1 KB
    const result = validateBodySize(request);

    expect(result.ok).toBe(true);
    expect(result.contentLength).toBe(1024);
  });

  it("accepts requests exactly at the limit", () => {
    const request = requestWithContentLength(DEFAULT_MAX_BODY_SIZE);
    const result = validateBodySize(request);

    expect(result.ok).toBe(true);
    expect(result.contentLength).toBe(DEFAULT_MAX_BODY_SIZE);
  });

  it("rejects requests over the default limit", () => {
    const request = requestWithContentLength(DEFAULT_MAX_BODY_SIZE + 1);
    const result = validateBodySize(request);

    expect(result.ok).toBe(false);
    expect(result.contentLength).toBe(DEFAULT_MAX_BODY_SIZE + 1);
  });

  it("accepts when using a custom higher limit", () => {
    const size = 5 * 1024 * 1024; // 5 MB
    const request = requestWithContentLength(size);
    const result = validateBodySize(request, VOICE_MEMO_MAX_BODY_SIZE);

    expect(result.ok).toBe(true);
    expect(result.contentLength).toBe(size);
  });

  it("rejects when over the custom limit", () => {
    const size = VOICE_MEMO_MAX_BODY_SIZE + 1;
    const request = requestWithContentLength(size);
    const result = validateBodySize(request, VOICE_MEMO_MAX_BODY_SIZE);

    expect(result.ok).toBe(false);
    expect(result.contentLength).toBe(size);
  });

  it("allows requests with missing Content-Length header", () => {
    const request = requestWithContentLength(null);
    const result = validateBodySize(request);

    expect(result.ok).toBe(true);
    expect(result.contentLength).toBeNull();
  });

  it("rejects requests with invalid Content-Length header", () => {
    const headers = new Headers();
    headers.set("content-length", "not-a-number");
    const request = new Request("http://localhost:3000/api/test", { headers });
    const result = validateBodySize(request);

    expect(result.ok).toBe(false);
    expect(result.contentLength).toBeNull();
  });

  it("rejects requests with negative Content-Length", () => {
    const request = requestWithContentLength(-100);
    const result = validateBodySize(request);

    expect(result.ok).toBe(false);
    expect(result.contentLength).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// rejectOversizedBody()
// ---------------------------------------------------------------------------

describe("rejectOversizedBody()", () => {
  it("returns null for requests under the limit", () => {
    const request = requestWithContentLength(512);
    const response = rejectOversizedBody(request);

    expect(response).toBeNull();
  });

  it("returns a 413 response for oversized requests", async () => {
    const request = requestWithContentLength(DEFAULT_MAX_BODY_SIZE + 1000);
    const response = rejectOversizedBody(request);

    expect(response).not.toBeNull();
    expect(response!.status).toBe(413);

    const body = await response!.json();
    expect(body.error).toContain("Request body too large");
  });

  it("returns null when Content-Length is missing", () => {
    const request = requestWithContentLength(null);
    const response = rejectOversizedBody(request);

    expect(response).toBeNull();
  });

  it("returns 413 with correct size info in error message", async () => {
    const twoMB = 2 * 1024 * 1024;
    const request = requestWithContentLength(twoMB);
    const response = rejectOversizedBody(request, DEFAULT_MAX_BODY_SIZE);

    expect(response).not.toBeNull();
    const body = await response!.json();
    // Should mention 1.0 MB max and 2.0 MB received
    expect(body.error).toContain("1.0 MB");
    expect(body.error).toContain("2.0 MB");
  });

  it("uses custom max size for voice memos", () => {
    const eightMB = 8 * 1024 * 1024;
    const request = requestWithContentLength(eightMB);
    const response = rejectOversizedBody(request, VOICE_MEMO_MAX_BODY_SIZE);

    expect(response).toBeNull(); // 8 MB < 10 MB
  });
});

// ---------------------------------------------------------------------------
// Exported constants
// ---------------------------------------------------------------------------

describe("exported constants", () => {
  it("DEFAULT_MAX_BODY_SIZE is 1 MB", () => {
    expect(DEFAULT_MAX_BODY_SIZE).toBe(1 * 1024 * 1024);
  });

  it("VOICE_MEMO_MAX_BODY_SIZE is 10 MB", () => {
    expect(VOICE_MEMO_MAX_BODY_SIZE).toBe(10 * 1024 * 1024);
  });
});
