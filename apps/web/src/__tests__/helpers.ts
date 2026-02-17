/**
 * Shared test helpers — mock factories for auth, workspace, Prisma, and
 * Request objects used across all backend tests.
 */

import type { Session } from "next-auth";

// ---------------------------------------------------------------------------
// Mock user / session
// ---------------------------------------------------------------------------

export const TEST_USER = {
  id: "user_test_001",
  name: "Test User",
  email: "test@example.com",
  image: null,
};

export function mockSession(overrides?: Partial<Session>): Session {
  return {
    user: { ...TEST_USER },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock workspace
// ---------------------------------------------------------------------------

export const TEST_WORKSPACE = {
  id: "ws_test_001",
  name: "Test Workspace",
  ownerId: TEST_USER.id,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  subscription: { plan: "free", status: "active" },
};

// ---------------------------------------------------------------------------
// Mock Prisma client
// ---------------------------------------------------------------------------

/**
 * Creates a minimal mock Prisma client whose model methods are vi.fn() stubs.
 * Callers should configure return values with `.mockResolvedValue()` etc.
 */
export function mockPrismaClient() {
  const modelMethods = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: "mock_id" }),
    update: vi.fn().mockResolvedValue({ id: "mock_id" }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    delete: vi.fn().mockResolvedValue({ id: "mock_id" }),
    count: vi.fn().mockResolvedValue(0),
    upsert: vi.fn().mockResolvedValue({ id: "mock_id" }),
  });

  return {
    album: modelMethods(),
    song: modelMethods(),
    section: modelMethods(),
    user: modelMethods(),
    workspace: modelMethods(),
    creditBalance: modelMethods(),
    creditLedgerEntry: modelMethods(),
    $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      // Pass the same mock prisma as the transaction client.
      return fn(mockPrismaClient());
    }),
  };
}

// ---------------------------------------------------------------------------
// Request builder
// ---------------------------------------------------------------------------

interface MockRequestOptions {
  method?: string;
  url?: string;
  body?: unknown;
  headers?: Record<string, string>;
  searchParams?: Record<string, string>;
}

/**
 * Build a standard `Request` object suitable for passing to Next.js route
 * handlers.
 */
export function buildRequest(opts: MockRequestOptions = {}): Request {
  const {
    method = "GET",
    url: rawUrl = "http://localhost:3000/api/test",
    body,
    headers: extraHeaders = {},
    searchParams,
  } = opts;

  let url = rawUrl;
  if (searchParams) {
    const u = new URL(rawUrl);
    for (const [k, v] of Object.entries(searchParams)) {
      u.searchParams.set(k, v);
    }
    url = u.toString();
  }

  const headers = new Headers(extraHeaders);

  const init: RequestInit = { method, headers };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
    headers.set("content-type", "application/json");
  }

  return new Request(url, init);
}
