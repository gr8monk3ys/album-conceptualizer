import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const runtime = "nodejs";

const PostBodySchema = z.object({
  sectionId: z.string().trim().min(1).max(120),
  songTrackNumber: z.number().int().min(1).max(99),
  sectionType: z.string().trim().min(1).max(64),
  sectionOrder: z.number().int().min(0).max(99),
  body: z.string().trim().min(1).max(2000),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const url = new URL(request.url);
  const sectionId = (url.searchParams.get("sectionId") ?? "").trim();

  const { albumId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();

  const album = await prisma.album.findFirst({
    where: { id: albumId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!album) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const comments = await prisma.albumSectionComment.findMany({
    where: {
      albumId: album.id,
      ...(sectionId ? { sectionId } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: {
      id: true,
      sectionId: true,
      songTrackNumber: true,
      sectionType: true,
      sectionOrder: true,
      body: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      resolvedAt: true,
      author: { select: { id: true, name: true, image: true } },
      resolvedBy: { select: { id: true, name: true, image: true } },
    },
  });

  return NextResponse.json({ comments });
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

  const created = await prisma.albumSectionComment.create({
    data: {
      albumId: album.id,
      sectionId: payload.data.sectionId,
      songTrackNumber: payload.data.songTrackNumber,
      sectionType: payload.data.sectionType,
      sectionOrder: payload.data.sectionOrder,
      authorUserId: userId,
      body: payload.data.body,
    },
    select: {
      id: true,
      sectionId: true,
      songTrackNumber: true,
      sectionType: true,
      sectionOrder: true,
      body: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      resolvedAt: true,
      author: { select: { id: true, name: true, image: true } },
      resolvedBy: { select: { id: true, name: true, image: true } },
    },
  });

  return NextResponse.json({ comment: created }, { status: 201 });
}

