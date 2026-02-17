/** JWT token utilities — decode payload and check expiry. */

interface JwtPayload {
  sub?: string;
  email?: string;
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

/**
 * Decode a JWT payload without verifying the signature.
 * This is safe for client-side expiry checks — the server still verifies
 * signatures on every request.
 */
export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // Base64url -> Base64 -> decode
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");

    // Pad to multiple of 4
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Returns true if the token's `exp` claim is within `thresholdMs`
 * milliseconds of the current time (or already expired).
 *
 * @param token     — raw JWT string
 * @param thresholdMs — how far ahead to consider "expiring soon" (default: 24 hours)
 */
export function isTokenExpiringSoon(
  token: string,
  thresholdMs: number = 24 * 60 * 60 * 1000,
): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true; // No exp claim — treat as expiring

  const expiresAtMs = payload.exp * 1000;
  const now = Date.now();

  return expiresAtMs - now <= thresholdMs;
}

/**
 * Returns true if the token is already expired.
 */
export function isTokenExpired(token: string): boolean {
  return isTokenExpiringSoon(token, 0);
}
