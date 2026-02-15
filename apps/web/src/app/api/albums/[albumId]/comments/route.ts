import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const runtime = "nodejs";

const PostBodySchema = z.object({
  sectionId: z.string().trim().min(1).max(120),
  songTrackNumber: z.number().int().min(1).max(99),
  sectionType: z.string().trim().min(1).max(64),
  sectionOrder: z.number().int().min(0).max(99),
  body: z.string().trim().min(1).max(2000),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const url = new URL(request.url);
  const sectionId = (url.searchParams.get("sectionId") ?? "").trim();

  const { albumId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const album = await prisma.album.findFirst({
    where: { id: albumId, workspaceId: workspace.id },
    select: { id: true, title: true },
  });
  if (!album) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const comments = await prisma.albumSectionComment.findMany({
    where: {
      albumId: album.id,
      ...(sectionId ? { sectionId } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 100,
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

  return NextResponse.json({ comments });
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
    select: { id: true },
  });
  if (!album) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const created = await prisma.albumSectionComment.create({
    data: {
      albumId: album.id,
      sectionId: payload.data.sectionId,
      songTrackNumber: payload.data.songTrackNumber,
      sectionType: payload.data.sectionType,
      sectionOrder: payload.data.sectionOrder,
      authorUserId: userId,
      body: payload.data.body,
    },
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

  // Notifications: album owner + @mentions (workspace members).
  const commentUrl = `/app/albums/${album.id}/studio?song=${payload.data.songTrackNumber}&sid=${encodeURIComponent(
    payload.data.sectionId,
  )}`;

  const mentionTokens = Array.from(payload.data.body.matchAll(/@([a-zA-Z0-9][a-zA-Z0-9._-]{1,31})/g))
    .map((m) => (m[1] ?? "").toLowerCase())
    .filter(Boolean)
    .slice(0, 16);

  const mentionedUserIds = new Set<string>();
  if (mentionTokens.length) {
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      select: { user: { select: { id: true, name: true, email: true } } },
      take: 100,
    });

    const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

    for (const { user } of members) {
      const handles = new Set<string>();
      if (user.email) {
        const email = user.email.toLowerCase();
        handles.add(email);
        handles.add(email.split("@")[0] ?? "");
      }
      if (user.name) {
        const s = slug(user.name);
        if (s) handles.add(s);
        const first = slug(user.name.split(/\s+/g)[0] ?? "");
        if (first) handles.add(first);
      }
      if (handles.size === 0) continue;

      if (mentionTokens.some((t) => handles.has(t))) {
        mentionedUserIds.add(user.id);
      }
    }
  }

  const notifications: Array<{
    workspaceId: string;
    userId: string;
    actorUserId: string;
    type: string;
    title: string;
    body?: string;
    url: string;
    albumId: string;
    commentId: string;
  }> = [];

  const excerpt = payload.data.body.trim().slice(0, 240);
  for (const mentionedUserId of mentionedUserIds) {
    if (mentionedUserId === userId) continue;
    notifications.push({
      workspaceId: workspace.id,
      userId: mentionedUserId,
      actorUserId: userId,
      type: "mention",
      title: `Mentioned in a comment · ${album.title}`,
      body: excerpt,
      url: commentUrl,
      albumId: album.id,
      commentId: created.id,
    });
  }

  // Notify workspace owner if not the author and not already mentioned.
  if (workspace.ownerId !== userId && !mentionedUserIds.has(workspace.ownerId)) {
    notifications.push({
      workspaceId: workspace.id,
      userId: workspace.ownerId,
      actorUserId: userId,
      type: "comment",
      title: `New comment · ${album.title}`,
      body: excerpt,
      url: commentUrl,
      albumId: album.id,
      commentId: created.id,
    });
  }

  if (notifications.length) {
    await prisma.notification.createMany({ data: notifications });
  }

  return NextResponse.json({ comment: created }, { status: 201 });
}
