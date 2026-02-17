import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const runtime = "nodejs";

const PatchBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    trackNumber: z.number().int().min(1).max(99).optional(),
    key: z.string().trim().max(10).nullable().optional(),
    tempo: z.number().int().min(20).max(300).nullable().optional(),
    narrativeSummary: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, "No changes provided.");

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ albumId: string; songId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const payload = PatchBodySchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { albumId, songId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const existing = await prisma.song.findFirst({
    where: {
      id: songId,
      album: { id: albumId, workspaceId: workspace.id },
    },
    select: { id: true, albumId: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const song = await prisma.song.update({
    where: { id: existing.id },
    data: {
      title: payload.data.title,
      key: payload.data.key === undefined ? undefined : payload.data.key,
      tempo: payload.data.tempo === undefined ? undefined : payload.data.tempo,
      trackNumber: payload.data.trackNumber,
      narrativeSummary:
        payload.data.narrativeSummary === undefined
          ? undefined
          : payload.data.narrativeSummary,
    },
    select: {
      id: true,
      albumId: true,
      trackNumber: true,
      title: true,
      key: true,
      tempo: true,
      narrativeSummary: true,
      createdAt: true,
      updatedAt: true,
      sections: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          songId: true,
          sectionType: true,
          order: true,
          lyrics: true,
          chordProgression: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  return NextResponse.json({ song });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ albumId: string; songId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { albumId, songId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const existing = await prisma.song.findFirst({
    where: {
      id: songId,
      album: { id: albumId, workspaceId: workspace.id },
    },
    select: { id: true, albumId: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await prisma.song.delete({ where: { id: existing.id } });

  // Update album track count
  const trackCount = await prisma.song.count({ where: { albumId: existing.albumId } });
  await prisma.album.update({
    where: { id: existing.albumId },
    data: { trackCount },
    select: { id: true },
  });

  return NextResponse.json({ ok: true });
}
