import { NextResponse } from "next/server";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const runtime = "nodejs";

export async function POST() {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  await prisma.notification.updateMany({
    where: { workspaceId: workspace.id, userId, readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

