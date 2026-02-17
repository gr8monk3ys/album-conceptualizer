import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { sendPushNotificationsToUser } from "@/server/push-notifications";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const runtime = "nodejs";

const PostBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(2000).optional(),
  status: z.enum(["open", "in_progress", "done"]).optional(),
  priority: z.number().int().min(0).max(3).optional(),
  dueAt: z.string().datetime().optional(),
  assignedToUserId: z.string().trim().min(1).optional(),
  sourceCommentId: z.string().trim().min(1).optional(),
  sectionId: z.string().trim().min(1).max(120).optional(),
  songTrackNumber: z.number().int().min(1).max(99).optional(),
  sectionType: z.string().trim().min(1).max(64).optional(),
  sectionOrder: z.number().int().min(0).max(99).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const url = new URL(request.url);
  const status = (url.searchParams.get("status") ?? "").trim().toLowerCase();
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 50);

  const { albumId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const album = await prisma.album.findFirst({
    where: { id: albumId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!album) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const tasks = await prisma.albumTask.findMany({
    where: {
      albumId: album.id,
      deletedAt: null,
      ...(status ? { status } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
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
      sourceComment: { select: { id: true } },
    },
  });

  const hasMore = tasks.length > limit;
  if (hasMore) tasks.pop();
  const nextCursor = hasMore ? tasks[tasks.length - 1]?.id : undefined;

  return NextResponse.json({ tasks, nextCursor, hasMore });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const payload = PostBodySchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { albumId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const album = await prisma.album.findFirst({
    where: { id: albumId, workspaceId: workspace.id },
    select: { id: true, title: true },
  });
  if (!album) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const assignedToUserId = payload.data.assignedToUserId?.trim() || null;
  if (assignedToUserId) {
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: workspace.id, userId: assignedToUserId },
      select: { id: true },
    });
    if (!member) return NextResponse.json({ error: "Invalid assignee." }, { status: 400 });
  }

  const created = await prisma.albumTask.create({
    data: {
      albumId: album.id,
      title: payload.data.title,
      body: payload.data.body || null,
      status: payload.data.status ?? "open",
      priority: payload.data.priority ?? 2,
      dueAt: payload.data.dueAt ? new Date(payload.data.dueAt) : null,
      createdByUserId: userId,
      assignedToUserId,
      sourceCommentId: payload.data.sourceCommentId || null,
      sectionId: payload.data.sectionId || null,
      songTrackNumber: payload.data.songTrackNumber ?? null,
      sectionType: payload.data.sectionType || null,
      sectionOrder: payload.data.sectionOrder ?? null,
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

  const baseUrl = `/app/albums/${album.id}`;
  const url =
    created.sectionId && created.songTrackNumber
      ? `${baseUrl}/studio?song=${created.songTrackNumber}&sid=${encodeURIComponent(created.sectionId)}`
      : `${baseUrl}/inbox`;

  const notifications: Array<{
    workspaceId: string;
    userId: string;
    actorUserId: string;
    type: string;
    title: string;
    body?: string;
    url: string;
    albumId: string;
    taskId: string;
  }> = [];

  const taskBody = (created.body ?? "").trim();
  const excerpt = taskBody ? taskBody.slice(0, 240) : undefined;

  if (assignedToUserId && assignedToUserId !== userId) {
    notifications.push({
      workspaceId: workspace.id,
      userId: assignedToUserId,
      actorUserId: userId,
      type: "task",
      title: `New task assigned · ${album.title}`,
      body: excerpt,
      url,
      albumId: album.id,
      taskId: created.id,
    });
  }

  if (
    workspace.ownerId !== userId &&
    (!assignedToUserId || assignedToUserId !== workspace.ownerId)
  ) {
    notifications.push({
      workspaceId: workspace.id,
      userId: workspace.ownerId,
      actorUserId: userId,
      type: "task",
      title: `New task · ${album.title}`,
      body: excerpt,
      url,
      albumId: album.id,
      taskId: created.id,
    });
  }

  if (notifications.length) {
    await prisma.notification.createMany({ data: notifications });

    // Send push notifications (fire-and-forget)
    for (const n of notifications) {
      sendPushNotificationsToUser(n.userId, n.title, n.body ?? "", {
        url: n.url,
        albumId: n.albumId,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ task: created }, { status: 201 });
}

