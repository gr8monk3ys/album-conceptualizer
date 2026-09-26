import { describe, expect, it, vi } from "vitest";

// The tasks route with the workspace, album, database and notifications stubbed: one comment
// ("c1") on the album, and whatever tasks this test has created so far.
const tasks = vi.hoisted(() => [] as Array<{ sourceCommentId: string | null }>);
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
      findFirst: async ({ where }: { where: { id: string } }) => (where.id === "c1" ? { id: "c1" } : null),
    },
    albumTask: {
      findFirst: async ({ where }: { where: { sourceCommentId: string } }) =>
        tasks.find((task) => task.sourceCommentId === where.sourceCommentId) ?? null,
      create: async ({ data }: { data: { sourceCommentId: string | null } }) => {
        tasks.push(data);
        return { id: `t${tasks.length}`, ...data };
      },
    },
  }),
}));
vi.mock("@/server/notify", () => ({
  albumItemUrl: () => "/app/albums/album-1",
  notifyWorkspaceMembers: async () => undefined,
}));

function post() {
  return new Request("http://localhost/api/albums/album-1/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Rewrite the bridge", sourceCommentId: "c1" }),
  });
}

describe("tasks from a comment", () => {
  it("makes one task per comment and refuses a second", async () => {
    const { POST } = await import("@/app/api/albums/[albumId]/tasks/route");
    const context = { params: Promise.resolve({ albumId: "album-1" }) };
    expect((await POST(post(), context)).status).toBeLessThan(300);
    const again = await POST(post(), context);
    expect(again.status).toBe(409);
    expect(tasks).toHaveLength(1);
  });
});
