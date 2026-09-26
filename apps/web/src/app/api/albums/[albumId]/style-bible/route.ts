import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { StyleBibleSchema } from "@/server/album-json";
import { updateAlbumSnapshot } from "@/server/album-sync";
import { trackProductEventSafe } from "@/server/analytics";
import { ApiError, apiHandler, parseJsonBody, requireAlbum, requireWorkspace } from "@/server/api";
import { getPrisma } from "@/server/db";
import { assertStyleBibleListsFit, getAlbumStyleBible, patchAlbumStyleBible } from "@/server/style-bible";

export const runtime = "nodejs";

type Context = { params: Promise<{ albumId: string }> };

export const GET = apiHandler(async (_request: Request, { params }: Context) => {
  const { workspaceId } = await requireWorkspace();
  const { albumId } = await params;
  const album = await requireAlbum(workspaceId, albumId, { data: true });

  return NextResponse.json({ styleBible: getAlbumStyleBible(album.data) });
});

export const PATCH = apiHandler(async (request: Request, { params }: Context) => {
  const { userId, workspaceId } = await requireWorkspace();
  const payload = await parseJsonBody(request, StyleBibleSchema, "Invalid Sound bible payload.");
  assertStyleBibleListsFit(payload);
  const { albumId } = await params;
  const existing = await requireAlbum(workspaceId, albumId, { id: true });

  const { album } = await getPrisma().$transaction((tx) =>
    updateAlbumSnapshot(tx, existing.id, (stored) => {
      const patched = patchAlbumStyleBible(stored, payload);
      if (!patched) throw new ApiError(409, "Stored album data is invalid.");
      return { album: patched };
    }),
  );

  const styleBible = getAlbumStyleBible(album);

  await trackProductEventSafe({
    name: "album_style_bible_saved",
    workspaceId,
    userId,
    albumId: existing.id,
    path: `/api/albums/${existing.id}/style-bible`,
    metadata: {
      fieldsFilled: [
        Boolean(styleBible.lead_voice),
        Boolean(styleBible.narrator_perspective),
        styleBible.vocal_attributes.length > 0,
        styleBible.sonic_palette.length > 0,
        styleBible.arrangement_rules.length > 0,
        styleBible.mix_priorities.length > 0,
        styleBible.avoid_list.length > 0,
        styleBible.emotional_targets.length > 0,
        Boolean(styleBible.reference_strategy),
      ].filter(Boolean).length,
    } satisfies Prisma.InputJsonValue,
  });

  return NextResponse.json({ styleBible });
});
