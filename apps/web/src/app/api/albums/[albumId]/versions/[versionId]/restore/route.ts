import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { AlbumJsonSchema } from "@/server/album-json";
import { writeAlbumSnapshot } from "@/server/album-sync";
import { ApiError, apiHandler, requireAlbum, requireWorkspace } from "@/server/api";
import { getPrisma } from "@/server/db";

export const runtime = "nodejs";

export const POST = apiHandler(
  async (
    _request: Request,
    { params }: { params: Promise<{ albumId: string; versionId: string }> },
  ) => {
    const { userId, workspaceId } = await requireWorkspace();
    const { albumId, versionId } = await params;
    const album = await requireAlbum(workspaceId, albumId, { id: true, data: true });

    const prisma = getPrisma();
    const version = await prisma.albumVersion.findFirst({
      where: { id: versionId, albumId: album.id },
      select: { data: true, message: true, createdAt: true },
    });
    if (!version) throw new ApiError(404, "Not found.");

    const parsed = AlbumJsonSchema.safeParse(version.data);
    if (!parsed.success) throw new ApiError(400, "Version snapshot is invalid album JSON.");

    const restored = { ...parsed.data, updated_at: new Date().toISOString() };
    const label = version.message ?? version.createdAt.toISOString();

    await prisma.$transaction(async (tx) => {
      // Keep the state being overwritten so a restore can itself be undone.
      if (album.data !== null) {
        await tx.albumVersion.create({
          data: {
            albumId: album.id,
            createdByUserId: userId,
            message: `Before restoring ${label}`.slice(0, 200),
            data: album.data as Prisma.InputJsonValue,
          },
          select: { id: true },
        });
      }
      await writeAlbumSnapshot(tx, album.id, restored);
    });

    return NextResponse.json({ ok: true });
  },
);
