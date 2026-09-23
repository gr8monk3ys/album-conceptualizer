import { NextResponse } from "next/server";

import { trackProductEventSafe } from "@/server/analytics";
import { ApiError, apiHandler, parseJsonBody, requireAlbum, requireWorkspace } from "@/server/api";
import { getPrisma } from "@/server/db";
import {
  buildReferenceData,
  mapReference,
  REFERENCE_SELECT,
  ReferenceBodySchema,
} from "@/server/references";

export const runtime = "nodejs";

type Context = { params: Promise<{ albumId: string; referenceId: string }> };

export const PATCH = apiHandler(async (request: Request, { params }: Context) => {
  const { userId, workspaceId } = await requireWorkspace();
  const payload = await parseJsonBody(request, ReferenceBodySchema, "Invalid payload.");
  const { albumId, referenceId } = await params;
  const album = await requireAlbum(workspaceId, albumId, { id: true, data: true });
  const prisma = getPrisma();

  const existing = await prisma.albumReference.findFirst({
    where: { id: referenceId, albumId: album.id },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, "Reference not found.");

  const updated = await prisma.albumReference.update({
    where: { id: existing.id },
    data: buildReferenceData(album.data, payload),
    select: REFERENCE_SELECT,
  });

  await trackProductEventSafe({
    name: "album_reference_updated",
    workspaceId,
    userId,
    albumId: album.id,
    path: `/api/albums/${album.id}/references/${updated.id}`,
    metadata: {
      targetRole: updated.targetRole,
      songScoped: Boolean(updated.songTrackNumber),
    },
  });

  return NextResponse.json({ reference: mapReference(updated) });
});

export const DELETE = apiHandler(async (_request: Request, { params }: Context) => {
  const { userId, workspaceId } = await requireWorkspace();
  const { albumId, referenceId } = await params;
  const prisma = getPrisma();

  const existing = await prisma.albumReference.findFirst({
    where: {
      id: referenceId,
      albumId,
      album: { workspaceId },
    },
    select: { id: true, albumId: true, targetRole: true, songTrackNumber: true },
  });
  if (!existing) throw new ApiError(404, "Reference not found.");

  await prisma.albumReference.delete({ where: { id: existing.id } });

  await trackProductEventSafe({
    name: "album_reference_deleted",
    workspaceId,
    userId,
    albumId: existing.albumId,
    path: `/api/albums/${existing.albumId}/references/${existing.id}`,
    metadata: {
      targetRole: existing.targetRole,
      songScoped: Boolean(existing.songTrackNumber),
    },
  });

  return NextResponse.json({ ok: true });
});
