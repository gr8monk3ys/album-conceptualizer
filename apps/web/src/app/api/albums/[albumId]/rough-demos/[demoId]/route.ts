import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/server/auth";
import { RoughDemoFileSchema } from "@/server/album-json";
import { buildAlbumMutationData } from "@/server/album-sync";
import { trackProductEventSafe } from "@/server/analytics";
import { getPrisma } from "@/server/db";
import { buildRoughDemoCollection } from "@/server/rough-demo-review";
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

export async function PATCH(
  request: Request,
  {
    params,
  }: { params: Promise<{ albumId: string; demoId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const payload = BodySchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid rough demo payload." }, { status: 400 });
  }

  const { albumId, demoId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();
  const existing = await prisma.album.findFirst({
    where: { id: albumId, workspaceId: workspace.id },
    select: { id: true, data: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const currentDemos = listAlbumRoughDemos(existing.data);
  const current = currentDemos.find((demo) => demo.id === demoId);
  if (!current) return NextResponse.json({ error: "Demo not found." }, { status: 404 });

  const now = new Date().toISOString();
  const demo = normalizeRoughDemo({
    ...current,
    ...payload.data,
    id: current.id,
    created_at: current.created_at,
    updated_at: now,
  });
  const nextAlbum = patchAlbumRoughDemos(existing.data, (demos) =>
    demos.map((item) => (item.id === demoId ? demo : item)),
  );
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
    name: "album_demo_updated",
    workspaceId: workspace.id,
    userId,
    albumId: existing.id,
    path: `/api/albums/${existing.id}/rough-demos/${demoId}`,
    metadata: {
      sourceKind: demo.source_kind,
      targetedTrack: demo.song_track_number,
      hasLocalFile: Boolean(demo.local_file),
    },
  });

  return NextResponse.json(buildRoughDemoCollection(nextAlbum));
}

export async function DELETE(
  _request: Request,
  {
    params,
  }: { params: Promise<{ albumId: string; demoId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { albumId, demoId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();
  const existing = await prisma.album.findFirst({
    where: { id: albumId, workspaceId: workspace.id },
    select: { id: true, data: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const currentDemos = listAlbumRoughDemos(existing.data);
  const current = currentDemos.find((demo) => demo.id === demoId);
  if (!current) return NextResponse.json({ error: "Demo not found." }, { status: 404 });

  const now = new Date().toISOString();
  const nextAlbum = patchAlbumRoughDemos(existing.data, (demos) =>
    demos.filter((item) => item.id !== demoId),
  );
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
    name: "album_demo_deleted",
    workspaceId: workspace.id,
    userId,
    albumId: existing.id,
    path: `/api/albums/${existing.id}/rough-demos/${demoId}`,
    metadata: {
      sourceKind: current.source_kind,
      targetedTrack: current.song_track_number,
      hasLocalFile: Boolean(current.local_file),
    },
  });

  return NextResponse.json(buildRoughDemoCollection(nextAlbum));
}
