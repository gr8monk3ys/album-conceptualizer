import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AlbumJsonSchema, type AlbumJson } from "@/server/album-json";
import { buildAlbumMutationData, writeAlbumSnapshot } from "@/server/album-sync";
import { getPrisma } from "@/server/db";

// Writes to one Album snapshot from several places at once: two Studio saves, a Studio save
// racing a Sound bible or demo save, two demo saves. The routes run with the caller's
// workspace stubbed; everything else runs against the Postgres in DATABASE_URL.
const caller = vi.hoisted(() => ({ userId: "", workspaceId: "" }));
vi.mock("@/server/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/api")>();
  return {
    ...actual,
    requireWorkspace: async () => ({ userId: caller.userId, workspaceId: caller.workspaceId, plan: "free" }),
  };
});
vi.mock("@/server/analytics", () => ({ trackProductEventSafe: async () => {} }));

const hasDatabase = Boolean(process.env.DATABASE_URL);

function albumWithLyrics(lyrics: string): AlbumJson {
  return AlbumJsonSchema.parse({
    title: "Harbour Lights",
    songs: [1, 2, 3].map((n) => ({
      title: `Track ${n}`,
      track_number: n,
      sections: [{ section_type: "verse", order: 0, lyrics }],
    })),
  });
}

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const context = (albumId: string) => ({ params: Promise.resolve({ albumId }) });

describe.skipIf(!hasDatabase)("album snapshot writes (database)", () => {
  const prisma = hasDatabase ? getPrisma() : (null as never);
  let albumId = "";

  beforeEach(async () => {
    const user = await prisma.user.create({ data: { email: `snapshot-${crypto.randomUUID()}@test.local` } });
    const workspace = await prisma.workspace.create({ data: { name: "Snapshots", ownerId: user.id } });
    caller.userId = user.id;
    caller.workspaceId = workspace.id;
    const album = await prisma.album.create({
      data: { workspaceId: workspace.id, ...buildAlbumMutationData(albumWithLyrics("first")) },
      select: { id: true },
    });
    albumId = album.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: "@test.local", startsWith: "snapshot-" } } });
  });

  async function storedAlbum() {
    const row = await prisma.album.findUniqueOrThrow({ where: { id: albumId }, select: { data: true } });
    return AlbumJsonSchema.parse(row.data);
  }

  async function storedLyrics() {
    const songs = await prisma.song.findMany({
      where: { albumId },
      orderBy: { trackNumber: "asc" },
      select: { sections: { select: { lyrics: true } } },
    });
    return songs.map((song) => song.sections[0]?.lyrics);
  }

  /** The Studio's copy of the album, as it was when the page loaded. */
  async function studioCopy() {
    const row = await prisma.album.findUniqueOrThrow({ where: { id: albumId }, select: { data: true } });
    return row.data as AlbumJson;
  }

  async function studioSave(album: AlbumJson) {
    const { PATCH } = await import("@/app/api/albums/[albumId]/route");
    return PATCH(jsonRequest(`/api/albums/${albumId}`, "PATCH", { album }), context(albumId));
  }

  async function addDemo(title: string) {
    const { POST } = await import("@/app/api/albums/[albumId]/rough-demos/route");
    return POST(
      jsonRequest(`/api/albums/${albumId}/rough-demos`, "POST", { title, source_kind: "voice-memo" }),
      context(albumId),
    );
  }

  async function saveStyleBible(body: unknown) {
    const { PATCH } = await import("@/app/api/albums/[albumId]/style-bible/route");
    return PATCH(jsonRequest(`/api/albums/${albumId}/style-bible`, "PATCH", body), context(albumId));
  }

  it("lets two overlapping snapshot writes both succeed, keeping the later one", async () => {
    let releaseFirst = () => {};
    const firstHolds = new Promise<void>((resolve) => (releaseFirst = resolve));
    let firstWrote = () => {};
    const firstHasWritten = new Promise<void>((resolve) => (firstWrote = resolve));

    // An autosave that has written but not yet committed when the keepalive save starts.
    const first = prisma.$transaction(
      async (tx) => {
        await writeAlbumSnapshot(tx, albumId, albumWithLyrics("older"));
        firstWrote();
        await firstHolds;
      },
      { timeout: 10_000 },
    );
    await firstHasWritten;
    const second = prisma.$transaction((tx) => writeAlbumSnapshot(tx, albumId, albumWithLyrics("newer")), {
      timeout: 10_000,
    });
    setTimeout(releaseFirst, 200);

    const results = await Promise.allSettled([first, second]);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
    expect(await storedLyrics()).toEqual(["newer", "newer", "newer"]);
    expect((await storedAlbum()).songs[0].sections[0].lyrics).toBe("newer");
  });

  it("answers 200 to two Studio saves sent at once", async () => {
    const copy = await studioCopy();
    const edited = (lyrics: string) => ({
      ...copy,
      songs: copy.songs.map((song) => ({
        ...song,
        sections: song.sections.map((section) => ({ ...section, lyrics })),
      })),
    });
    const responses = await Promise.all([studioSave(edited("autosave")), studioSave(edited("keepalive"))]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
  });

  it("keeps the Sound bible when a Studio tab opened earlier saves", async () => {
    const staleStudio = await studioCopy();

    const saved = await saveStyleBible({ lead_voice: "Close-mic alto", sonic_palette: ["tape hiss"] });
    expect(saved.status).toBe(200);

    const response = await studioSave({ ...staleStudio, title: "Harbour Lights (edit)" });
    expect(response.status).toBe(200);

    const album = await storedAlbum();
    expect(album.title).toBe("Harbour Lights (edit)");
    expect(album.style_bible).toMatchObject({ lead_voice: "Close-mic alto", sonic_palette: ["tape hiss"] });
  });

  it("keeps demos added since a Studio tab opened", async () => {
    const staleStudio = await studioCopy();
    expect((await addDemo("Kitchen memo")).status).toBe(200);

    expect((await studioSave({ ...staleStudio, title: "Renamed" })).status).toBe(200);

    const album = await storedAlbum();
    expect(album.title).toBe("Renamed");
    expect(album.rough_demos.map((demo) => demo.title)).toEqual(["Kitchen memo"]);
  });

  it("keeps both demos when two are added at once", async () => {
    const responses = await Promise.all([addDemo("Memo A"), addDemo("Memo B")]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);

    const titles = (await storedAlbum()).rough_demos.map((demo) => demo.title).sort();
    expect(titles).toEqual(["Memo A", "Memo B"]);
  });

  it("edits and deletes a demo against the album as stored at that moment", async () => {
    const added = (await (await addDemo("Memo A")).json()) as { demos: Array<{ id: string }> };
    const demoId = added.demos[0].id;
    await addDemo("Memo B");
    const route = await import("@/app/api/albums/[albumId]/rough-demos/[demoId]/route");
    const demoContext = { params: Promise.resolve({ albumId, demoId }) };

    const renamed = await route.PATCH(
      jsonRequest(`/api/albums/${albumId}/rough-demos/${demoId}`, "PATCH", {
        title: "Memo A (take 2)",
        source_kind: "rehearsal",
      }),
      demoContext,
    );
    expect(renamed.status).toBe(200);
    expect((await storedAlbum()).rough_demos.map((demo) => demo.title).sort()).toEqual([
      "Memo A (take 2)",
      "Memo B",
    ]);

    const deletes = await Promise.all([
      route.DELETE(jsonRequest(`/api/albums/${albumId}/rough-demos/${demoId}`, "DELETE", {}), demoContext),
      route.DELETE(jsonRequest(`/api/albums/${albumId}/rough-demos/${demoId}`, "DELETE", {}), demoContext),
    ]);
    expect(deletes.map((response) => response.status).sort()).toEqual([200, 404]);
    expect((await storedAlbum()).rough_demos.map((demo) => demo.title)).toEqual(["Memo B"]);
  });

  it("adds accepted tags at once without losing any, and undo takes them off", async () => {
    const apply = await import("@/app/api/albums/[albumId]/autotag/route");
    const undo = await import("@/app/api/albums/[albumId]/autotag/undo/route");
    const accept = (theme: string) =>
      apply.POST(
        jsonRequest(`/api/albums/${albumId}/autotag`, "POST", {
          accept: [{ trackNumber: 1, themes: [theme] }],
        }),
        context(albumId),
      );

    const responses = await Promise.all([accept("tide"), accept("salt")]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect((await storedAlbum()).songs[0].themes.sort()).toEqual(["salt", "tide"]);

    const before = await prisma.album.findUniqueOrThrow({ where: { id: albumId }, select: { updatedAt: true } });
    const updatedAt = (await storedAlbum()).updated_at;
    const again = (await (await accept("tide")).json()) as { added: unknown[] };
    expect(again.added).toEqual([]);
    expect((await storedAlbum()).updated_at).toBe(updatedAt);
    const after = await prisma.album.findUniqueOrThrow({ where: { id: albumId }, select: { updatedAt: true } });
    expect(after.updatedAt).toEqual(before.updatedAt);

    const removed = await undo.POST(
      jsonRequest(`/api/albums/${albumId}/autotag/undo`, "POST", {
        remove: [{ trackNumber: 1, themes: ["tide"] }],
      }),
      context(albumId),
    );
    expect(removed.status).toBe(200);
    expect((await storedAlbum()).songs[0].themes).toEqual(["salt"]);
  });

  it("refuses a Sound bible list over the limit, naming the field, and changes nothing", async () => {
    const palette = Array.from({ length: 15 }, (_, index) => `texture ${index + 1}`);
    const response = await saveStyleBible({ sonic_palette: palette });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; details?: string[] };
    expect(body.error).toMatch(/Sonic palette/);
    expect(body.error).toMatch(/12/);
    expect(body.details).toEqual(["sonic_palette: at most 12 items (15 given)"]);
    expect((await storedAlbum()).style_bible).toBeUndefined();
  });

  it("keeps a full list of 12", async () => {
    const palette = Array.from({ length: 12 }, (_, index) => `texture ${index + 1}`);
    expect((await saveStyleBible({ sonic_palette: palette })).status).toBe(200);
    expect((await storedAlbum()).style_bible?.sonic_palette).toEqual(palette);
  });
});
