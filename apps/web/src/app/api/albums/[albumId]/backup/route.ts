import { trackProductEventSafe } from "@/server/analytics";
import { apiHandler, enforceRateLimit, requireAlbum, requireWorkspace } from "@/server/api";
import { contentDisposition, safeFilename } from "@/server/headers";

export const runtime = "nodejs";

/**
 * The album as one JSON file, free: the artist's own work is never behind credits. It is the
 * album exactly as saved (every track, section, lyric and chord, the Story bible's fields, the
 * Sound bible and the demo notes), built here without the export service. The zip, which the
 * export service builds in several formats, is what costs credits.
 */
export const GET = apiHandler(
  async (_request: Request, { params }: { params: Promise<{ albumId: string }> }) => {
    const { userId, workspaceId } = await requireWorkspace();
    await enforceRateLimit(
      "export_zip",
      `user:${userId}`,
      "Too many downloads. Please wait a bit and try again.",
    );

    const { albumId } = await params;
    const album = await requireAlbum(workspaceId, albumId, { id: true, title: true, data: true });

    await trackProductEventSafe({
      name: "album_backup_downloaded",
      workspaceId,
      userId,
      albumId: album.id,
      path: `/api/albums/${album.id}/backup`,
    });

    return new Response(`${JSON.stringify(album.data, null, 2)}\n`, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": contentDisposition(`${safeFilename(album.title, "album")}_backup.json`),
        "cache-control": "no-store",
      },
    });
  },
);
