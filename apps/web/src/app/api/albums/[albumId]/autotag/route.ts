import { NextResponse } from "next/server";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { applyAutoTagsFromLyrics } from "@/server/autotag";
import { buildAlbumMutationData } from "@/server/album-sync";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { albumId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const album = await prisma.album.findFirst({
    where: { id: albumId, workspaceId: workspace.id },
    select: { id: true, data: true },
  });
  if (!album) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const updated = applyAutoTagsFromLyrics(album.data);
  if (!updated) return NextResponse.json({ error: "Album data is invalid." }, { status: 400 });

  const mutation = buildAlbumMutationData(updated);

  await prisma.$transaction(async (tx) => {
    // Keep relational tables in sync with the new JSON snapshot.
    await tx.song.deleteMany({ where: { albumId: album.id } });
    await tx.album.update({
      where: { id: album.id },
      data: { ...mutation },
      select: { id: true },
    });
  });

  return NextResponse.json({ ok: true });
}

