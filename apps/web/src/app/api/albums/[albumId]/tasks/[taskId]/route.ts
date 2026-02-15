import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const runtime = "nodejs";

const PatchBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    body: z.string().trim().max(2000).nullable().optional(),
    status: z.enum(["open", "in_progress", "done"]).optional(),
    priority: z.number().int().min(0).max(3).optional(),
    dueAt: z.string().datetime().nullable().optional(),
    assignedToUserId: z.string().trim().min(1).nullable().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, "No changes provided.");

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ albumId: string; taskId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const payload = PatchBodySchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { albumId, taskId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const existing = await prisma.albumTask.findFirst({
    where: {
      id: taskId,
      deletedAt: null,
      album: { id: albumId, workspaceId: workspace.id },
    },
    select: {
      id: true,
      albumId: true,
      title: true,
      body: true,
      status: true,
      assignedToUserId: true,
      sectionId: true,
      songTrackNumber: true,
      album: { select: { title: true } },
    },
  });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const assignedToUserId =
    payload.data.assignedToUserId === undefined
      ? undefined
      : payload.data.assignedToUserId?.trim() || null;

  if (assignedToUserId) {
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: workspace.id, userId: assignedToUserId },
      select: { id: true },
    });
    if (!member) return NextResponse.json({ error: "Invalid assignee." }, { status: 400 });
  }

  const updated = await prisma.albumTask.update({
    where: { id: existing.id },
    data: {
      title: payload.data.title,
      body: payload.data.body === undefined ? undefined : payload.data.body,
      status: payload.data.status,
      priority: payload.data.priority,
      dueAt: payload.data.dueAt === undefined ? undefined : payload.data.dueAt ? new Date(payload.data.dueAt) : null,
      assignedToUserId,
    },
    select: {
      id: true,
      title: true,
      body: true,
      status: true,
      priority: true,
      dueAt: true,
      sectionId: true,
      songTrackNumber: true,
      sectionType: true,
      sectionOrder: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { id: true, name: true, email: true, image: true } },
      assignedTo: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  // Notify newly assigned user.
  if (assignedToUserId && assignedToUserId !== existing.assignedToUserId && assignedToUserId !== userId) {
    const baseUrl = `/app/albums/${existing.albumId}`;
    const url =
      existing.sectionId && existing.songTrackNumber
        ? `${baseUrl}/studio?song=${existing.songTrackNumber}&sid=${encodeURIComponent(existing.sectionId)}`
        : `${baseUrl}/inbox`;

    const excerpt = (updated.body ?? "").trim().slice(0, 240) || undefined;
    await prisma.notification.create({
      data: {
        workspaceId: workspace.id,
        userId: assignedToUserId,
        actorUserId: userId,
        type: "task",
        title: `Task assigned · ${existing.album.title}`,
        body: excerpt,
        url,
        albumId: existing.albumId,
        taskId: existing.id,
      },
      select: { id: true },
    });
  }

  return NextResponse.json({ task: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ albumId: string; taskId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { albumId, taskId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const existing = await prisma.albumTask.findFirst({
    where: {
      id: taskId,
      deletedAt: null,
      album: { id: albumId, workspaceId: workspace.id },
    },
    select: { id: true, createdByUserId: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (existing.createdByUserId !== userId && workspace.ownerId !== userId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  await prisma.albumTask.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), status: "done" },
    select: { id: true },
  });

  return NextResponse.json({ ok: true });
}

