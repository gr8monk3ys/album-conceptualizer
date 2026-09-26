import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getPrisma } from "@/server/db";
import { listAlbumReferences } from "@/server/references";

// The create route with the caller's workspace and rate limit stubbed; everything else (the
// credit charge, the album and its references) runs against the Postgres in DATABASE_URL.
const caller = vi.hoisted(() => ({ userId: "", workspaceId: "" }));
vi.mock("@/server/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/api")>();
  return {
    ...actual,
    requireWorkspace: async () => ({ userId: caller.userId, workspaceId: caller.workspaceId, plan: "free" }),
    enforceRateLimit: async () => ({}),
  };
});
vi.mock("@/server/analytics", () => ({ trackProductEventSafe: async () => {} }));

const hasDatabase = Boolean(process.env.DATABASE_URL);

function wizardAlbum(referenceAlbums: string[]) {
  return {
    title: "Harbour Lights",
    artist: "Test",
    concept_summary: "A record about a harbour town at night.",
    narrative_structure: "three-act",
    central_themes: ["distance"],
    reference_albums: referenceAlbums,
    songs: [1, 2, 3, 4].map((n) => ({
      title: `Track ${n}`,
      track_number: n,
      sections: [{ section_type: "verse", order: 1, lyrics: "" }],
    })),
  };
}

describe.skipIf(!hasDatabase)("album create carries wizard references (database)", () => {
  const prisma = hasDatabase ? getPrisma() : (null as never);

  beforeEach(async () => {
    const user = await prisma.user.create({ data: { email: `albumrefs-${crypto.randomUUID()}@test.local` } });
    const workspace = await prisma.workspace.create({ data: { name: "Refs", ownerId: user.id } });
    caller.userId = user.id;
    caller.workspaceId = workspace.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: "@test.local", startsWith: "albumrefs-" } } });
  });

  async function create(referenceAlbums: string[]) {
    const { POST } = await import("@/app/api/albums/route");
    const response = await POST(
      new Request("http://localhost/api/albums", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ album: wizardAlbum(referenceAlbums) }),
      }),
      undefined as never,
    );
    expect(response.status).toBe(201);
    return ((await response.json()) as { id: string }).id;
  }

  it("saves each wizard reference to the References collection, for the whole album", async () => {
    const albumId = await create(["Blonde — Frank Ocean", "OK Computer", "ok computer"]);
    const references = await listAlbumReferences(caller.workspaceId, albumId);
    // Each line is read as title and artist, so the References page has both.
    expect(references.map(({ title, artist }) => ({ title, artist })).sort((a, b) => a.title.localeCompare(b.title))).toEqual([
      { title: "Blonde", artist: "Frank Ocean" },
      { title: "OK Computer", artist: null },
    ]);
    for (const reference of references) {
      expect(reference).toMatchObject({ songId: null, songTrackNumber: null, songTitle: null });
    }
  });

  it("leaves the collection empty when the wizard named none", async () => {
    const albumId = await create([]);
    expect(await listAlbumReferences(caller.workspaceId, albumId)).toEqual([]);
  });
});
