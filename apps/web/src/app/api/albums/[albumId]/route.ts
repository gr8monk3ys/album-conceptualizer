import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { AlbumJsonSchema } from "@/server/album-json";
import { keepFieldsTheStudioDoesNotEdit, updateAlbumSnapshot } from "@/server/album-sync";
import { trackProductEventSafe } from "@/server/analytics";
import { apiHandler, parseJsonBody, requireAlbum, requireWorkspace } from "@/server/api";
import { getPrisma } from "@/server/db";

export const runtime = "nodejs";

type Context = { params: Promise<{ albumId: string }> };

const PatchBodySchema = z.object({
  album: AlbumJsonSchema,
  versionMessage: z.string().trim().min(1).max(200).optional(),
});

export const DELETE = apiHandler(async (_request: Request, { params }: Context) => {
  const { workspaceId } = await requireWorkspace();
  const { albumId } = await params;
  const existing = await requireAlbum(workspaceId, albumId, { id: true });

  await getPrisma().album.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
});

export const PATCH = apiHandler(async (request: Request, { params }: Context) => {
  const { userId, workspaceId } = await requireWorkspace();
  const payload = await parseJsonBody(request, PatchBodySchema, "Invalid album payload.");
  const { albumId } = await params;
  const existing = await requireAlbum(workspaceId, albumId, { id: true });

  const album = await getPrisma().$transaction(async (tx) => {
    // The Studio's copy replaces the album, except the parts it never edits (Sound bible, demos),
    // which keep what is stored now. The written snapshot carries a fresh updated_at for exports.
    const { album: saved } = await updateAlbumSnapshot(tx, existing.id, (stored) => ({
      album: keepFieldsTheStudioDoesNotEdit(stored, payload.album),
    }));
    if (payload.versionMessage) {
      await tx.albumVersion.create({
        data: {
          albumId: existing.id,
          createdByUserId: userId,
          message: payload.versionMessage,
          data: saved as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
    }
    return saved;
  });

  await trackProductEventSafe({
    name: "album_saved",
    workspaceId,
    userId,
    albumId: existing.id,
    path: `/api/albums/${existing.id}`,
    metadata: {
      withVersion: Boolean(payload.versionMessage),
      trackCount: album.songs.length,
    },
  });

  return NextResponse.json({ ok: true });
});
