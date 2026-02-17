import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const runtime = "nodejs";

const PatchBodySchema = z
  .object({
    sectionType: z.string().trim().min(1).max(64).optional(),
    order: z.number().int().min(0).max(99).optional(),
    lyrics: z.string().max(5000).nullable().optional(),
    chordProgression: z.array(z.string().trim().max(20)).max(32).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, "No changes provided.");

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ albumId: string; songId: string; sectionId: string }>;
  },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const payload = PatchBodySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { albumId, songId, sectionId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const existing = await prisma.section.findFirst({
    where: {
      id: sectionId,
      songId,
      song: { album: { id: albumId, workspaceId: workspace.id } },
    },
    select: { id: true },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found." }, { status: 404 });

  const section = await prisma.section.update({
    where: { id: existing.id },
    data: {
      sectionType: payload.data.sectionType,
      order: payload.data.order,
      lyrics:
        payload.data.lyrics === undefined ? undefined : payload.data.lyrics,
      chordProgression:
        payload.data.chordProgression === undefined
          ? undefined
          : payload.data.chordProgression,
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

  return NextResponse.json({ section });
}

export async function DELETE(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ albumId: string; songId: string; sectionId: string }>;
  },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { albumId, songId, sectionId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const existing = await prisma.section.findFirst({
    where: {
      id: sectionId,
      songId,
      song: { album: { id: albumId, workspaceId: workspace.id } },
    },
    select: { id: true },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found." }, { status: 404 });

  await prisma.section.delete({ where: { id: existing.id } });

  return NextResponse.json({ ok: true });
}
