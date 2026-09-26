import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { openNoteCounts, untrackedCommentWhere } from "@/server/comment-tasks";
import { getPrisma } from "@/server/db";

// One note, two views: the comment and task routes with the caller's workspace stubbed; the
// album, its comment, the task and the counts run against the Postgres in DATABASE_URL.
const caller = vi.hoisted(() => ({ userId: "", workspaceId: "" }));
vi.mock("@/server/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/api")>();
  return {
    ...actual,
    requireWorkspace: async () => ({ userId: caller.userId, workspaceId: caller.workspaceId, plan: "free" }),
  };
});

const hasDatabase = Boolean(process.env.DATABASE_URL);

function json(method: string, url: string, body: unknown) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe.skipIf(!hasDatabase)("a comment and the task made from it are one note (database)", () => {
  const prisma = hasDatabase ? getPrisma() : (null as never);
  let albumId = "";
  let commentId = "";

  beforeEach(async () => {
    const user = await prisma.user.create({ data: { email: `notes-${crypto.randomUUID()}@test.local` } });
    const workspace = await prisma.workspace.create({ data: { name: "Notes", ownerId: user.id } });
    caller.userId = user.id;
    caller.workspaceId = workspace.id;
    const album = await prisma.album.create({
      data: { workspaceId: workspace.id, title: "Salt Year", data: { title: "Salt Year", songs: [] } },
      select: { id: true },
    });
    albumId = album.id;
    const comment = await prisma.albumSectionComment.create({
      data: {
        albumId,
        sectionId: "s1",
        songTrackNumber: 1,
        sectionType: "verse",
        sectionOrder: 0,
        authorUserId: user.id,
        body: "Rewrite the bridge\nIt repeats the verse.",
      },
      select: { id: true },
    });
    commentId = comment.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: "@test.local", startsWith: "notes-" } } });
  });

  async function createTask() {
    const { POST } = await import("@/app/api/albums/[albumId]/tasks/route");
    const response = await POST(
      json("POST", `/api/albums/${albumId}/tasks`, { title: "Rewrite the bridge", sourceCommentId: commentId }),
      { params: Promise.resolve({ albumId }) },
    );
    expect(response.status).toBe(201);
    return ((await response.json()) as { task: { id: string } }).task.id;
  }

  async function setTask(taskId: string, status: string) {
    const { PATCH } = await import("@/app/api/albums/[albumId]/tasks/[taskId]/route");
    const response = await PATCH(json("PATCH", `/api/albums/${albumId}/tasks/${taskId}`, { status }), {
      params: Promise.resolve({ albumId, taskId }),
    });
    expect(response.status).toBe(200);
  }

  async function setComment(action: "resolve" | "unresolve") {
    const { PATCH } = await import("@/app/api/albums/[albumId]/comments/[commentId]/route");
    const response = await PATCH(json("PATCH", `/api/albums/${albumId}/comments/${commentId}`, { action }), {
      params: Promise.resolve({ albumId, commentId }),
    });
    expect(response.status).toBe(200);
    return (await response.json()) as { taskChanged: boolean };
  }

  const comment = () => prisma.albumSectionComment.findUniqueOrThrow({ where: { id: commentId } });
  const task = (id: string) => prisma.albumTask.findUniqueOrThrow({ where: { id } });

  it("counts a tasked comment once, as its task, and lists it only under the tasks", async () => {
    expect(await openNoteCounts(prisma, albumId)).toEqual({ comments: 1, tasks: 0 });
    await createTask();
    expect(await openNoteCounts(prisma, albumId)).toEqual({ comments: 0, tasks: 1 });
    expect(await prisma.albumSectionComment.count({ where: untrackedCommentWhere(albumId) })).toBe(0);
    // Still unresolved: it is open, tracked as the task.
    expect((await comment()).resolvedAt).toBeNull();
  });

  it("resolves the comment when its task is marked done, and reopens it with the task", async () => {
    const taskId = await createTask();
    await setTask(taskId, "done");
    const resolved = await comment();
    expect(resolved.resolvedAt).not.toBeNull();
    expect(resolved.resolvedByUserId).toBe(caller.userId);
    expect(await openNoteCounts(prisma, albumId)).toEqual({ comments: 0, tasks: 0 });

    // In progress is still open: the comment stays as it was until the task is done or reopened.
    await setTask(taskId, "in_progress");
    expect((await comment()).resolvedAt).toBeNull();
    await setTask(taskId, "open");
    expect((await comment()).resolvedAt).toBeNull();
    expect(await openNoteCounts(prisma, albumId)).toEqual({ comments: 0, tasks: 1 });
  });

  it("marks the task done when the comment is resolved, and reopens it with the comment", async () => {
    const taskId = await createTask();
    expect(await setComment("resolve")).toEqual(expect.objectContaining({ taskChanged: true }));
    expect((await task(taskId)).status).toBe("done");
    expect(await setComment("unresolve")).toEqual(expect.objectContaining({ taskChanged: true }));
    expect((await task(taskId)).status).toBe("open");
  });

  it("leaves a comment without a task alone, and says no task changed", async () => {
    expect(await setComment("resolve")).toEqual(expect.objectContaining({ taskChanged: false }));
    expect((await comment()).resolvedAt).not.toBeNull();
    expect(await openNoteCounts(prisma, albumId)).toEqual({ comments: 0, tasks: 0 });
  });

  it("reopens a resolved comment when a task is made from it", async () => {
    await setComment("resolve");
    await createTask();
    expect((await comment()).resolvedAt).toBeNull();
    expect(await openNoteCounts(prisma, albumId)).toEqual({ comments: 0, tasks: 1 });
  });

  it("lists the comment again when its open task is deleted", async () => {
    const taskId = await createTask();
    const { DELETE } = await import("@/app/api/albums/[albumId]/tasks/[taskId]/route");
    const response = await DELETE(new Request(`http://localhost/api/albums/${albumId}/tasks/${taskId}`), {
      params: Promise.resolve({ albumId, taskId }),
    });
    expect(response.status).toBe(200);
    expect(await openNoteCounts(prisma, albumId)).toEqual({ comments: 1, tasks: 0 });
  });

  it("tells the Studio's thread how each comment stands with its task", async () => {
    const { GET } = await import("@/app/api/albums/[albumId]/comments/route");
    const read = async () => {
      const response = await GET(new Request(`http://localhost/api/albums/${albumId}/comments?sectionId=s1`), {
        params: Promise.resolve({ albumId }),
      });
      const body = (await response.json()) as { comments: Array<{ id: string; task: string | null }> };
      return body.comments.find((row) => row.id === commentId)?.task;
    };
    expect(await read()).toBeNull();
    const taskId = await createTask();
    expect(await read()).toBe("open");
    await setTask(taskId, "done");
    expect(await read()).toBe("done");
  });
});
