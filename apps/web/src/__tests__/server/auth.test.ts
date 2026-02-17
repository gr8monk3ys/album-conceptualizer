/**
 * Tests for auth helpers: getAuthSession, getMobileJwtSecret, and Bearer token
 * validation.
 *
 * @module auth.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock external dependencies BEFORE importing the module under test.
// ---------------------------------------------------------------------------

// Mock next-auth/next
vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

// Mock @/server/db
vi.mock("@/server/db", () => ({
  getPrisma: vi.fn(),
}));

// Mock jose
vi.mock("jose", () => ({
  jwtVerify: vi.fn(),
}));

// Mock next-auth providers and adapter (needed by buildAuthOptions)
vi.mock("next-auth/providers/github", () => ({
  default: vi.fn(() => ({ id: "github", name: "GitHub" })),
}));
vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn(() => ({ id: "credentials", name: "Credentials" })),
}));
vi.mock("@auth/prisma-adapter", () => ({
  PrismaAdapter: vi.fn(() => ({})),
}));

import { getServerSession } from "next-auth/next";
import { headers } from "next/headers";
import { getPrisma } from "@/server/db";
import { jwtVerify } from "jose";

// Import the module under test
import { getAuthSession, getMobileJwtSecret } from "@/server/auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockGetServerSession = vi.mocked(getServerSession);
const mockHeaders = vi.mocked(headers);
const mockGetPrisma = vi.mocked(getPrisma);
const mockJwtVerify = vi.mocked(jwtVerify);

function setupMockPrisma(overrides: Record<string, unknown> = {}) {
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
    },
    workspace: { create: vi.fn() },
    ...overrides,
  };
  mockGetPrisma.mockReturnValue(prisma as never);
  return prisma;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getMobileJwtSecret()", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns encoded MOBILE_JWT_SECRET when set", () => {
    process.env.MOBILE_JWT_SECRET = "my-mobile-secret";
    const secret = getMobileJwtSecret();
    expect(secret).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(secret)).toBe("my-mobile-secret");
  });

  it("falls back to NEXTAUTH_SECRET when MOBILE_JWT_SECRET is not set", () => {
    delete process.env.MOBILE_JWT_SECRET;
    process.env.NEXTAUTH_SECRET = "nextauth-fallback";
    const secret = getMobileJwtSecret();
    expect(new TextDecoder().decode(secret)).toBe("nextauth-fallback");
  });

  it("throws when neither secret is set", () => {
    delete process.env.MOBILE_JWT_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    expect(() => getMobileJwtSecret()).toThrow("Neither MOBILE_JWT_SECRET nor NEXTAUTH_SECRET");
  });
});

describe("getAuthSession()", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      GITHUB_ID: "gh-id",
      GITHUB_SECRET: "gh-secret",
      NEXTAUTH_SECRET: "test-secret",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns cookie-based session when available", async () => {
    const session = {
      user: { id: "user1", name: "Alice", email: "alice@test.com", image: null },
      expires: new Date(Date.now() + 86400_000).toISOString(),
    };
    mockGetServerSession.mockResolvedValue(session);
    setupMockPrisma();

    const result = await getAuthSession();
    expect(result).toEqual(session);
    expect(result?.user?.id).toBe("user1");
  });

  it("falls back to Bearer token when no cookie session", async () => {
    // No cookie session
    mockGetServerSession.mockResolvedValue(null);

    // Set up Bearer token in headers
    const mockHeadersObj = new Headers({ authorization: "Bearer valid.jwt.token" });
    mockHeaders.mockResolvedValue(mockHeadersObj as never);

    // Set up JWT verification
    mockJwtVerify.mockResolvedValue({
      payload: { sub: "user_mobile_1", exp: Math.floor(Date.now() / 1000) + 3600 },
      protectedHeader: { alg: "HS256" },
    } as never);

    // Set up user lookup
    const prisma = setupMockPrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: "user_mobile_1",
      name: "Mobile User",
      email: "mobile@test.com",
      image: null,
    });

    const result = await getAuthSession();
    expect(result).not.toBeNull();
    expect(result?.user?.id).toBe("user_mobile_1");
  });

  it("returns null for invalid Bearer token", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const mockHeadersObj = new Headers({ authorization: "Bearer bad.token.here" });
    mockHeaders.mockResolvedValue(mockHeadersObj as never);

    // JWT verification fails
    mockJwtVerify.mockRejectedValue(new Error("Invalid token"));
    setupMockPrisma();

    const result = await getAuthSession();
    expect(result).toBeNull();
  });

  it("returns null when no auth is provided at all", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const mockHeadersObj = new Headers();
    mockHeaders.mockResolvedValue(mockHeadersObj as never);
    setupMockPrisma();

    const result = await getAuthSession();
    expect(result).toBeNull();
  });

  it("returns null when Bearer token user no longer exists in DB", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const mockHeadersObj = new Headers({ authorization: "Bearer valid.jwt.token" });
    mockHeaders.mockResolvedValue(mockHeadersObj as never);

    mockJwtVerify.mockResolvedValue({
      payload: { sub: "deleted_user", exp: Math.floor(Date.now() / 1000) + 3600 },
      protectedHeader: { alg: "HS256" },
    } as never);

    const prisma = setupMockPrisma();
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await getAuthSession();
    expect(result).toBeNull();
  });
});
