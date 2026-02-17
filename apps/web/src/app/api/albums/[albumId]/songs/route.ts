import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const runtime = "nodejs";

const PostBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  trackNumber: z.number().int().min(1).max(99),
  key: z.string().trim().max(10).optional(),
  tempo: z.number().int().min(20).max(300).optional(),
  narrativeSummary: z.string().trim().max(2000).optional(),
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
    select: { id: true },
  });
  if (!album) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const songs = await prisma.song.findMany({
    where: { albumId: album.id },
    orderBy: { trackNumber: "asc" },
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

  return NextResponse.json({ songs });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const payload = PostBodySchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { albumId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const album = await prisma.album.findFirst({
    where: { id: albumId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!album) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Check for duplicate track number
  const existing = await prisma.song.findFirst({
    where: { albumId: album.id, trackNumber: payload.data.trackNumber },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "Track number already exists." }, { status: 409 });
  }

  const song = await prisma.song.create({
    data: {
      albumId: album.id,
      title: payload.data.title,
      trackNumber: payload.data.trackNumber,
      key: payload.data.key || null,
      tempo: payload.data.tempo ?? null,
      narrativeSummary: payload.data.narrativeSummary || null,
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

  // Update album track count
  const trackCount = await prisma.song.count({ where: { albumId: album.id } });
  await prisma.album.update({
    where: { id: album.id },
    data: { trackCount },
    select: { id: true },
  });

  return NextResponse.json({ song }, { status: 201 });
}
