import { NextResponse } from "next/server";
import { del } from "@vercel/blob";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

// Requires BLOB_READ_WRITE_TOKEN environment variable to be set.

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ albumId: string; memoId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { albumId, memoId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const album = await prisma.album.findFirst({
    where: { id: albumId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!album) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const memo = await prisma.voiceMemo.findFirst({
    where: { id: memoId, albumId: album.id },
    select: { id: true, authorUserId: true, audioUrl: true },
  });
  if (!memo) return NextResponse.json({ error: "Voice memo not found." }, { status: 404 });

  if (memo.authorUserId !== userId && workspace.ownerId !== userId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // Delete the blob from Vercel Blob storage
  await del(memo.audioUrl);

  await prisma.voiceMemo.delete({ where: { id: memo.id } });

  return NextResponse.json({ ok: true });
}
