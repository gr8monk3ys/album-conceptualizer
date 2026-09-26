import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { ApiError, apiHandler, requireUser } from "@/server/api";
import { getPrisma } from "@/server/db";
import { notifyAlbumOwnerQuietly } from "@/server/notify";

export const runtime = "nodejs";

type Context = { params: Promise<{ albumId: string }> };

/** A published album's id, or a 404. Likes work on any public album, not just the caller's. */
async function requirePublicAlbumId(albumId: string) {
  const album = await getPrisma().album.findFirst({
    where: { id: albumId, isPublic: true },
    select: { id: true },
  });
  if (!album) throw new ApiError(404, "Not found.");
  return album.id;
}

export const POST = apiHandler(async (_request: Request, { params }: Context) => {
  const userId = await requireUser();
  const { albumId } = await params;
  const publicAlbumId = await requirePublicAlbumId(albumId);
  const prisma = getPrisma();

  let isNew = false;
  try {
    await prisma.albumLike.create({
      data: { albumId: publicAlbumId, userId },
      select: { id: true },
    });
    isNew = true;
  } catch (err) {
    // A duplicate like (unique constraint) is fine: the user already likes it.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
      throw new ApiError(500, "Your like didn't save. Try again.");
    }
  }
  // The album's owner hears about a new like once per liker (never about their own).
  if (isNew) await notifyAlbumOwnerQuietly(prisma, { albumId: publicAlbumId, actorUserId: userId, kind: "like" });

  const likes = await prisma.albumLike.count({ where: { albumId: publicAlbumId } });
  return NextResponse.json({ liked: true, likes });
});

export const DELETE = apiHandler(async (_request: Request, { params }: Context) => {
  const userId = await requireUser();
  const { albumId } = await params;
  const publicAlbumId = await requirePublicAlbumId(albumId);
  const prisma = getPrisma();

  await prisma.albumLike.deleteMany({
    where: { albumId: publicAlbumId, userId },
  });

  const likes = await prisma.albumLike.count({ where: { albumId: publicAlbumId } });
  return NextResponse.json({ liked: false, likes });
});
