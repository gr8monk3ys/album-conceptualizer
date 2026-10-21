import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, apiHandler, parseJsonBody, requireWorkspace } from "@/server/api";
import { lockComment, syncTaskWithComment } from "@/server/comment-tasks";
import { getPrisma } from "@/server/db";

export const runtime = "nodejs";

type Context = { params: Promise<{ albumId: string; commentId: string }> };

const PatchBodySchema = z.object({
  action: z.enum(["resolve", "unresolve", "edit"]),
  body: z.string().trim().min(1).max(2000).optional(),
});

async function requireComment(workspaceId: string, albumId: string, commentId: string) {
  const comment = await getPrisma().albumSectionComment.findFirst({
    where: {
      id: commentId,
      album: { id: albumId, workspaceId },
    },
    select: {
      id: true,
      authorUserId: true,
      deletedAt: true,
      album: { select: { workspace: { select: { ownerId: true } } } },
    },
  });
  if (!comment) throw new ApiError(404, "Not found.");
  return comment;
}

export const PATCH = apiHandler(async (request: Request, { params }: Context) => {
  const { userId, workspaceId } = await requireWorkspace();
  const payload = await parseJsonBody(request, PatchBodySchema, "Invalid payload.");
  const { albumId, commentId } = await params;
  const comment = await requireComment(workspaceId, albumId, commentId);
  if (comment.deletedAt) throw new ApiError(410, "Comment deleted.");

  let data;
  if (payload.action === "resolve") {
    data = { resolvedAt: new Date(), resolvedByUserId: userId };
  } else if (payload.action === "unresolve") {
    data = { resolvedAt: null, resolvedByUserId: null };
  } else {
    if (comment.authorUserId !== userId) throw new ApiError(403, "Forbidden.");
    if (!payload.body) throw new ApiError(400, "Write a comment first.");
    data = { body: payload.body };
  }

  // One note, two views (server/comment-tasks.ts): resolving a comment that became a task marks
  // the task done, and reopening it reopens the task, in the same transaction.
  const { updated, taskChanged } = await getPrisma().$transaction(async (tx) => {
    // The comment's row first, then the task's (the order every write to a note takes).
    await lockComment(tx, albumId, comment.id);
    const saved = await tx.albumSectionComment.update({
      where: { id: comment.id },
      data,
      select: {
        id: true,
        sectionId: true,
        songTrackNumber: true,
        sectionType: true,
        sectionOrder: true,
        body: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        resolvedAt: true,
        author: { select: { id: true, name: true, image: true } },
        resolvedBy: { select: { id: true, name: true, image: true } },
      },
    });
    const changed =
      payload.action === "edit" ? 0 : await syncTaskWithComment(tx, albumId, comment.id, payload.action === "resolve");
    return { updated: saved, taskChanged: changed > 0 };
  });

  return NextResponse.json({ comment: updated, taskChanged });
});

export const DELETE = apiHandler(async (_request: Request, { params }: Context) => {
  const { userId, workspaceId } = await requireWorkspace();
  const { albumId, commentId } = await params;
  const comment = await requireComment(workspaceId, albumId, commentId);
  if (comment.deletedAt) return NextResponse.json({ ok: true });

  // Allow the author (or workspace owner) to delete.
  if (comment.authorUserId !== userId && comment.album.workspace.ownerId !== userId) {
    throw new ApiError(403, "Forbidden.");
  }

  await getPrisma().albumSectionComment.update({
    where: { id: comment.id },
    data: { deletedAt: new Date(), body: "" },
    select: { id: true },
  });

  return NextResponse.json({ ok: true });
});
