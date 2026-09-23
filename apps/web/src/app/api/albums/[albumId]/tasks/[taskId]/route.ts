import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, apiHandler, parseJsonBody, requireWorkspace } from "@/server/api";
import { getPrisma } from "@/server/db";
import { albumItemUrl, notifyWorkspaceMembers } from "@/server/notify";

export const runtime = "nodejs";

type Context = { params: Promise<{ albumId: string; taskId: string }> };

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

export const PATCH = apiHandler(async (request: Request, { params }: Context) => {
  const { userId, workspaceId } = await requireWorkspace();
  const payload = await parseJsonBody(request, PatchBodySchema, "Invalid payload.");
  const { albumId, taskId } = await params;
  const prisma = getPrisma();

  const existing = await prisma.albumTask.findFirst({
    where: {
      id: taskId,
      deletedAt: null,
      album: { id: albumId, workspaceId },
    },
    select: {
      id: true,
      albumId: true,
      assignedToUserId: true,
      sectionId: true,
      songTrackNumber: true,
      album: { select: { title: true } },
    },
  });
  if (!existing) throw new ApiError(404, "Not found.");

  const assignedToUserId =
    payload.assignedToUserId === undefined ? undefined : payload.assignedToUserId?.trim() || null;

  if (assignedToUserId) {
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: assignedToUserId },
      select: { id: true },
    });
    if (!member) throw new ApiError(400, "Invalid assignee.");
  }

  const updated = await prisma.albumTask.update({
    where: { id: existing.id },
    data: {
      title: payload.title,
      body: payload.body,
      status: payload.status,
      priority: payload.priority,
      dueAt: payload.dueAt === undefined ? undefined : payload.dueAt ? new Date(payload.dueAt) : null,
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

  if (assignedToUserId && assignedToUserId !== existing.assignedToUserId) {
    await notifyWorkspaceMembers(prisma, {
      workspaceId,
      albumId: existing.albumId,
      actorUserId: userId,
      url: albumItemUrl(existing.albumId, existing),
      body: updated.body,
      taskId: existing.id,
      audiences: [
        { to: [assignedToUserId], type: "task", title: `Task assigned · ${existing.album.title}` },
      ],
    });
  }

  return NextResponse.json({ task: updated });
});

export const DELETE = apiHandler(async (_request: Request, { params }: Context) => {
  const { userId, workspaceId } = await requireWorkspace();
  const { albumId, taskId } = await params;
  const prisma = getPrisma();

  const existing = await prisma.albumTask.findFirst({
    where: {
      id: taskId,
      deletedAt: null,
      album: { id: albumId, workspaceId },
    },
    select: {
      id: true,
      createdByUserId: true,
      album: { select: { workspace: { select: { ownerId: true } } } },
    },
  });
  if (!existing) throw new ApiError(404, "Not found.");

  if (existing.createdByUserId !== userId && existing.album.workspace.ownerId !== userId) {
    throw new ApiError(403, "Forbidden.");
  }

  await prisma.albumTask.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), status: "done" },
    select: { id: true },
  });

  return NextResponse.json({ ok: true });
});
