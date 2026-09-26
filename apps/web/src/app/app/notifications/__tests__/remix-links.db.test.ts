import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { forkIntoWorkspace } from "@/server/album-fork";
import { getPrisma } from "@/server/db";

import { publishedRemixes } from "../remix-links";

// A remix notification leads to the remix on Discover once it is published, against the
// Postgres in DATABASE_URL.
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("remix notification links (database)", () => {
  const prisma = hasDatabase ? getPrisma() : (null as never);
  let ownerId = "";
  let albumId = "";
  let fanId = "";
  let fanWorkspaceId = "";

  async function artist(name: string) {
    const user = await prisma.user.create({ data: { email: `remixlink-${crypto.randomUUID()}@test.local`, name } });
    const workspace = await prisma.workspace.create({ data: { name, ownerId: user.id } });
    return { userId: user.id, workspaceId: workspace.id };
  }

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

  const remixNotes = () =>
    prisma.notification.findMany({
      where: { userId: ownerId, albumId, type: "remix" },
      select: { id: true, type: true, albumId: true, actorUserId: true, createdAt: true, metadata: true },
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
        data: { title: "Salt Year", artist: "Mara Vale", songs: [] },
      },
      select: { id: true },
    });
    albumId = album.id;
    const fan = await artist("Theo Lind");
    fanId = fan.userId;
    fanWorkspaceId = fan.workspaceId;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: "@test.local", startsWith: "remixlink-" } } });
  });

  it("finds nothing to open while the remix is private", async () => {
    await remix();
    const notes = await remixNotes();
    expect(notes).toHaveLength(1);
    expect((await publishedRemixes(notes)).size).toBe(0);
  });

  it("links each notification to its own remix once that remix is on Discover", async () => {
    const first = await remix();
    const second = await remix();
    await prisma.album.updateMany({ where: { id: { in: [first, second] } }, data: { isPublic: true } });
    const [firstNote, secondNote] = await remixNotes();
    const found = await publishedRemixes([firstNote, secondNote]);
    expect(found.get(firstNote.id)).toBe(first);
    expect(found.get(secondNote.id)).toBe(second);
  });

  it("uses the remix ids notifications record, only for remixes on Discover", async () => {
    const shown = await remix();
    const hidden = await remix();
    await prisma.album.update({ where: { id: shown }, data: { isPublic: true } });
    const [firstNote, secondNote] = await remixNotes();
    const found = await publishedRemixes([
      { ...firstNote, actorUserId: null, metadata: { remixAlbumId: shown } },
      { ...secondNote, actorUserId: null, metadata: { remixAlbumId: hidden } },
      // Two rows about one remix both lead to it.
      { ...secondNote, id: "again", actorUserId: null, metadata: { remixAlbumId: shown } },
    ]);
    expect([...found.entries()].sort()).toEqual([
      ["again", shown],
      [firstNote.id, shown],
    ].sort());
  });

  it("uses the remix id a notification records", async () => {
    const id = await remix();
    await prisma.album.update({ where: { id }, data: { isPublic: true } });
    const [note] = await remixNotes();
    const found = await publishedRemixes([{ ...note, actorUserId: null, metadata: { remixAlbumId: id } }]);
    expect(found.get(note.id)).toBe(id);
  });
});
