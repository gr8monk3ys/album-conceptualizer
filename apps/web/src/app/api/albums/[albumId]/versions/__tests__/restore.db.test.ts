import type { Prisma } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AlbumJsonSchema, type AlbumJson } from "@/server/album-json";
import { buildAlbumMutationData } from "@/server/album-sync";
import { getPrisma } from "@/server/db";

// Restoring a version keeps the album it replaces as a "Before restoring …" version. That
// backup must be the album as stored when the restore takes the row lock, not as read a moment
// earlier: a Studio save that commits in between belongs in it.
const caller = vi.hoisted(() => ({
  userId: "",
  workspaceId: "",
  /** Runs after the route has looked the album up, before it restores: a save racing it. */
  afterLookup: null as null | (() => Promise<void>),
}));
vi.mock("@/server/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/api")>();
  return {
    ...actual,
    requireWorkspace: async () => ({ userId: caller.userId, workspaceId: caller.workspaceId, plan: "free" }),
    requireAlbum: (async (...args: Parameters<typeof actual.requireAlbum>) => {
      const album = await actual.requireAlbum(...args);
      const racing = caller.afterLookup;
      caller.afterLookup = null;
      if (racing) await racing();
      return album;
    }) as unknown as typeof actual.requireAlbum,
  };
});
vi.mock("@/server/analytics", () => ({ trackProductEventSafe: async () => {} }));

const hasDatabase = Boolean(process.env.DATABASE_URL);

function albumWithLyrics(lyrics: string): AlbumJson {
  return AlbumJsonSchema.parse({
    title: "Harbour Lights",
    songs: [{ title: "Track 1", track_number: 1, sections: [{ section_type: "verse", order: 0, lyrics }] }],
  });
}

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe.skipIf(!hasDatabase)("restoring a version (database)", () => {
  const prisma = hasDatabase ? getPrisma() : (null as never);
  let albumId = "";
  let versionId = "";

  beforeEach(async () => {
    caller.afterLookup = null;
    const user = await prisma.user.create({ data: { email: `restore-${crypto.randomUUID()}@test.local` } });
    const workspace = await prisma.workspace.create({ data: { name: "Restores", ownerId: user.id } });
    caller.userId = user.id;
    caller.workspaceId = workspace.id;
    const album = await prisma.album.create({
      data: { workspaceId: workspace.id, ...buildAlbumMutationData(albumWithLyrics("draft")) },
      select: { id: true },
    });
    albumId = album.id;
    const version = await prisma.albumVersion.create({
      data: { albumId, createdByUserId: user.id, message: "First pass", data: albumWithLyrics("first pass") as Prisma.InputJsonValue },
      select: { id: true },
    });
    versionId = version.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: "@test.local", startsWith: "restore-" } } });
  });

  async function studioSave(lyrics: string) {
    const { PATCH } = await import("@/app/api/albums/[albumId]/route");
    const response = await PATCH(
      jsonRequest(`/api/albums/${albumId}`, "PATCH", { album: albumWithLyrics(lyrics) }),
      { params: Promise.resolve({ albumId }) },
    );
    expect(response.status).toBe(200);
  }

  async function restore() {
    const { POST } = await import("@/app/api/albums/[albumId]/versions/[versionId]/restore/route");
    return POST(jsonRequest(`/api/albums/${albumId}/versions/${versionId}/restore`, "POST", {}), {
      params: Promise.resolve({ albumId, versionId }),
    });
  }

  async function backupLyrics() {
    const backup = await prisma.albumVersion.findFirstOrThrow({
      where: { albumId, message: "Before restoring First pass" },
      select: { data: true },
    });
    return AlbumJsonSchema.parse(backup.data).songs[0].sections[0].lyrics;
  }

  async function storedLyrics() {
    const row = await prisma.album.findUniqueOrThrow({ where: { id: albumId }, select: { data: true } });
    return AlbumJsonSchema.parse(row.data).songs[0].sections[0].lyrics;
  }

  it("restores the version and keeps the draft it replaced", async () => {
    expect((await restore()).status).toBe(200);
    expect(await storedLyrics()).toBe("first pass");
    expect(await backupLyrics()).toBe("draft");
  });

  it("keeps a Studio save that lands between the lookup and the restore in the backup", async () => {
    caller.afterLookup = () => studioSave("saved just now");

    expect((await restore()).status).toBe(200);
    expect(await storedLyrics()).toBe("first pass");
    expect(await backupLyrics()).toBe("saved just now");
  });
});
