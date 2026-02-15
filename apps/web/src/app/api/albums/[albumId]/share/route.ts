import { NextResponse } from "next/server";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const runtime = "nodejs";

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function newShareToken() {
  // Short and URL-safe.
  return crypto.randomUUID().replace(/-/g, "");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { albumId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const share = await prisma.albumShareLink.findFirst({
    where: { albumId, album: { workspaceId: workspace.id } },
    select: { token: true, revokedAt: true, expiresAt: true },
  });
  if (!share) return NextResponse.json({ share: null });

  return NextResponse.json({
    share: {
      ...share,
      url: `${getAppUrl().replace(/\/+$/, "")}/share/${share.token}`,
    },
  });
}

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

  const exists = await prisma.album.findFirst({
    where: { id: albumId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!exists) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const token = newShareToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  const share = await prisma.albumShareLink.upsert({
    where: { albumId },
    create: {
      albumId,
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

  return NextResponse.json({
    share: {
      ...share,
      url: `${getAppUrl().replace(/\/+$/, "")}/share/${share.token}`,
    },
  });
}

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

  const share = await prisma.albumShareLink.findFirst({
    where: { albumId, album: { workspaceId: workspace.id } },
    select: { albumId: true },
  });
  if (!share) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await prisma.albumShareLink.update({
    where: { albumId: share.albumId },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
