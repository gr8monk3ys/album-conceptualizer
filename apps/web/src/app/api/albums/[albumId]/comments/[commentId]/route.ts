import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const runtime = "nodejs";

const PatchBodySchema = z.object({
  action: z.enum(["resolve", "unresolve", "edit"]),
  body: z.string().trim().min(1).max(2000).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ albumId: string; commentId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const payload = PatchBodySchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { albumId, commentId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const comment = await prisma.albumSectionComment.findFirst({
    where: {
      id: commentId,
      album: { id: albumId, workspaceId: workspace.id },
    },
    select: {
      id: true,
      authorUserId: true,
      deletedAt: true,
    },
  });
  if (!comment) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (comment.deletedAt) return NextResponse.json({ error: "Comment deleted." }, { status: 410 });

  if (payload.data.action === "edit") {
    if (comment.authorUserId !== userId) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    if (!payload.data.body) {
      return NextResponse.json({ error: "Body is required." }, { status: 400 });
    }
  }

  const now = new Date();
  const updated = await prisma.albumSectionComment.update({
    where: { id: comment.id },
    data:
      payload.data.action === "resolve"
        ? { resolvedAt: now, resolvedByUserId: userId }
        : payload.data.action === "unresolve"
          ? { resolvedAt: null, resolvedByUserId: null }
          : { body: payload.data.body! },
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

  return NextResponse.json({ comment: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ albumId: string; commentId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { albumId, commentId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const comment = await prisma.albumSectionComment.findFirst({
    where: {
      id: commentId,
      album: { id: albumId, workspaceId: workspace.id },
    },
    select: {
      id: true,
      authorUserId: true,
      deletedAt: true,
    },
  });
  if (!comment) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (comment.deletedAt) return NextResponse.json({ ok: true });

  // Allow the author (or workspace owner) to delete.
  if (comment.authorUserId !== userId && workspace.ownerId !== userId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  await prisma.albumSectionComment.update({
    where: { id: comment.id },
    data: { deletedAt: new Date(), body: "" },
    select: { id: true },
  });

  return NextResponse.json({ ok: true });
}

