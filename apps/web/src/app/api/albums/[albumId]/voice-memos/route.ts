import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { rejectOversizedBody, VOICE_MEMO_MAX_BODY_SIZE } from "@/server/validate-body-size";

// Requires BLOB_READ_WRITE_TOKEN environment variable to be set.
// On Vercel this is automatically injected when a Blob store is linked to the project.

export const runtime = "nodejs";

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

  const memos = await prisma.voiceMemo.findMany({
    where: { albumId: album.id },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { id: true, name: true, image: true } } },
  });

  return NextResponse.json(memos);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  // Reject oversized uploads early (10 MB limit for voice memos).
  const tooLarge = rejectOversizedBody(request, VOICE_MEMO_MAX_BODY_SIZE);
  if (tooLarge) return tooLarge;

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

  const formData = await request.formData();
  const file = formData.get("audio") as File | null;
  const songId = formData.get("songId") as string | null;
  const sectionId = formData.get("sectionId") as string | null;
  const durationMs = parseInt(formData.get("durationMs") as string, 10);
  const title = formData.get("title") as string | null;

  if (!file) {
    return NextResponse.json({ error: "audio file is required" }, { status: 400 });
  }

  if (isNaN(durationMs) || durationMs <= 0) {
    return NextResponse.json({ error: "valid durationMs is required" }, { status: 400 });
  }

  const ext = file.name?.split(".").pop() ?? "m4a";
  const pathname = `voice-memos/${album.id}/${Date.now()}.${ext}`;

  const blob = await put(pathname, file, { access: "public" });

  const memo = await prisma.voiceMemo.create({
    data: {
      albumId: album.id,
      songId: songId || undefined,
      sectionId: sectionId || undefined,
      authorUserId: userId,
      audioUrl: blob.url,
      durationMs,
      title: title || undefined,
    },
    include: { author: { select: { id: true, name: true, image: true } } },
  });

  return NextResponse.json(memo, { status: 201 });
}
