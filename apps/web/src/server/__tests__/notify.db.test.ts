import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { forkIntoWorkspace } from "@/server/album-fork";
import { getPrisma } from "@/server/db";
import { notifyAlbumOwner } from "@/server/notify";

// Likes and remixes tell the album's owner, against the Postgres in DATABASE_URL. The like
// route runs with only its caller stubbed.
const caller = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/server/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/api")>();
  return { ...actual, requireUser: async () => caller.userId };
});

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("album owner notifications (database)", () => {
  const prisma = hasDatabase ? getPrisma() : (null as never);
  let ownerId = "";
  let albumId = "";
  let fanId = "";
  let fanWorkspaceId = "";

  async function artist(name: string) {
    const user = await prisma.user.create({ data: { email: `notify-${crypto.randomUUID()}@test.local`, name } });
    const workspace = await prisma.workspace.create({ data: { name, ownerId: user.id } });
    return { userId: user.id, workspaceId: workspace.id };
  }

  const ownerNotifications = () =>
    prisma.notification.findMany({
      where: { userId: ownerId, albumId },
      select: { type: true, title: true, url: true, actorUserId: true, workspaceId: true },
      orderBy: { createdAt: "asc" },
    });

  beforeEach(async () => {
    const owner = await artist("Mara Vale");
    ownerId = owner.userId;
    const album = await prisma.album.create({
      data: {
        workspaceId: owner.workspaceId,
        title: "Salt Year",
        isPublic: true,
        publishedAt: new Date(),
        data: {
          title: "Salt Year",
          artist: "Mara Vale",
          songs: [{ title: "Low Water", track_number: 1, sections: [{ section_type: "verse", order: 0 }] }],
        },
      },
      select: { id: true },
    });
    albumId = album.id;
    const fan = await artist("Theo Lind");
    fanId = fan.userId;
    fanWorkspaceId = fan.workspaceId;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: "@test.local", startsWith: "notify-" } } });
  });

  it("tells the owner who liked the album, linking to its Overview", async () => {
    expect(await notifyAlbumOwner(prisma, { albumId, actorUserId: fanId, kind: "like" })).toBe(true);
    const [owner] = await prisma.workspace.findMany({ where: { ownerId }, select: { id: true } });
    expect(await ownerNotifications()).toEqual([
      {
        type: "like",
        title: "Theo Lind liked Salt Year",
        url: `/app/albums/${albumId}`,
        actorUserId: fanId,
        workspaceId: owner?.id,
      },
    ]);
  });

  it("never tells the owner about their own like or remix", async () => {
    expect(await notifyAlbumOwner(prisma, { albumId, actorUserId: ownerId, kind: "like" })).toBe(false);
    expect(await notifyAlbumOwner(prisma, { albumId, actorUserId: ownerId, kind: "remix" })).toBe(false);
    expect(await ownerNotifications()).toEqual([]);
  });

  it("notifies a like once per liker, even after an unlike and a like again", async () => {
    const { POST, DELETE } = await import("@/app/api/albums/[albumId]/like/route");
    // A fresh context per call, as the router gives each request its own.
    const context = () => ({ params: Promise.resolve({ albumId }) });
    caller.userId = fanId;
    const request = () => new Request(`http://test/api/albums/${albumId}/like`, { method: "POST" });

    expect((await POST(request(), context())).status).toBe(200);
    expect((await POST(request(), context())).status).toBe(200);
    expect((await DELETE(request(), context())).status).toBe(200);
    expect((await POST(request(), context())).status).toBe(200);

    const notes = await ownerNotifications();
    expect(notes.map((note) => note.title)).toEqual(["Theo Lind liked Salt Year"]);

    // The owner liking their own album stays quiet.
    caller.userId = ownerId;
    await POST(request(), context());
    expect(await ownerNotifications()).toHaveLength(1);
  });

  it("tells the owner about every remix, and the remix records where it came from", async () => {
    const remix = () =>
      forkIntoWorkspace({
        source: { title: "Salt Year", artist: "Mara Vale", songs: [] },
        sourceAlbumId: albumId,
        workspaceId: fanWorkspaceId,
        plan: "free",
        userId: fanId,
        versionMessage: "Forked from Discover",
        creditMetadata: { source: "test" },
      });
    const firstId = await remix();
    const secondId = await remix();

    const notes = await ownerNotifications();
    expect(notes.map((note) => [note.type, note.title])).toEqual([
      ["remix", "Theo Lind remixed Salt Year"],
      ["remix", "Theo Lind remixed Salt Year"],
    ]);

    const created = await prisma.album.findUnique({ where: { id: firstId }, select: { title: true, artist: true, data: true } });
    // The remix keeps the original's title; only a second one in the same workspace is told apart.
    expect(created?.title).toBe("Salt Year");
    expect((created?.data as { title?: unknown }).title).toBe("Salt Year");
    const second = await prisma.album.findUnique({ where: { id: secondId }, select: { title: true } });
    expect(second?.title).toBe("Salt Year (Remix)");
    expect(created?.artist).toBe("Theo Lind");
    expect((created?.data as { remixed_from?: unknown }).remixed_from).toEqual({
      album_id: albumId,
      title: "Salt Year",
      artist: "Mara Vale",
    });
  });

  it("names someone without a name as another artist", async () => {
    await prisma.user.update({ where: { id: fanId }, data: { name: null } });
    await notifyAlbumOwner(prisma, { albumId, actorUserId: fanId, kind: "remix" });
    expect((await ownerNotifications()).map((note) => note.title)).toEqual(["Another artist remixed Salt Year"]);
  });
});
