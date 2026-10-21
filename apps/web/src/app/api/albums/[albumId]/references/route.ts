import { NextResponse } from "next/server";
import { z } from "zod";

import { trackProductEventSafe } from "@/server/analytics";
import { apiHandler, parseJsonBody, requireAlbum, requireWorkspace } from "@/server/api";
import { getPrisma } from "@/server/db";
import {
  buildReferenceData,
  listAlbumReferences,
  mapReference,
  REFERENCE_SELECT,
  parseReferenceBody,
} from "@/server/references";

export const runtime = "nodejs";

type Context = { params: Promise<{ albumId: string }> };

export const GET = apiHandler(async (_request: Request, { params }: Context) => {
  const { workspaceId } = await requireWorkspace();
  const { albumId } = await params;
  const album = await requireAlbum(workspaceId, albumId, { id: true });

  const references = await listAlbumReferences(workspaceId, album.id);
  return NextResponse.json({ references });
});

export const POST = apiHandler(async (request: Request, { params }: Context) => {
  const { userId, workspaceId } = await requireWorkspace();
  // The 400 names the field and its rule, as the form does.
  const payload = parseReferenceBody(await parseJsonBody(request, z.unknown()));
  const { albumId } = await params;
  const album = await requireAlbum(workspaceId, albumId, { id: true, data: true });

  const created = await getPrisma().albumReference.create({
    data: { albumId: album.id, ...buildReferenceData(album.data, payload) },
    select: REFERENCE_SELECT,
  });

  await trackProductEventSafe({
    name: "album_reference_added",
    workspaceId,
    userId,
    albumId: album.id,
    path: `/api/albums/${album.id}/references`,
    metadata: {
      targetRole: created.targetRole,
      songScoped: Boolean(created.songTrackNumber),
    },
  });

  return NextResponse.json({ reference: mapReference(created) }, { status: 201 });
});
