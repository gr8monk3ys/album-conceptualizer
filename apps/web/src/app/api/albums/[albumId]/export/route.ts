import { z } from "zod";

import { trackProductEventSafe } from "@/server/analytics";
import { apiHandler, enforceRateLimit, parseWith, requireAlbum, requireWorkspace } from "@/server/api";
import { CREDIT_COSTS, withCredits } from "@/server/credits";
import { exportAlbumZip } from "@/server/engine";
import { contentDisposition, safeFilename } from "@/server/headers";

export const runtime = "nodejs";

const FormatsSchema = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )
  .pipe(z.array(z.enum(["midi", "chordpro", "musicxml", "json", "text"])))
  .refine((formats) => formats.length > 0, "Select at least one format.");

export const GET = apiHandler(
  async (request: Request, { params }: { params: Promise<{ albumId: string }> }) => {
    const { userId, workspaceId, plan } = await requireWorkspace();
    await enforceRateLimit(
      "export_zip",
      `user:${userId}`,
      "Too many exports. Please wait a bit and try again.",
    );

    const { albumId } = await params;
    const album = await requireAlbum(workspaceId, albumId, { title: true, data: true });

    const url = new URL(request.url);
    const formats = parseWith(FormatsSchema, url.searchParams.get("formats") ?? "json", "Invalid formats.");
    const includeProductionNotes = url.searchParams.get("production_notes") === "1";

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
