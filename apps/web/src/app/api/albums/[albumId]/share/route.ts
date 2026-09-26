import { NextResponse } from "next/server";

import { ApiError, apiHandler, requireAlbum, requireWorkspace } from "@/server/api";
import { getPrisma } from "@/server/db";

export const runtime = "nodejs";

type Context = { params: Promise<{ albumId: string }> };

function shareUrl(token: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${appUrl.replace(/\/+$/, "")}/share/${token}`;
}

function newShareToken() {
  // Short and URL-safe.
  return crypto.randomUUID().replace(/-/g, "");
}

export const GET = apiHandler(async (_request: Request, { params }: Context) => {
  const { workspaceId } = await requireWorkspace();
  const { albumId } = await params;

  const share = await getPrisma().albumShareLink.findFirst({
    where: { albumId, album: { workspaceId } },
    select: { token: true, revokedAt: true, expiresAt: true },
  });
  if (!share) return NextResponse.json({ share: null });

  return NextResponse.json({ share: { ...share, url: shareUrl(share.token) } });
});

export const POST = apiHandler(async (_request: Request, { params }: Context) => {
  const { userId, workspaceId } = await requireWorkspace();
  const { albumId } = await params;
  const album = await requireAlbum(workspaceId, albumId, { id: true });

  const token = newShareToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  const share = await getPrisma().albumShareLink.upsert({
    where: { albumId: album.id },
    create: {
      albumId: album.id,
      token,
      createdByUserId: userId,
      expiresAt,
    },
    update: {
      token,
      revokedAt: null,
      expiresAt,
      createdByUserId: userId,
    },
    select: { token: true, revokedAt: true, expiresAt: true },
  });

  return NextResponse.json({ share: { ...share, url: shareUrl(share.token) } });
});

export const DELETE = apiHandler(async (_request: Request, { params }: Context) => {
  const { workspaceId } = await requireWorkspace();
  const { albumId } = await params;
  const prisma = getPrisma();

  const share = await prisma.albumShareLink.findFirst({
    where: { albumId, album: { workspaceId } },
    select: { albumId: true },
  });
  if (!share) throw new ApiError(404, "Not found.");

  await prisma.albumShareLink.update({
    where: { albumId: share.albumId },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
});
