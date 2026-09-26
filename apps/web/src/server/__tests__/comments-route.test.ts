import { describe, expect, it, vi } from "vitest";

// The section comments route with the workspace, album, database and notifications stubbed.
const created = vi.hoisted(() => [] as unknown[]);
vi.mock("@/server/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/api")>();
  return {
    ...actual,
    requireWorkspace: async () => ({ userId: "user-1", workspaceId: "ws-1", plan: "free" }),
    requireAlbum: async () => ({ id: "album-1", title: "Salt Year" }),
  };
});
vi.mock("@/server/db", () => ({
  getPrisma: () => ({
    albumSectionComment: {
      create: async ({ data }: { data: unknown }) => {
        created.push(data);
        return { id: "c1", ...(data as object) };
      },
    },
  }),
}));
vi.mock("@/server/notify", () => ({
  albumItemUrl: () => "/app/albums/album-1",
  findMentionedMembers: async () => [],
  notifyWorkspaceMembers: async () => undefined,
}));

function post(songTrackNumber: number) {
  return new Request("http://localhost/api/albums/album-1/comments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sectionId: "s1", songTrackNumber, sectionType: "verse", sectionOrder: 0, body: "Lovely." }),
  });
}

describe("section comments", () => {
  it("can be left on every track an album can have (up to 100)", async () => {
    const { POST } = await import("@/app/api/albums/[albumId]/comments/route");
    const context = { params: Promise.resolve({ albumId: "album-1" }) };
    expect((await POST(post(100), context)).status).toBeLessThan(300);
    expect(created).toHaveLength(1);
    expect((await POST(post(101), context)).status).toBe(400);
  });
});
