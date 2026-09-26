import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getDailyChallenge } from "@/server/challenges";
import { getCredits } from "@/server/credits";
import { getPrisma } from "@/server/db";

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

  it("refuses a track that isn't on the album", async () => {
    const album = await prisma.album.create({
      data: { workspaceId: caller.workspaceId, title: "Lighthouse Static", data: albumData("Salt on the glass") },
      select: { id: true },
    });
    const result = await complete({ albumId: album.id, trackNumber: 9 });
    expect(result.status).toBe(400);
  });
});
