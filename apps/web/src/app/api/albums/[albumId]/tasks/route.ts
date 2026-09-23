import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ApiError,
  apiHandler,
  parseJsonBody,
  parseWith,
  requireAlbum,
  requireWorkspace,
} from "@/server/api";
import { getPrisma } from "@/server/db";
import { albumItemUrl, notifyWorkspaceMembers } from "@/server/notify";

export const runtime = "nodejs";

type Context = { params: Promise<{ albumId: string }> };

const TaskStatusSchema = z.enum(["open", "in_progress", "done"]);

const PostBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(2000).optional(),
  status: TaskStatusSchema.optional(),
  priority: z.number().int().min(0).max(3).optional(),
  dueAt: z.string().datetime().optional(),
  assignedToUserId: z.string().trim().min(1).optional(),
  sourceCommentId: z.string().trim().min(1).optional(),
  sectionId: z.string().trim().min(1).max(120).optional(),
  songTrackNumber: z.number().int().min(1).max(99).optional(),
  sectionType: z.string().trim().min(1).max(64).optional(),
  sectionOrder: z.number().int().min(0).max(99).optional(),
});

const TASK_SELECT = {
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
} as const;

export const GET = apiHandler(async (request: Request, { params }: Context) => {
  const { workspaceId } = await requireWorkspace();
  const url = new URL(request.url);
  const status = parseWith(
    TaskStatusSchema.optional(),
    url.searchParams.get("status")?.trim().toLowerCase() || undefined,
    "Invalid status filter.",
  );

  const { albumId } = await params;
  const album = await requireAlbum(workspaceId, albumId, { id: true });

  const tasks = await getPrisma().albumTask.findMany({
    where: {
      albumId: album.id,
      deletedAt: null,
      ...(status ? { status } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    select: { ...TASK_SELECT, sourceComment: { select: { id: true } } },
  });

  return NextResponse.json({ tasks });
});

export const POST = apiHandler(async (request: Request, { params }: Context) => {
  const { userId, workspaceId } = await requireWorkspace();
  const payload = await parseJsonBody(request, PostBodySchema, "Invalid payload.");
  const { albumId } = await params;
  const album = await requireAlbum(workspaceId, albumId, { id: true, title: true });
  const prisma = getPrisma();

  const assignedToUserId = payload.assignedToUserId?.trim() || null;
  if (assignedToUserId) {
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: assignedToUserId },
      select: { id: true },
    });
    if (!member) throw new ApiError(400, "Invalid assignee.");
  }

  const sourceCommentId = payload.sourceCommentId || null;
  if (sourceCommentId) {
    const comment = await prisma.albumSectionComment.findFirst({
      where: { id: sourceCommentId, albumId: album.id },
      select: { id: true },
    });
    if (!comment) throw new ApiError(400, "That comment isn't on this album.");
  }

  const created = await prisma.albumTask.create({
    data: {
      albumId: album.id,
      title: payload.title,
      body: payload.body || null,
      status: payload.status ?? "open",
      priority: payload.priority ?? 2,
      dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
      createdByUserId: userId,
      assignedToUserId,
      sourceCommentId,
      sectionId: payload.sectionId || null,
      songTrackNumber: payload.songTrackNumber ?? null,
      sectionType: payload.sectionType || null,
      sectionOrder: payload.sectionOrder ?? null,
    },
    select: TASK_SELECT,
  });

  // The assignee hears about it first; the workspace owner otherwise.
  await notifyWorkspaceMembers(prisma, {
    workspaceId,
    albumId: album.id,
    actorUserId: userId,
    url: albumItemUrl(album.id, created),
    body: created.body,
    taskId: created.id,
    audiences: [
      { to: [assignedToUserId], type: "task", title: `New task assigned · ${album.title}` },
      { to: "owner", type: "task", title: `New task · ${album.title}` },
    ],
  });

  return NextResponse.json({ task: created }, { status: 201 });
});
