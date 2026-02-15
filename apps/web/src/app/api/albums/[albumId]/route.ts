import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { AlbumJsonSchema } from "@/server/album-json";
import { buildAlbumMutationData } from "@/server/album-sync";

export const runtime = "nodejs";

const PatchBodySchema = z.object({
  album: AlbumJsonSchema,
  versionMessage: z.string().trim().min(1).max(200).optional(),
});

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const payload = PatchBodySchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid album payload." }, { status: 400 });
  }

  const { albumId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const existing = await prisma.album.findFirst({
    where: { id: albumId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Update updated_at in the JSON snapshot so exports carry correct metadata.
  const album = {
    ...payload.data.album,
    updated_at: new Date().toISOString(),
  };

  const mutation = buildAlbumMutationData(album);

  await prisma.$transaction(async (tx) => {
    await tx.song.deleteMany({ where: { albumId: existing.id } });
    await tx.album.update({
      where: { id: existing.id },
      data: {
        ...mutation,
      },
      select: { id: true },
    });

    if (payload.data.versionMessage) {
      await tx.albumVersion.create({
        data: {
          albumId: existing.id,
          createdByUserId: userId,
          message: payload.data.versionMessage,
          data: album as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
