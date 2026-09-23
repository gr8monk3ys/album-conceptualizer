import { NextResponse } from "next/server";

import { writeAlbumSnapshot } from "@/server/album-sync";
import { ApiError, apiHandler, requireAlbum, requireWorkspace } from "@/server/api";
import { applyAutoTagsFromLyrics } from "@/server/autotag";
import { getPrisma } from "@/server/db";

export const runtime = "nodejs";

export const POST = apiHandler(
  async (_request: Request, { params }: { params: Promise<{ albumId: string }> }) => {
    const { workspaceId } = await requireWorkspace();
    const { albumId } = await params;
    const album = await requireAlbum(workspaceId, albumId, { id: true, data: true });

    const tagged = applyAutoTagsFromLyrics(album.data);
    if (!tagged) throw new ApiError(400, "Album data is invalid.");

    // The album was rewritten, so its JSON snapshot carries a fresh updated_at.
    const updated = { ...tagged, updated_at: new Date().toISOString() };

    await getPrisma().$transaction(async (tx) => {
      await writeAlbumSnapshot(tx, album.id, updated);
    });

    return NextResponse.json({ ok: true });
  },
);
