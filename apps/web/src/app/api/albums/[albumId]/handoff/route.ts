import { z } from "zod";

import { trackProductEventSafe } from "@/server/analytics";
import {
  apiHandler,
  enforceRateLimit,
  parseWith,
  requireAlbum,
  requireWorkspace,
} from "@/server/api";
import { buildHandoffPackMarkdown, getHandoffPackFilename } from "@/server/handoff-pack";
import { contentDisposition } from "@/server/headers";
import { listAlbumReferences } from "@/server/references";

export const runtime = "nodejs";

const TargetSchema = z.enum(["suno", "udio", "daw"]);

export const GET = apiHandler(
  async (request: Request, { params }: { params: Promise<{ albumId: string }> }) => {
    const { userId, workspaceId } = await requireWorkspace();
    await enforceRateLimit(
      "export_zip",
      `user:${userId}`,
      "Too many handoff downloads. Please wait a bit and try again.",
    );

    const { albumId } = await params;
    const album = await requireAlbum(workspaceId, albumId, { id: true, title: true, data: true });

    const url = new URL(request.url);
    const target = parseWith(
      TargetSchema,
      url.searchParams.get("target") ?? "suno",
      "Invalid handoff target.",
    );

    const references = await listAlbumReferences(workspaceId, album.id);
    const markdown = buildHandoffPackMarkdown({
      albumData: album.data,
      references,
      target,
    });
    const filename = getHandoffPackFilename(album.title, target);

    await trackProductEventSafe({
      name: "album_handoff_downloaded",
      workspaceId,
      userId,
      albumId: album.id,
      path: `/api/albums/${album.id}/handoff`,
      metadata: {
        target,
        referenceCount: references.length,
      },
    });

    return new Response(markdown, {
      status: 200,
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": contentDisposition(filename),
        "cache-control": "no-store",
      },
    });
  },
);
