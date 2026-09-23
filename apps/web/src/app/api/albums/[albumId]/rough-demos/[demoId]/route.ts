import { NextResponse } from "next/server";

import { writeAlbumSnapshot } from "@/server/album-sync";
import { trackProductEventSafe } from "@/server/analytics";
import { ApiError, apiHandler, parseJsonBody, requireAlbum, requireWorkspace } from "@/server/api";
import { getPrisma } from "@/server/db";
import { buildRoughDemoCollection } from "@/server/rough-demo-review";
import {
  RoughDemoBodySchema,
  listAlbumRoughDemos,
  normalizeRoughDemo,
  patchAlbumRoughDemos,
} from "@/server/rough-demos";

export const runtime = "nodejs";

type Context = { params: Promise<{ albumId: string; demoId: string }> };

async function requireRoughDemo(workspaceId: string, albumId: string, demoId: string) {
  const album = await requireAlbum(workspaceId, albumId, { id: true, data: true });
  const demo = listAlbumRoughDemos(album.data).find((item) => item.id === demoId);
  if (!demo) throw new ApiError(404, "Demo not found.");
  return { album, demo };
}

export const PATCH = apiHandler(async (request: Request, { params }: Context) => {
  const { userId, workspaceId } = await requireWorkspace();
  const payload = await parseJsonBody(request, RoughDemoBodySchema, "Invalid rough demo payload.");
  const { albumId, demoId } = await params;
  const { album: existing, demo: current } = await requireRoughDemo(workspaceId, albumId, demoId);

  const now = new Date().toISOString();
  const demo = normalizeRoughDemo({
    ...current,
    ...payload,
    id: current.id,
    created_at: current.created_at,
    updated_at: now,
  });
  const nextAlbum = patchAlbumRoughDemos(existing.data, (demos) =>
    demos.map((item) => (item.id === demoId ? demo : item)),
  );
  if (!nextAlbum) throw new ApiError(409, "Stored album data is invalid.");

  await getPrisma().$transaction(async (tx) => {
    await writeAlbumSnapshot(tx, existing.id, { ...nextAlbum, updated_at: now });
  });

  await trackProductEventSafe({
    name: "album_demo_updated",
    workspaceId,
    userId,
    albumId: existing.id,
    path: `/api/albums/${existing.id}/rough-demos/${demoId}`,
    metadata: {
      sourceKind: demo.source_kind,
      targetedTrack: demo.song_track_number,
      hasLocalFile: Boolean(demo.local_file),
    },
  });

  return NextResponse.json(buildRoughDemoCollection(nextAlbum));
});

export const DELETE = apiHandler(async (_request: Request, { params }: Context) => {
  const { userId, workspaceId } = await requireWorkspace();
  const { albumId, demoId } = await params;
  const { album: existing, demo: current } = await requireRoughDemo(workspaceId, albumId, demoId);

  const now = new Date().toISOString();
  const nextAlbum = patchAlbumRoughDemos(existing.data, (demos) =>
    demos.filter((item) => item.id !== demoId),
  );
  if (!nextAlbum) throw new ApiError(409, "Stored album data is invalid.");

  await getPrisma().$transaction(async (tx) => {
    await writeAlbumSnapshot(tx, existing.id, { ...nextAlbum, updated_at: now });
  });

  await trackProductEventSafe({
    name: "album_demo_deleted",
    workspaceId,
    userId,
    albumId: existing.id,
    path: `/api/albums/${existing.id}/rough-demos/${demoId}`,
    metadata: {
      sourceKind: current.source_kind,
      targetedTrack: current.song_track_number,
      hasLocalFile: Boolean(current.local_file),
    },
  });

  return NextResponse.json(buildRoughDemoCollection(nextAlbum));
});
