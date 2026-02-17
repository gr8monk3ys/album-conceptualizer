import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const runtime = "nodejs";

const PostBodySchema = z.object({
  sectionType: z.string().trim().min(1).max(64),
  order: z.number().int().min(0).max(99).optional(),
  lyrics: z.string().max(5000).optional(),
  chordProgression: z.array(z.string().trim().max(20)).max(32).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ albumId: string; songId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { albumId, songId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const song = await prisma.song.findFirst({
    where: {
      id: songId,
      album: { id: albumId, workspaceId: workspace.id },
    },
    select: { id: true },
  });
  if (!song) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const sections = await prisma.section.findMany({
    where: { songId: song.id },
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
  });

  return NextResponse.json({ sections });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ albumId: string; songId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const payload = PostBodySchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { albumId, songId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const song = await prisma.song.findFirst({
    where: {
      id: songId,
      album: { id: albumId, workspaceId: workspace.id },
    },
    select: { id: true },
  });
  if (!song) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Auto-assign order if not provided: next after highest existing order for this type
  let order = payload.data.order;
  if (order === undefined) {
    const last = await prisma.section.findFirst({
      where: { songId: song.id, sectionType: payload.data.sectionType },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    order = (last?.order ?? 0) + 1;
  }

  const section = await prisma.section.create({
    data: {
      songId: song.id,
      sectionType: payload.data.sectionType,
      order,
      lyrics: payload.data.lyrics || null,
      chordProgression: payload.data.chordProgression ?? [],
    },
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
  });

  return NextResponse.json({ section }, { status: 201 });
}
