import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const runtime = "nodejs";

const CreateBodySchema = z.object({
  message: z.string().trim().min(1).max(200).optional(),
});

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

  const versions = await prisma.albumVersion.findMany({
    where: { albumId, album: { workspaceId: workspace.id } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      message: true,
      createdAt: true,
      createdBy: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json({ versions });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { albumId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const payload = CreateBodySchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const album = await prisma.album.findFirst({
    where: { id: albumId, workspaceId: workspace.id },
    select: { id: true, data: true },
  });
  if (!album) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!album.data) {
    return NextResponse.json({ error: "Album has no saved data snapshot." }, { status: 400 });
  }

  const created = await prisma.albumVersion.create({
    data: {
      albumId: album.id,
      createdByUserId: userId,
      message: payload.data.message ?? null,
      data: album.data,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}

