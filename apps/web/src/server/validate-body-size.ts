// ---------------------------------------------------------------------------
// Request body size validation
// ---------------------------------------------------------------------------
// Validates the Content-Length header against configurable maximums. This is a
// lightweight first line of defence; the underlying platform (Vercel, Node,
// nginx, etc.) may enforce its own limits, but checking early means we can
// return a clear 413 before buffering the entire request.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

/** Default maximum body size: 1 MB */
export const DEFAULT_MAX_BODY_SIZE = 1 * 1024 * 1024;

/** Maximum body size for voice memo uploads: 10 MB */
export const VOICE_MEMO_MAX_BODY_SIZE = 10 * 1024 * 1024;

export interface BodySizeValidation {
  /** Whether the Content-Length is within the allowed maximum. */
  ok: boolean;
  /** The Content-Length value parsed from the request (null if missing). */
  contentLength: number | null;
}

/**
 * Validate the request body size using the Content-Length header.
 *
 * @param request  The incoming request.
 * @param maxBytes Maximum allowed body size in bytes (defaults to 1 MB).
 * @returns An object indicating whether the body size is acceptable.
 */
export function validateBodySize(
  request: Request,
  maxBytes: number = DEFAULT_MAX_BODY_SIZE,
): BodySizeValidation {
  const raw = request.headers.get("content-length");
  if (!raw) {
    // No Content-Length header — allow the request (the body will be checked
    // downstream when it's actually read, and servers typically enforce a
    // transfer limit anyway).
    return { ok: true, contentLength: null };
  }

  const contentLength = parseInt(raw, 10);
  if (isNaN(contentLength) || contentLength < 0) {
    return { ok: false, contentLength: null };
  }

  return { ok: contentLength <= maxBytes, contentLength };
}

/**
 * Convenience helper that returns a 413 NextResponse when the body exceeds
 * `maxBytes`, or `null` if the request is within limits.
 *
 * Usage in a route handler:
 * ```ts
 * const tooLarge = rejectOversizedBody(request, VOICE_MEMO_MAX_BODY_SIZE);
 * if (tooLarge) return tooLarge;
 * ```
 */
export function rejectOversizedBody(
  request: Request,
  maxBytes: number = DEFAULT_MAX_BODY_SIZE,
): NextResponse | null {
  const { ok, contentLength } = validateBodySize(request, maxBytes);
  if (ok) return null;

  const maxMB = (maxBytes / (1024 * 1024)).toFixed(1);
  const actualMB =
    contentLength !== null
      ? (contentLength / (1024 * 1024)).toFixed(1)
      : "unknown";

  return NextResponse.json(
    {
      error: `Request body too large. Maximum allowed size is ${maxMB} MB, but received ${actualMB} MB.`,
    },
    { status: 413 },
  );
}
