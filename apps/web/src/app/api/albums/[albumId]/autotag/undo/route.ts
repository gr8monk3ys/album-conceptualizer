import { NextResponse } from "next/server";
import { z } from "zod";

import { updateAlbumSnapshot } from "@/server/album-sync";
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
    const album = await requireAlbum(workspaceId, albumId, { id: true });

    const { removed } = await getPrisma().$transaction((tx) =>
      updateAlbumSnapshot(tx, album.id, (stored) => {
        const result = removeAddedTags(stored, remove);
        if (!result) {
          throw new ApiError(400, "This album's data can't be read, so the tags weren't taken off. Save it again in the Studio.");
        }
        return { ...result, album: result.removed.length ? result.album : null };
      }),
    );

    return NextResponse.json({ removed });
  },
);
