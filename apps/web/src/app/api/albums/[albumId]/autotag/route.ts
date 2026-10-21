import { NextResponse } from "next/server";
import { z } from "zod";

import { updateAlbumSnapshot } from "@/server/album-sync";
import { ApiError, apiHandler, parseJsonBody, requireAlbum, requireWorkspace } from "@/server/api";
import { applyAcceptedTags, proposeTagsFromLyrics } from "@/server/autotag";
import { getPrisma } from "@/server/db";

export const runtime = "nodejs";

const UNREADABLE = "This album's data can't be read, so no tags can be suggested. Save it again in the Studio.";

/**
 * "Tag from lyrics", step one: what the lyrics suggest, per track, without writing anything.
 * The artist reviews these on the Bible and sends back the ones they accept.
 */
export const GET = apiHandler(
  async (_request: Request, { params }: { params: Promise<{ albumId: string }> }) => {
    const { workspaceId } = await requireWorkspace();
    const { albumId } = await params;
    const album = await requireAlbum(workspaceId, albumId, { id: true, data: true });

    const result = proposeTagsFromLyrics(album.data);
    if (!result) throw new ApiError(400, UNREADABLE);
    return NextResponse.json(result);
  },
);

const TagList = z.array(z.string().trim().min(1).max(80)).max(64).default([]);
const BodySchema = z.object({
  accept: z
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
 * Step two: add only the tags the artist accepted. Answers with exactly what was added, so the
 * confirmation can name it ("Added tide to 04").
 */
export const POST = apiHandler(
  async (request: Request, { params }: { params: Promise<{ albumId: string }> }) => {
    const { workspaceId } = await requireWorkspace();
    const { albumId } = await params;
    const { accept } = await parseJsonBody(request, BodySchema, "Choose at least one tag to add.");
    const album = await requireAlbum(workspaceId, albumId, { id: true });

    const { added } = await getPrisma().$transaction((tx) =>
      updateAlbumSnapshot(tx, album.id, (stored) => {
        const result = applyAcceptedTags(stored, accept);
        if (!result) throw new ApiError(400, UNREADABLE);
        // Nothing new to add: leave the album (and its updated_at) as it is.
        return { ...result, album: result.added.length ? result.album : null };
      }),
    );

    return NextResponse.json({ added });
  },
);
