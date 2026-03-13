import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/server/auth";
import { RoughDemoFileSchema } from "@/server/album-json";
import { buildAlbumMutationData } from "@/server/album-sync";
import { trackProductEventSafe } from "@/server/analytics";
import { getPrisma } from "@/server/db";
import {
  listAlbumRoughDemos,
  normalizeRoughDemo,
  patchAlbumRoughDemos,
} from "@/server/rough-demos";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const runtime = "nodejs";

const BodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  source_kind: z.enum([
    "voice-memo",
    "phone-demo",
    "rehearsal",
    "riff-sketch",
    "acoustic-pass",
    "hook-sketch",
  ]),
  song_track_number: z.number().int().positive().max(512).optional().nullable(),
  external_url: z.string().trim().url().max(500).optional().nullable(),
  capture_notes: z.string().trim().max(1500).optional().nullable(),
  sonic_traits: z.array(z.string().trim().min(1).max(80)).max(12).optional().default([]),
  lyrical_fragments: z.array(z.string().trim().min(1).max(120)).max(12).optional().default([]),
  next_actions: z.array(z.string().trim().min(1).max(180)).max(12).optional().default([]),
  local_file: RoughDemoFileSchema.optional().nullable(),
});

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

  return NextResponse.json({ demos: listAlbumRoughDemos(album.data) });
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
    return NextResponse.json({ error: "Invalid rough demo payload." }, { status: 400 });
  }

  const { albumId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();
  const existing = await prisma.album.findFirst({
    where: { id: albumId, workspaceId: workspace.id },
    select: { id: true, data: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const now = new Date().toISOString();
  const demo = normalizeRoughDemo({
    ...payload.data,
    created_at: now,
    updated_at: now,
  });
  const nextAlbum = patchAlbumRoughDemos(existing.data, (current) => [demo, ...current]);
  if (!nextAlbum) {
    return NextResponse.json({ error: "Stored album data is invalid." }, { status: 409 });
  }

  const mutation = buildAlbumMutationData({
    ...nextAlbum,
    updated_at: now,
  });

  await prisma.$transaction(async (tx) => {
    await tx.song.deleteMany({ where: { albumId: existing.id } });
    await tx.album.update({
      where: { id: existing.id },
      data: mutation,
      select: { id: true },
    });
  });

  await trackProductEventSafe({
    name: "album_demo_added",
    workspaceId: workspace.id,
    userId,
    albumId: existing.id,
    path: `/api/albums/${existing.id}/rough-demos`,
    metadata: {
      sourceKind: demo.source_kind,
      targetedTrack: demo.song_track_number,
      hasLocalFile: Boolean(demo.local_file),
    },
  });

  return NextResponse.json({ demo });
}
