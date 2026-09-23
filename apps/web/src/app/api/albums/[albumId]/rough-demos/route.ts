import { NextResponse } from "next/server";

import { writeAlbumSnapshot } from "@/server/album-sync";
import { trackProductEventSafe } from "@/server/analytics";
import { ApiError, apiHandler, parseJsonBody, requireAlbum, requireWorkspace } from "@/server/api";
import { getPrisma } from "@/server/db";
import { buildRoughDemoCollection } from "@/server/rough-demo-review";
import {
  RoughDemoBodySchema,
  normalizeRoughDemo,
  patchAlbumRoughDemos,
} from "@/server/rough-demos";

export const runtime = "nodejs";

type Context = { params: Promise<{ albumId: string }> };

export const GET = apiHandler(async (_request: Request, { params }: Context) => {
  const { workspaceId } = await requireWorkspace();
  const { albumId } = await params;
  const album = await requireAlbum(workspaceId, albumId, { data: true });

  return NextResponse.json(buildRoughDemoCollection(album.data));
});

export const POST = apiHandler(async (request: Request, { params }: Context) => {
  const { userId, workspaceId } = await requireWorkspace();
  const payload = await parseJsonBody(request, RoughDemoBodySchema, "Invalid rough demo payload.");
  const { albumId } = await params;
  const existing = await requireAlbum(workspaceId, albumId, { id: true, data: true });

  const now = new Date().toISOString();
  const demo = normalizeRoughDemo({
    ...payload,
    created_at: now,
    updated_at: now,
  });
  const nextAlbum = patchAlbumRoughDemos(existing.data, (current) => [demo, ...current]);
  if (!nextAlbum) throw new ApiError(409, "Stored album data is invalid.");

  await getPrisma().$transaction(async (tx) => {
    await writeAlbumSnapshot(tx, existing.id, { ...nextAlbum, updated_at: now });
  });

  await trackProductEventSafe({
    name: "album_demo_added",
    workspaceId,
    userId,
    albumId: existing.id,
    path: `/api/albums/${existing.id}/rough-demos`,
    metadata: {
      sourceKind: demo.source_kind,
      targetedTrack: demo.song_track_number,
      hasLocalFile: Boolean(demo.local_file),
    },
  });

  return NextResponse.json(buildRoughDemoCollection(nextAlbum));
});
