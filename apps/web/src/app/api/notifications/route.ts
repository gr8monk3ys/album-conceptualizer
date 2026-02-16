import { NextResponse } from "next/server";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get("unread") === "1";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200);
  const cursor = url.searchParams.get("cursor") ?? undefined;

  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const notifications = await prisma.notification.findMany({
    where: {
      workspaceId: workspace.id,
      userId,
      ...(unreadOnly ? { readAt: null } : {}),
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1, // fetch one extra for cursor
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      url: true,
      albumId: true,
      createdAt: true,
      readAt: true,
      actor: { select: { id: true, name: true, image: true } },
    },
  });

  const hasMore = notifications.length > limit;
  const items = hasMore ? notifications.slice(0, limit) : notifications;
  const nextCursor = hasMore ? items[items.length - 1]?.createdAt.toISOString() : null;

  // Also return unread count for badge
  const unreadCount = await prisma.notification.count({
    where: { workspaceId: workspace.id, userId, readAt: null },
  });

  return NextResponse.json({
    notifications: items,
    unreadCount,
    nextCursor,
  });
}
