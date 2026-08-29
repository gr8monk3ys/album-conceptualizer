import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { getAuthSession } from "@/server/auth";
import { StyleBibleSchema } from "@/server/album-json";
import { buildAlbumMutationData } from "@/server/album-sync";
import { trackProductEventSafe } from "@/server/analytics";
import { getPrisma } from "@/server/db";
import { getAlbumStyleBible, patchAlbumStyleBible } from "@/server/style-bible";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const runtime = "nodejs";

const BodySchema = StyleBibleSchema;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { albumId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();
  const album = await prisma.album.findFirst({
    where: { id: albumId, workspaceId: workspace.id },
    select: { data: true },
  });

  if (!album) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({ styleBible: getAlbumStyleBible(album.data) });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const payload = BodySchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid style bible payload." }, { status: 400 });
  }

  const { albumId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();
  const existing = await prisma.album.findFirst({
    where: { id: albumId, workspaceId: workspace.id },
    select: { id: true, data: true },
  });

  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const patchedAlbum = patchAlbumStyleBible(existing.data, payload.data);
  if (!patchedAlbum) {
    return NextResponse.json({ error: "Stored album data is invalid." }, { status: 409 });
  }

  const nextAlbum = {
    ...patchedAlbum,
    updated_at: new Date().toISOString(),
  };
  const mutation = buildAlbumMutationData(nextAlbum);

  await prisma.$transaction(async (tx) => {
    await tx.song.deleteMany({ where: { albumId: existing.id } });
    await tx.album.update({
      where: { id: existing.id },
      data: mutation,
      select: { id: true },
    });
  });

  const styleBible = getAlbumStyleBible(nextAlbum);

  await trackProductEventSafe({
    name: "album_style_bible_saved",
    workspaceId: workspace.id,
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
}
