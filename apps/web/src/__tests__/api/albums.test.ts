/**
 * Tests for the albums API route handlers (GET & POST /api/albums).
 *
 * @module albums.test
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TEST_USER, TEST_WORKSPACE, mockSession, buildRequest } from "../helpers";

// ---------------------------------------------------------------------------
// Mock dependencies — must be set up BEFORE importing the route module.
// ---------------------------------------------------------------------------

vi.mock("@/server/auth", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  getPrisma: vi.fn(),
}));

vi.mock("@/server/workspaces", () => ({
  getActiveWorkspaceForUser: vi.fn(),
}));

vi.mock("@/server/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getRateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/server/album-sync", () => ({
  buildAlbumMutationData: vi.fn(() => ({
    title: "Test Album",
    artist: "Test Artist",
    data: {},
    trackCount: 0,
  })),
}));

vi.mock("@/server/credits", () => ({
  spendCredits: vi.fn().mockResolvedValue(45),
  InsufficientCreditsError: class InsufficientCreditsError extends Error {
    constructor(msg = "Insufficient credits.") {
      super(msg);
      this.name = "InsufficientCreditsError";
    }
  },
}));

// Import mocked modules so we can configure them per test.
import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { checkRateLimit } from "@/server/rate-limit";
import { spendCredits, InsufficientCreditsError } from "@/server/credits";

// Import route handlers under test.
import { GET, POST } from "@/app/api/albums/route";

// ---------------------------------------------------------------------------
// Typed mocks
// ---------------------------------------------------------------------------
const mockGetAuthSession = vi.mocked(getAuthSession);
const mockGetPrisma = vi.mocked(getPrisma);
const mockGetActiveWorkspace = vi.mocked(getActiveWorkspaceForUser);
const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockSpendCredits = vi.mocked(spendCredits);

function setupAuthedMocks() {
  mockGetAuthSession.mockResolvedValue(mockSession());
  mockGetActiveWorkspace.mockResolvedValue(TEST_WORKSPACE as never);
  mockCheckRateLimit.mockResolvedValue({
    ok: true,
    limit: 10,
    remaining: 9,
    reset: Date.now() + 60_000,
  });
}

function setupMockPrisma(overrides: Record<string, unknown> = {}) {
  const prisma = {
    album: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: "album_new" }),
    },
    ...overrides,
  };
  mockGetPrisma.mockReturnValue(prisma as never);
  return prisma;
}

// ---------------------------------------------------------------------------
// GET /api/albums
// ---------------------------------------------------------------------------

describe("GET /api/albums", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    mockGetAuthSession.mockResolvedValue(null);

    const request = buildRequest({ url: "http://localhost:3000/api/albums" });
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("Unauthorized");
  });

  it("returns paginated albums", async () => {
    setupAuthedMocks();
    const albums = [
      { id: "a1", title: "Album One", updatedAt: new Date() },
      { id: "a2", title: "Album Two", updatedAt: new Date() },
    ];
    const prisma = setupMockPrisma();
    prisma.album.findMany.mockResolvedValue(albums);

    const request = buildRequest({
      url: "http://localhost:3000/api/albums",
      searchParams: { limit: "2" },
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.albums).toHaveLength(2);
    expect(body.hasMore).toBe(false);
  });

  it("signals hasMore when there are more results", async () => {
    setupAuthedMocks();
    // Return limit + 1 items to indicate there are more
    const albums = [
      { id: "a1", title: "Album 1" },
      { id: "a2", title: "Album 2" },
      { id: "a3", title: "Album 3" }, // extra item
    ];
    const prisma = setupMockPrisma();
    prisma.album.findMany.mockResolvedValue(albums);

    const request = buildRequest({
      url: "http://localhost:3000/api/albums",
      searchParams: { limit: "2" },
    });
    const response = await GET(request);

    const body = await response.json();
    expect(body.hasMore).toBe(true);
    expect(body.albums).toHaveLength(2);
    expect(body.nextCursor).toBe("a2");
  });

  it("uses cursor for pagination", async () => {
    setupAuthedMocks();
    const prisma = setupMockPrisma();
    prisma.album.findMany.mockResolvedValue([]);

    const request = buildRequest({
      url: "http://localhost:3000/api/albums",
      searchParams: { cursor: "album_prev", limit: "10" },
    });
    await GET(request);

    // Verify findMany was called with cursor option
    expect(prisma.album.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: "album_prev" },
        skip: 1,
      }),
    );
  });

  it("caps limit at 50", async () => {
    setupAuthedMocks();
    const prisma = setupMockPrisma();
    prisma.album.findMany.mockResolvedValue([]);

    const request = buildRequest({
      url: "http://localhost:3000/api/albums",
      searchParams: { limit: "200" },
    });
    await GET(request);

    expect(prisma.album.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 51, // 50 + 1 for hasMore check
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/albums
// ---------------------------------------------------------------------------

describe("POST /api/albums", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    mockGetAuthSession.mockResolvedValue(null);

    const request = buildRequest({
      method: "POST",
      url: "http://localhost:3000/api/albums",
      body: { album: { title: "Test", songs: [] } },
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("creates an album successfully", async () => {
    setupAuthedMocks();
    const prisma = setupMockPrisma();
    prisma.album.create.mockResolvedValue({ id: "album_new_123" });

    const request = buildRequest({
      method: "POST",
      url: "http://localhost:3000/api/albums",
      body: {
        album: {
          title: "My New Album",
          songs: [{ title: "Track 1", track_number: 1 }],
        },
      },
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.id).toBe("album_new_123");
  });

  it("returns 400 for invalid album payload", async () => {
    setupAuthedMocks();
    setupMockPrisma();

    const request = buildRequest({
      method: "POST",
      url: "http://localhost:3000/api/albums",
      body: { album: { title: "", songs: [] } }, // title too short
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Invalid");
  });

  it("returns 429 when rate-limited", async () => {
    mockGetAuthSession.mockResolvedValue(mockSession());
    mockCheckRateLimit.mockResolvedValue({
      ok: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 60_000,
    });

    const request = buildRequest({
      method: "POST",
      url: "http://localhost:3000/api/albums",
      body: {
        album: { title: "Test", songs: [{ title: "S1", track_number: 1 }] },
      },
    });
    const response = await POST(request);

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error).toContain("Too many");
  });

  it("returns 402 when free plan album limit is reached", async () => {
    setupAuthedMocks();
    const prisma = setupMockPrisma();
    prisma.album.count.mockResolvedValue(5); // At the 5-album free tier limit

    const request = buildRequest({
      method: "POST",
      url: "http://localhost:3000/api/albums",
      body: {
        album: { title: "Sixth Album", songs: [{ title: "S1", track_number: 1 }] },
      },
    });
    const response = await POST(request);

    expect(response.status).toBe(402);
    const body = await response.json();
    expect(body.error).toContain("Free plan");
  });

  it("returns 402 when credits are insufficient", async () => {
    setupAuthedMocks();
    const prisma = setupMockPrisma();
    prisma.album.count.mockResolvedValue(2); // Under the 5-album limit

    // Use the mocked InsufficientCreditsError
    const { InsufficientCreditsError: MockedError } = await import("@/server/credits");
    mockSpendCredits.mockRejectedValue(new MockedError("Not enough credits."));

    const request = buildRequest({
      method: "POST",
      url: "http://localhost:3000/api/albums",
      body: {
        album: { title: "Credits Test", songs: [{ title: "S1", track_number: 1 }] },
      },
    });
    const response = await POST(request);

    expect(response.status).toBe(402);
    const body = await response.json();
    expect(body.error).toContain("credits");
  });
});
