import { NextResponse } from "next/server";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { albumId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const existing = await prisma.album.findFirst({
    where: { id: albumId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await prisma.album.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}

