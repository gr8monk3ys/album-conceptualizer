import { NextResponse } from "next/server";

import { updateAlbumSnapshot } from "@/server/album-sync";
import { trackProductEventSafe } from "@/server/analytics";
import { ApiError, apiHandler, parseJsonBody, requireAlbum, requireWorkspace } from "@/server/api";
import { getPrisma } from "@/server/db";
import { buildRoughDemoCollection } from "@/server/rough-demo-review";
import {
  type AlbumRoughDemoRecord,
  RoughDemoBodySchema,
  listAlbumRoughDemos,
  normalizeRoughDemo,
  patchAlbumRoughDemos,
} from "@/server/rough-demos";

export const runtime = "nodejs";

type Context = { params: Promise<{ albumId: string; demoId: string }> };

/** The demo as stored now (read under the album lock), or a 404. */
function requireRoughDemo(stored: unknown, demoId: string): AlbumRoughDemoRecord {
  const demo = listAlbumRoughDemos(stored).find((item) => item.id === demoId);
  if (!demo) throw new ApiError(404, "Demo not found.");
  return demo;
}

export const PATCH = apiHandler(async (request: Request, { params }: Context) => {
  const { userId, workspaceId } = await requireWorkspace();
  const payload = await parseJsonBody(request, RoughDemoBodySchema, "Invalid rough demo payload.");
  const { albumId, demoId } = await params;
  const existing = await requireAlbum(workspaceId, albumId, { id: true });

  const { album: nextAlbum, demo } = await getPrisma().$transaction((tx) =>
    updateAlbumSnapshot(tx, existing.id, (stored) => {
      const current = requireRoughDemo(stored, demoId);
      const updated = normalizeRoughDemo({
        ...current,
        ...payload,
        id: current.id,
        created_at: current.created_at,
        updated_at: new Date().toISOString(),
      });
      const patched = patchAlbumRoughDemos(stored, (demos) =>
        demos.map((item) => (item.id === demoId ? updated : item)),
      );
      if (!patched) throw new ApiError(409, "Stored album data is invalid.");
      return { album: patched, demo: updated };
    }),
  );

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
  const existing = await requireAlbum(workspaceId, albumId, { id: true });

  const { album: nextAlbum, deleted } = await getPrisma().$transaction((tx) =>
    updateAlbumSnapshot(tx, existing.id, (stored) => {
      const current = requireRoughDemo(stored, demoId);
      const patched = patchAlbumRoughDemos(stored, (demos) => demos.filter((item) => item.id !== demoId));
      if (!patched) throw new ApiError(409, "Stored album data is invalid.");
      return { album: patched, deleted: current };
    }),
  );

  await trackProductEventSafe({
    name: "album_demo_deleted",
    workspaceId,
    userId,
    albumId: existing.id,
    path: `/api/albums/${existing.id}/rough-demos/${demoId}`,
    metadata: {
      sourceKind: deleted.source_kind,
      targetedTrack: deleted.song_track_number,
      hasLocalFile: Boolean(deleted.local_file),
    },
  });

  return NextResponse.json(buildRoughDemoCollection(nextAlbum));
});
