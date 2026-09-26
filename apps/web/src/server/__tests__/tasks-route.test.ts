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
vi.mock("@/server/db", () => {
  // Postgres's row lock, as far as this route goes: a transaction that locks the comment waits
  // for the one holding it to finish.
  let commentLock: Promise<void> = Promise.resolve();
  const albumTask = {
    findFirst: async ({ where }: { where: { sourceCommentId: string } }) => {
      // A read that yields, as a real query does, so two unlocked requests would interleave.
      await new Promise((resolve) => setTimeout(resolve, 0));
      return tasks.find((task) => task.sourceCommentId === where.sourceCommentId) ?? null;
    },
    create: async ({ data }: { data: { sourceCommentId: string | null } }) => {
      tasks.push(data);
      return { id: `t${tasks.length}`, ...data };
    },
  };
  return {
    getPrisma: () => ({
      albumTask,
      $transaction: async <T,>(work: (tx: unknown) => Promise<T>) => {
        let release = () => {};
        const held = commentLock;
        const tx = {
          albumTask,
          // A resolved source comment reopens with its new task (server/comment-tasks.ts).
          albumSectionComment: { updateMany: async () => ({ count: 0 }) },
          $queryRaw: async (_sql: TemplateStringsArray, commentId: string) => {
            commentLock = held.then(() => new Promise<void>((resolve) => (release = resolve)));
            await held;
            return commentId === "c1" ? [{ id: "c1" }] : [];
          },
        };
        try {
          return await work(tx);
        } finally {
          release();
        }
      },
    }),
  };
});
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

  it("makes one task when two presses arrive together", async () => {
    tasks.length = 0;
    const { POST } = await import("@/app/api/albums/[albumId]/tasks/route");
    const context = { params: Promise.resolve({ albumId: "album-1" }) };
    const statuses = (await Promise.all([POST(post(), context), POST(post(), context)])).map((r) => r.status);
    expect(statuses.sort()).toEqual([201, 409]);
    expect(tasks).toHaveLength(1);
  });

  it("refuses a comment from another album", async () => {
    const { POST } = await import("@/app/api/albums/[albumId]/tasks/route");
    const context = { params: Promise.resolve({ albumId: "album-1" }) };
    const request = new Request("http://localhost/api/albums/album-1/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Rewrite the bridge", sourceCommentId: "elsewhere" }),
    });
    expect((await POST(request, context)).status).toBe(400);
  });
});
