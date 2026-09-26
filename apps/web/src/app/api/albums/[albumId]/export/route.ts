import { z } from "zod";

import { trackProductEventSafe } from "@/server/analytics";
import { apiHandler, enforceRateLimit, parseJsonBody, requireAlbum, requireWorkspace } from "@/server/api";
import { CREDIT_COSTS, withCredits } from "@/server/credits";
import { exportAlbumZip } from "@/server/engine";
import { contentDisposition, safeFilename } from "@/server/headers";

export const runtime = "nodejs";

const BodySchema = z.object({
  formats: z
    .array(z.string().trim().toLowerCase().pipe(z.enum(["midi", "chordpro", "musicxml", "json", "text"])))
    .max(5)
    .default(["json"])
    .refine((formats) => formats.length > 0, "Select at least one format."),
  includeProductionNotes: z.boolean().optional().default(false),
});

/**
 * Builds the album's zip on the engine and answers with it. A POST, because it spends
 * credits: a link or redirect from another site (a top-level GET, which carries the session
 * cookie) can't make one. The client downloads the zip from this response.
 */
export const POST = apiHandler(
  async (request: Request, { params }: { params: Promise<{ albumId: string }> }) => {
    const { userId, workspaceId, plan } = await requireWorkspace();
    await enforceRateLimit(
      "export_zip",
      `user:${userId}`,
      "Too many exports. Please wait a bit and try again.",
    );

    const { albumId } = await params;
    const album = await requireAlbum(workspaceId, albumId, { title: true, data: true });

    const { formats: requested, includeProductionNotes } = await parseJsonBody(
      request,
      BodySchema,
      "Invalid formats.",
    );
    const formats = [...new Set(requested)];

    const body = await withCredits(
      {
        workspaceId,
        plan,
        amount: CREDIT_COSTS.exportZip,
        reason: "export_zip",
        metadata: { albumId, formats },
        insufficientMessage: "Not enough credits to export. Complete challenges or upgrade.",
      },
      () => exportAlbumZip({ album: album.data, formats, includeProductionNotes }),
    );

    await trackProductEventSafe({
      name: "album_export_requested",
      workspaceId,
      userId,
      albumId,
      path: `/api/albums/${albumId}/export`,
      metadata: { formats, includeProductionNotes },
    });

    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": contentDisposition(`${safeFilename(album.title, "album")}_export.zip`),
        "cache-control": "no-store",
      },
    });
  },
);
