import { NextResponse } from "next/server";
import { z } from "zod";

import { writeAlbumSnapshot } from "@/server/album-sync";
import { ApiError, apiHandler, parseJsonBody, requireAlbum, requireWorkspace } from "@/server/api";
import { removeAddedTags } from "@/server/autotag";
import { getPrisma } from "@/server/db";

export const runtime = "nodejs";

const TagList = z.array(z.string().trim().min(1).max(80)).max(64).default([]);
const BodySchema = z.object({
  remove: z
    .array(
      z.object({
        trackNumber: z.number().int().min(1),
        themes: TagList,
        motifs: TagList,
        characters: TagList,
      }),
    )
    .min(1)
    .max(200),
});

/**
 * Undo for "Tag from lyrics": the Bible sends back exactly what the apply said it added, and
 * only those tags come off (tags added by hand since stay). Answers with what was removed.
 */
export const POST = apiHandler(
  async (request: Request, { params }: { params: Promise<{ albumId: string }> }) => {
    const { workspaceId } = await requireWorkspace();
    const { albumId } = await params;
    const { remove } = await parseJsonBody(request, BodySchema, "Nothing to undo.");
    const album = await requireAlbum(workspaceId, albumId, { id: true, data: true });

    const result = removeAddedTags(album.data, remove);
    if (!result) {
      throw new ApiError(400, "This album's data can't be read, so the tags weren't taken off. Save it again in the Studio.");
    }

    if (result.removed.length) {
      const updated = { ...result.album, updated_at: new Date().toISOString() };
      await getPrisma().$transaction(async (tx) => {
        await writeAlbumSnapshot(tx, album.id, updated);
      });
    }

    return NextResponse.json({ removed: result.removed });
  },
);
