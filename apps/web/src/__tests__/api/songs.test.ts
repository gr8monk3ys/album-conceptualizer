/**
 * Tests for the songs API route handlers:
 *   POST /api/albums/[albumId]/songs
 *   PATCH /api/albums/[albumId]/songs/[songId]
 *   DELETE /api/albums/[albumId]/songs/[songId]
 *
 * @module songs.test
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TEST_USER, TEST_WORKSPACE, mockSession, buildRequest } from "../helpers";

// ---------------------------------------------------------------------------
// Mock dependencies
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

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

// Import route handlers
import { POST as createSong, GET as listSongs } from "@/app/api/albums/[albumId]/songs/route";
import { PATCH as updateSong, DELETE as deleteSong } from "@/app/api/albums/[albumId]/songs/[songId]/route";

// ---------------------------------------------------------------------------
// Typed mocks
// ---------------------------------------------------------------------------

const mockGetAuthSession = vi.mocked(getAuthSession);
const mockGetPrisma = vi.mocked(getPrisma);
const mockGetActiveWorkspace = vi.mocked(getActiveWorkspaceForUser);

function setupAuthedMocks() {
  mockGetAuthSession.mockResolvedValue(mockSession());
  mockGetActiveWorkspace.mockResolvedValue(TEST_WORKSPACE as never);
}

function setupMockPrisma() {
  const prisma = {
    album: {
      findFirst: vi.fn().mockResolvedValue({ id: "album_1" }),
      update: vi.fn().mockResolvedValue({ id: "album_1" }),
    },
    song: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: "song_new",
        albumId: "album_1",
        trackNumber: 1,
        title: "New Song",
        key: null,
        tempo: null,
        narrativeSummary: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        sections: [],
      }),
      update: vi.fn().mockResolvedValue({
        id: "song_1",
        albumId: "album_1",
        trackNumber: 1,
        title: "Updated Song",
        key: "C",
        tempo: 120,
        narrativeSummary: "Updated summary",
        createdAt: new Date(),
        updatedAt: new Date(),
        sections: [],
      }),
      delete: vi.fn().mockResolvedValue({ id: "song_1" }),
      count: vi.fn().mockResolvedValue(3),
    },
  };
  mockGetPrisma.mockReturnValue(prisma as never);
  return prisma;
}

// Params promise helper (Next.js route handlers receive params as a Promise)
function makeParams<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

// ---------------------------------------------------------------------------
// POST /api/albums/[albumId]/songs
// ---------------------------------------------------------------------------

describe("POST /api/albums/[albumId]/songs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    mockGetAuthSession.mockResolvedValue(null);

    const request = buildRequest({
      method: "POST",
      url: "http://localhost:3000/api/albums/album_1/songs",
      body: { title: "Song 1", trackNumber: 1 },
    });
    const response = await createSong(request, { params: makeParams({ albumId: "album_1" }) });

    expect(response.status).toBe(401);
  });

  it("creates a song successfully", async () => {
    setupAuthedMocks();
    const prisma = setupMockPrisma();

    const request = buildRequest({
      method: "POST",
      url: "http://localhost:3000/api/albums/album_1/songs",
      body: { title: "My New Song", trackNumber: 1 },
    });
    const response = await createSong(request, { params: makeParams({ albumId: "album_1" }) });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.song).toBeDefined();
    expect(body.song.id).toBe("song_new");
    expect(prisma.song.create).toHaveBeenCalled();
    expect(prisma.album.update).toHaveBeenCalled(); // track count update
  });

  it("returns 404 when album does not exist", async () => {
    setupAuthedMocks();
    const prisma = setupMockPrisma();
    prisma.album.findFirst.mockResolvedValue(null);

    const request = buildRequest({
      method: "POST",
      url: "http://localhost:3000/api/albums/nonexistent/songs",
      body: { title: "Song 1", trackNumber: 1 },
    });
    const response = await createSong(request, { params: makeParams({ albumId: "nonexistent" }) });

    expect(response.status).toBe(404);
  });

  it("returns 400 for invalid payload (missing title)", async () => {
    setupAuthedMocks();
    setupMockPrisma();

    const request = buildRequest({
      method: "POST",
      url: "http://localhost:3000/api/albums/album_1/songs",
      body: { trackNumber: 1 }, // Missing title
    });
    const response = await createSong(request, { params: makeParams({ albumId: "album_1" }) });

    expect(response.status).toBe(400);
  });

  it("returns 409 for duplicate track number", async () => {
    setupAuthedMocks();
    const prisma = setupMockPrisma();
    prisma.song.findFirst.mockResolvedValue({ id: "existing_song" });

    const request = buildRequest({
      method: "POST",
      url: "http://localhost:3000/api/albums/album_1/songs",
      body: { title: "Duplicate", trackNumber: 1 },
    });
    const response = await createSong(request, { params: makeParams({ albumId: "album_1" }) });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toContain("Track number");
  });

  it("returns 400 for invalid trackNumber (too high)", async () => {
    setupAuthedMocks();
    setupMockPrisma();

    const request = buildRequest({
      method: "POST",
      url: "http://localhost:3000/api/albums/album_1/songs",
      body: { title: "Song", trackNumber: 100 }, // Max is 99
    });
    const response = await createSong(request, { params: makeParams({ albumId: "album_1" }) });

    expect(response.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/albums/[albumId]/songs
// ---------------------------------------------------------------------------

describe("GET /api/albums/[albumId]/songs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    mockGetAuthSession.mockResolvedValue(null);

    const request = buildRequest({ url: "http://localhost:3000/api/albums/album_1/songs" });
    const response = await listSongs(request, { params: makeParams({ albumId: "album_1" }) });

    expect(response.status).toBe(401);
  });

  it("returns songs for a valid album", async () => {
    setupAuthedMocks();
    const prisma = setupMockPrisma();
    prisma.album.findFirst.mockResolvedValue({ id: "album_1" });
    prisma.song.findMany.mockResolvedValue([
      { id: "s1", title: "Song 1", trackNumber: 1, sections: [] },
      { id: "s2", title: "Song 2", trackNumber: 2, sections: [] },
    ]);

    const request = buildRequest({ url: "http://localhost:3000/api/albums/album_1/songs" });
    const response = await listSongs(request, { params: makeParams({ albumId: "album_1" }) });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.songs).toHaveLength(2);
  });

  it("returns 404 for wrong album", async () => {
    setupAuthedMocks();
    const prisma = setupMockPrisma();
    prisma.album.findFirst.mockResolvedValue(null);

    const request = buildRequest({ url: "http://localhost:3000/api/albums/wrong_id/songs" });
    const response = await listSongs(request, { params: makeParams({ albumId: "wrong_id" }) });

    expect(response.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/albums/[albumId]/songs/[songId]
// ---------------------------------------------------------------------------

describe("PATCH /api/albums/[albumId]/songs/[songId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    mockGetAuthSession.mockResolvedValue(null);

    const request = buildRequest({
      method: "PATCH",
      url: "http://localhost:3000/api/albums/album_1/songs/song_1",
      body: { title: "Updated" },
    });
    const response = await updateSong(request, {
      params: makeParams({ albumId: "album_1", songId: "song_1" }),
    });

    expect(response.status).toBe(401);
  });

  it("updates a song successfully", async () => {
    setupAuthedMocks();
    const prisma = setupMockPrisma();
    prisma.song.findFirst.mockResolvedValue({ id: "song_1", albumId: "album_1" });

    const request = buildRequest({
      method: "PATCH",
      url: "http://localhost:3000/api/albums/album_1/songs/song_1",
      body: { title: "Updated Title", tempo: 140 },
    });
    const response = await updateSong(request, {
      params: makeParams({ albumId: "album_1", songId: "song_1" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.song).toBeDefined();
    expect(prisma.song.update).toHaveBeenCalled();
  });

  it("returns 404 for a song that does not belong to the album", async () => {
    setupAuthedMocks();
    const prisma = setupMockPrisma();
    prisma.song.findFirst.mockResolvedValue(null);

    const request = buildRequest({
      method: "PATCH",
      url: "http://localhost:3000/api/albums/album_1/songs/wrong_song",
      body: { title: "Updated" },
    });
    const response = await updateSong(request, {
      params: makeParams({ albumId: "album_1", songId: "wrong_song" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 400 for an empty update", async () => {
    setupAuthedMocks();
    setupMockPrisma();

    const request = buildRequest({
      method: "PATCH",
      url: "http://localhost:3000/api/albums/album_1/songs/song_1",
      body: {},
    });
    const response = await updateSong(request, {
      params: makeParams({ albumId: "album_1", songId: "song_1" }),
    });

    expect(response.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/albums/[albumId]/songs/[songId]
// ---------------------------------------------------------------------------

describe("DELETE /api/albums/[albumId]/songs/[songId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    mockGetAuthSession.mockResolvedValue(null);

    const request = buildRequest({
      method: "DELETE",
      url: "http://localhost:3000/api/albums/album_1/songs/song_1",
    });
    const response = await deleteSong(request, {
      params: makeParams({ albumId: "album_1", songId: "song_1" }),
    });

    expect(response.status).toBe(401);
  });

  it("deletes a song successfully", async () => {
    setupAuthedMocks();
    const prisma = setupMockPrisma();
    prisma.song.findFirst.mockResolvedValue({ id: "song_1", albumId: "album_1" });

    const request = buildRequest({
      method: "DELETE",
      url: "http://localhost:3000/api/albums/album_1/songs/song_1",
    });
    const response = await deleteSong(request, {
      params: makeParams({ albumId: "album_1", songId: "song_1" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(prisma.song.delete).toHaveBeenCalledWith({ where: { id: "song_1" } });
    expect(prisma.album.update).toHaveBeenCalled(); // track count update
  });

  it("returns 404 when the song does not exist", async () => {
    setupAuthedMocks();
    const prisma = setupMockPrisma();
    prisma.song.findFirst.mockResolvedValue(null);

    const request = buildRequest({
      method: "DELETE",
      url: "http://localhost:3000/api/albums/album_1/songs/nonexistent",
    });
    const response = await deleteSong(request, {
      params: makeParams({ albumId: "album_1", songId: "nonexistent" }),
    });

    expect(response.status).toBe(404);
  });

  it("updates album track count after deletion", async () => {
    setupAuthedMocks();
    const prisma = setupMockPrisma();
    prisma.song.findFirst.mockResolvedValue({ id: "song_1", albumId: "album_1" });
    prisma.song.count.mockResolvedValue(2); // After deletion, 2 songs remain

    const request = buildRequest({
      method: "DELETE",
      url: "http://localhost:3000/api/albums/album_1/songs/song_1",
    });
    await deleteSong(request, {
      params: makeParams({ albumId: "album_1", songId: "song_1" }),
    });

    expect(prisma.album.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "album_1" },
        data: { trackCount: 2 },
      }),
    );
  });
});
