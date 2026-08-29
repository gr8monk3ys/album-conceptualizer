import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/server/auth";
import { trackProductEventSafe } from "@/server/analytics";
import { findAlbumSongByTrackNumber } from "@/server/album-songs";
import { getPrisma } from "@/server/db";
import { listAlbumReferences } from "@/server/references";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const runtime = "nodejs";

const BodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  artist: z.string().trim().max(200).optional(),
  sourceUrl: z.url().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
  targetRole: z
    .enum([
      "album-world",
      "opener",
      "closer",
      "chorus-energy",
      "vocal-texture",
      "mix-palette",
      "bridge-contrast",
    ])
    .optional(),
  bpm: z.number().int().min(40).max(280).optional(),
  key: z.string().trim().max(64).optional(),
  moodTags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  arrangementTags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  songTrackNumber: z.number().int().min(1).max(99).optional(),
});

function normalizeTags(values: string[] | undefined) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => value.toLowerCase()),
    ),
  );
}

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
    select: { id: true },
  });
  if (!album) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const references = await listAlbumReferences(workspace.id, album.id);
  return NextResponse.json({ references });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const payload = BodySchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { albumId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();
  const album = await prisma.album.findFirst({
    where: { id: albumId, workspaceId: workspace.id },
    select: { id: true, data: true },
  });
  if (!album) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const song = payload.data.songTrackNumber
    ? findAlbumSongByTrackNumber(album.data, payload.data.songTrackNumber)
    : null;
  if (payload.data.songTrackNumber && !song) {
    return NextResponse.json({ error: "Selected song target was not found." }, { status: 400 });
  }

  const created = await prisma.albumReference.create({
    data: {
      albumId: album.id,
      songId: song?.id ?? null,
      songTrackNumber: song?.trackNumber ?? null,
      songTitle: song?.title ?? null,
      title: payload.data.title,
      artist: payload.data.artist || null,
      sourceUrl: payload.data.sourceUrl || null,
      notes: payload.data.notes || null,
      targetRole: payload.data.targetRole || null,
      bpm: payload.data.bpm ?? null,
      key: payload.data.key || null,
      moodTags: normalizeTags(payload.data.moodTags),
      arrangementTags: normalizeTags(payload.data.arrangementTags),
    },
    select: {
      id: true,
      songId: true,
      songTrackNumber: true,
      songTitle: true,
      title: true,
      artist: true,
      sourceUrl: true,
      notes: true,
      targetRole: true,
      bpm: true,
      key: true,
      moodTags: true,
      arrangementTags: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await trackProductEventSafe({
    name: "album_reference_added",
    workspaceId: workspace.id,
    userId,
    albumId: album.id,
    path: `/api/albums/${album.id}/references`,
    metadata: {
      targetRole: created.targetRole,
      songScoped: Boolean(created.songTrackNumber),
    },
  });

  return NextResponse.json(
    {
      reference: {
        ...created,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
