import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";
import { withAuth } from "next-auth/middleware";

import { rateLimit, getRateLimitHeaders } from "@/server/rate-limit";

// ---------------------------------------------------------------------------
// CORS configuration
// ---------------------------------------------------------------------------
// In production, restrict `allowedOrigins` to the actual web and mobile app
// domains (e.g. ["https://app.example.com"]). Using "*" here is intentional
// for development and early-stage deployments where the mobile app's origin
// varies (Expo Go, local dev servers, TestFlight builds, etc.).
// ---------------------------------------------------------------------------
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With, Accept, X-CSRF-Token",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400", // 24 hours
  "Access-Control-Expose-Headers":
    "X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After",
};

// ---------------------------------------------------------------------------
// Security headers applied to every API response
// ---------------------------------------------------------------------------
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
};

// ---------------------------------------------------------------------------
// Rate-limit tiers (per IP, per minute)
// ---------------------------------------------------------------------------
const ONE_MINUTE = 60_000;

const RATE_LIMITS = {
  auth: { limit: 10, windowMs: ONE_MINUTE },
  write: { limit: 30, windowMs: ONE_MINUTE },
  read: { limit: 60, windowMs: ONE_MINUTE },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isAuthRoute(pathname: string): boolean {
  return pathname.startsWith("/api/auth/");
}

function isWriteMethod(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

function addHeaders(
  response: NextResponse,
  headers: Record<string, string>,
): void {
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
}

// ---------------------------------------------------------------------------
// Routes that are exempt from rate limiting
// ---------------------------------------------------------------------------
// The health endpoint is used by monitoring / load-balancers and should never
// be throttled. The Stripe webhook route authenticates via its own signature
// and has its own named rate limiter in the handler.
const RATE_LIMIT_EXEMPT = new Set(["/api/health", "/api/stripe/webhook"]);

// ---------------------------------------------------------------------------
// API middleware — CORS, security headers, rate limiting
// ---------------------------------------------------------------------------

function handleApiRoute(request: NextRequest): NextResponse | undefined {
  const { pathname } = request.nextUrl;

  // ---- Preflight (OPTIONS) ------------------------------------------------
  if (request.method === "OPTIONS") {
    const preflightResponse = new NextResponse(null, { status: 204 });
    addHeaders(preflightResponse, CORS_HEADERS);
    addHeaders(preflightResponse, SECURITY_HEADERS);
    return preflightResponse;
  }

  // ---- Rate limiting ------------------------------------------------------
  if (!RATE_LIMIT_EXEMPT.has(pathname)) {
    const ip = getClientIp(request);
    let tier: keyof typeof RATE_LIMITS;

    if (isAuthRoute(pathname)) {
      tier = "auth";
    } else if (isWriteMethod(request.method)) {
      tier = "write";
    } else {
      tier = "read";
    }

    const { limit, windowMs } = RATE_LIMITS[tier];
    const result = rateLimit(`mw:${tier}:${ip}`, limit, windowMs);

    if (!result.ok) {
      const rateLimitHeaders = getRateLimitHeaders(result);
      const response = NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      );
      addHeaders(response, CORS_HEADERS);
      addHeaders(response, SECURITY_HEADERS);
      addHeaders(response, rateLimitHeaders);
      return response;
    }
  }

  // ---- Pass through -------------------------------------------------------
  // Return undefined so the caller knows we should continue to the next
  // middleware / route handler with additional headers applied.
  return undefined;
}

// ---------------------------------------------------------------------------
// Combined middleware
// ---------------------------------------------------------------------------
// We compose two concerns:
//  1. API routes  -> CORS + rate limiting + security headers
//  2. App routes  -> NextAuth session check (redirect to /sign-in)
//
// Next.js only supports a single default export for middleware, so we combine
// both into one function. The `withAuth` wrapper from next-auth is only
// invoked for `/app/*` paths (via the `authorized` callback).
// ---------------------------------------------------------------------------

// Wrap the NextAuth middleware so we can call it conditionally.
const nextAuthMiddleware = withAuth({
  pages: { signIn: "/sign-in" },
});

export default async function middleware(
  request: NextRequest,
  event: NextFetchEvent,
) {
  const { pathname } = request.nextUrl;

  // ---- API routes ---------------------------------------------------------
  if (pathname.startsWith("/api/")) {
    const earlyResponse = handleApiRoute(request);
    if (earlyResponse) return earlyResponse;

    // No early response — pass through with CORS + security headers.
    const response = NextResponse.next();
    addHeaders(response, CORS_HEADERS);
    addHeaders(response, SECURITY_HEADERS);
    return response;
  }

  // ---- App routes (NextAuth protection) -----------------------------------
  if (pathname.startsWith("/app/")) {
    // `withAuth` returns a middleware function; we invoke it here. Cast to
    // NextRequest to satisfy next-auth's extended type (NextRequestWithAuth).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (nextAuthMiddleware as any)(request, event);
  }

  // ---- Everything else — pass through ------------------------------------
  return NextResponse.next();
}

// ---------------------------------------------------------------------------
// Matcher — only run middleware on API and protected app routes.
// ---------------------------------------------------------------------------
export const config = {
  matcher: ["/api/:path*", "/app/:path*"],
};
