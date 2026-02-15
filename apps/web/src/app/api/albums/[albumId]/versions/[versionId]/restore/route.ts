import { NextResponse } from "next/server";

import { AlbumJsonSchema } from "@/server/album-json";
import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { buildAlbumMutationData } from "@/server/album-sync";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ albumId: string; versionId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { albumId, versionId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const version = await prisma.albumVersion.findFirst({
    where: { id: versionId, albumId, album: { workspaceId: workspace.id } },
    select: { id: true, data: true },
  });
  if (!version) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const parsed = AlbumJsonSchema.safeParse(version.data);
  if (!parsed.success) {
    return NextResponse.json({ error: "Version snapshot is invalid album JSON." }, { status: 400 });
  }

  const mutation = buildAlbumMutationData(parsed.data);

  await prisma.$transaction([
    prisma.song.deleteMany({ where: { albumId } }),
    prisma.album.update({
      where: { id: albumId },
      data: {
        ...mutation,
      },
      select: { id: true },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

