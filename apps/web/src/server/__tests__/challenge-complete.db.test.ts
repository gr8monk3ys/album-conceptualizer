import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getDailyChallenge } from "@/server/challenges";
import { getCredits } from "@/server/credits";
import { getPrisma } from "@/server/db";
import { recordLyricsBaselines } from "@/server/challenge-verification";

// The challenge complete route with the caller's workspace stubbed; the album, its versions,
// the completion and the credit ledger run against the Postgres in DATABASE_URL.
const caller = vi.hoisted(() => ({ userId: "", workspaceId: "" }));
vi.mock("@/server/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/api")>();
  return {
    ...actual,
    requireWorkspace: async () => ({ userId: caller.userId, workspaceId: caller.workspaceId, plan: "free" }),
  };
});

const hasDatabase = Boolean(process.env.DATABASE_URL);

function albumData(lyrics: string) {
  return {
    title: "Lighthouse Static",
    central_themes: ["memory"],
    songs: [{ title: "Foghorn", track_number: 1, sections: [{ section_type: "verse", order: 0, lyrics }] }],
  };
}

describe.skipIf(!hasDatabase)("challenge completion pays for written lyrics (database)", () => {
  const prisma = hasDatabase ? getPrisma() : (null as never);
  const { challenge } = getDailyChallenge();

  beforeEach(async () => {
    const user = await prisma.user.create({ data: { email: `challenge-${crypto.randomUUID()}@test.local` } });
    const workspace = await prisma.workspace.create({ data: { name: "Challenges", ownerId: user.id } });
    caller.userId = user.id;
    caller.workspaceId = workspace.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: "@test.local", startsWith: "challenge-" } } });
  });

  async function complete(body: Record<string, unknown>) {
    const { POST } = await import("@/app/api/challenges/complete/route");
    const response = await POST(
      new Request("http://localhost/api/challenges/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeKey: challenge.key, notes: "Drafted the opening verse today.", ...body }),
      }),
      undefined as never,
    );
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  const balance = async () => (await getCredits({ workspaceId: caller.workspaceId, plan: "free" })).remaining;

  it("requires an album", async () => {
    const result = await complete({});
    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/Choose the album you wrote in/);
  });

  it("saves the note with 0 credits until the track shows lyrics, then pays once", async () => {
    const album = await prisma.album.create({
      data: { workspaceId: caller.workspaceId, title: "Lighthouse Static", data: albumData("[Verse]") },
      select: { id: true },
    });
    const before = await balance();

    const unwritten = await complete({ albumId: album.id, trackNumber: 1 });
    expect(unwritten.status).toBe(200);
    expect(unwritten.body).toMatchObject({ credited: false, creditsEarned: 0 });
    expect(unwritten.body.reason).toMatch(/track 01 of Lighthouse Static has no written lyrics/);
    expect(await balance()).toBe(before);
    const saved = await prisma.challengeCompletion.findFirst({ where: { workspaceId: caller.workspaceId } });
    expect(saved).toMatchObject({ creditsEarned: 0, albumId: album.id, trackNumber: 1 });

    await prisma.album.update({ where: { id: album.id }, data: { data: albumData("Salt on the glass") } });
    const written = await complete({ albumId: album.id, trackNumber: 1 });
    expect(written.body).toMatchObject({ credited: true, creditsEarned: challenge.credits });
    expect(await balance()).toBe(before + challenge.credits);

    const again = await complete({ albumId: album.id, trackNumber: 1 });
    expect(again.status).toBe(409);
    expect(await balance()).toBe(before + challenge.credits);
  });

  it("doesn't pay for lyrics unchanged since the last version before today", async () => {
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const album = await prisma.album.create({
      data: {
        workspaceId: caller.workspaceId,
        title: "Lighthouse Static",
        data: albumData("Salt on the glass"),
        createdAt: lastWeek,
      },
      select: { id: true },
    });
    await prisma.albumVersion.create({
      data: { albumId: album.id, createdByUserId: caller.userId, data: albumData("Salt on the glass"), createdAt: lastWeek },
    });
    // Saved today, but with last week's words.
    await prisma.album.update({ where: { id: album.id }, data: { title: "Lighthouse Static" } });

    const result = await complete({ albumId: album.id });
    expect(result.body).toMatchObject({ credited: false, creditsEarned: 0 });
    expect(result.body.reason).toMatch(/the same as before today/);
  });

  /** An album made last week and not saved since, with no versions (like most albums). */
  async function oldAlbum(lyrics: string) {
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return prisma.album.create({
      data: {
        workspaceId: caller.workspaceId,
        title: "Lighthouse Static",
        data: albumData(lyrics),
        createdAt: lastWeek,
        updatedAt: lastWeek,
      },
      select: { id: true },
    });
  }

  it("doesn't pay an old album with no versions for a save today with unchanged lyrics", async () => {
    const album = await oldAlbum("Salt on the glass");
    const before = await balance();
    // Saved today, but with last week's words, and no version to compare with.
    await prisma.album.update({ where: { id: album.id }, data: { title: "Lighthouse Static" } });

    const first = await complete({ albumId: album.id });
    expect(first.body).toMatchObject({ credited: false, creditsEarned: 0 });
    expect(first.body.reason).toMatch(/Write something new in the Studio/);
    // Sending it again without writing anything still pays nothing.
    await prisma.album.update({ where: { id: album.id }, data: { title: "Lighthouse Static" } });
    const again = await complete({ albumId: album.id });
    expect(again.body).toMatchObject({ credited: false, creditsEarned: 0 });
    expect(again.body.reason).toMatch(/the same as before today/);
    expect(await balance()).toBe(before);
  });

  it("pays an old album for lyrics written after the challenge was opened", async () => {
    const album = await oldAlbum("Salt on the glass");
    const before = await balance();
    // Opening Challenges records each album's lyrics as they stood before today's writing.
    await recordLyricsBaselines(prisma, caller.workspaceId, new Date());
    await prisma.album.update({
      where: { id: album.id },
      data: { data: albumData("Salt on the glass, the keeper counts the ships") },
    });

    const result = await complete({ albumId: album.id });
    expect(result.body).toMatchObject({ credited: true, creditsEarned: challenge.credits });
    expect(await balance()).toBe(before + challenge.credits);
  });

  it("pays an old album written in before the challenge, once more is written after the entry", async () => {
    const album = await oldAlbum("Salt on the glass");
    // Written today before the challenge was opened: what is new can't be told apart.
    await prisma.album.update({ where: { id: album.id }, data: { data: albumData("Low tide") } });
    const first = await complete({ albumId: album.id });
    expect(first.body).toMatchObject({ credited: false, creditsEarned: 0 });

    await prisma.album.update({ where: { id: album.id }, data: { data: albumData("Low tide, high water") } });
    const second = await complete({ albumId: album.id });
    expect(second.body).toMatchObject({ credited: true, creditsEarned: challenge.credits });
  });

  async function open(body: Record<string, unknown>) {
    const { POST } = await import("@/app/api/challenges/open/route");
    const response = await POST(
      new Request("http://localhost/api/challenges/open", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeKey: challenge.key, ...body }),
      }),
      undefined as never,
    );
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  it("pays a claim from the Studio for lyrics written after the band opened the challenge", async () => {
    const album = await oldAlbum("Salt on the glass");
    // Written in today before the challenge was opened: without a baseline it couldn't be told apart.
    await prisma.album.update({ where: { id: album.id }, data: { data: albumData("Low tide") } });
    const before = await balance();

    const opened = await open({ albumId: album.id });
    expect(opened.body).toMatchObject({ active: true, done: false });
    // The words already there when the band opened don't pay…
    const early = await complete({ albumId: album.id, trackNumber: 1, notes: undefined, from: "studio" });
    expect(early.body).toMatchObject({ credited: false, creditsEarned: 0 });
    expect(early.body.reason).toBe(
      "No credits yet: the lyrics on track 01 of Lighthouse Static are the same as before today. Write something new, then claim again.",
    );
    // …what is written after it does.
    await prisma.album.update({ where: { id: album.id }, data: { data: albumData("Low tide, high water") } });
    const paid = await complete({ albumId: album.id, trackNumber: 1, notes: undefined, from: "studio" });
    expect(paid.body).toMatchObject({ credited: true, creditsEarned: challenge.credits });
    expect(await balance()).toBe(before + challenge.credits);
    expect((await open({ albumId: album.id })).body).toMatchObject({ active: true, done: true });
  });

  it("keeps the day's first baseline when the band opens again", async () => {
    const album = await oldAlbum("Salt on the glass");
    await recordLyricsBaselines(prisma, caller.workspaceId, new Date());
    await prisma.album.update({ where: { id: album.id }, data: { data: albumData("Salt on the glass, again") } });
    await open({ albumId: album.id });
    const paid = await complete({ albumId: album.id, notes: undefined, from: "studio" });
    expect(paid.body).toMatchObject({ credited: true });
  });

  it("keeps a note saved earlier when a claim comes without one", async () => {
    const album = await prisma.album.create({
      data: { workspaceId: caller.workspaceId, title: "Lighthouse Static", data: albumData("[Verse]") },
      select: { id: true },
    });
    await complete({ albumId: album.id, trackNumber: 1 });
    await prisma.album.update({ where: { id: album.id }, data: { data: albumData("Salt on the glass") } });
    const paid = await complete({ albumId: album.id, trackNumber: 1, notes: undefined, from: "page" });
    expect(paid.body).toMatchObject({ credited: true });
    const saved = await prisma.challengeCompletion.findFirst({ where: { workspaceId: caller.workspaceId } });
    expect(saved?.notes).toBe("Drafted the opening verse today.");
  });

  it("says when the band's challenge is another day's, and 404s another workspace's album", async () => {
    expect((await open({ challengeKey: "not-today", albumId: "x" })).body).toMatchObject({ active: false });
    expect((await open({ albumId: "not-my-album" })).status).toBe(404);
  });

  it("refuses a track that isn't on the album", async () => {
    const album = await prisma.album.create({
      data: { workspaceId: caller.workspaceId, title: "Lighthouse Static", data: albumData("Salt on the glass") },
      select: { id: true },
    });
    const result = await complete({ albumId: album.id, trackNumber: 9 });
    expect(result.status).toBe(400);
  });
});
