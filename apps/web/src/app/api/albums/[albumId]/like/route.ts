import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";

export const runtime = "nodejs";

async function ensurePublicAlbum(prisma: ReturnType<typeof getPrisma>, albumId: string) {
  const album = await prisma.album.findFirst({
    where: { id: albumId, isPublic: true },
    select: { id: true },
  });
  return album?.id ?? null;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { albumId } = await params;
  const prisma = getPrisma();
  const publicAlbumId = await ensurePublicAlbum(prisma, albumId);
  if (!publicAlbumId) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    await prisma.albumLike.create({
      data: { albumId: publicAlbumId, userId },
      select: { id: true },
    });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
      return NextResponse.json({ error: "Unable to like." }, { status: 500 });
    }
  }

  const likes = await prisma.albumLike.count({ where: { albumId: publicAlbumId } });
  return NextResponse.json({ liked: true, likes });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { albumId } = await params;
  const prisma = getPrisma();
  const publicAlbumId = await ensurePublicAlbum(prisma, albumId);
  if (!publicAlbumId) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await prisma.albumLike.deleteMany({
    where: { albumId: publicAlbumId, userId },
  });

  const likes = await prisma.albumLike.count({ where: { albumId: publicAlbumId } });
  return NextResponse.json({ liked: false, likes });
}

