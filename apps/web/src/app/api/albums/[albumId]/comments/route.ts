import { NextResponse } from "next/server";
import { z } from "zod";

import { MAX_ALBUM_SONGS } from "@/server/album-json";
import { apiHandler, parseJsonBody, requireAlbum, requireWorkspace } from "@/server/api";
import { getPrisma } from "@/server/db";
import { albumItemUrl, findMentionedMembers, notifyWorkspaceMembers } from "@/server/notify";

export const runtime = "nodejs";

type Context = { params: Promise<{ albumId: string }> };

const PostBodySchema = z.object({
  sectionId: z.string().trim().min(1).max(120),
  songTrackNumber: z.number().int().min(1).max(MAX_ALBUM_SONGS),
  sectionType: z.string().trim().min(1).max(64),
  sectionOrder: z.number().int().min(0).max(99),
  body: z.string().trim().min(1).max(2000),
});

const COMMENT_SELECT = {
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
} as const;

export const GET = apiHandler(async (request: Request, { params }: Context) => {
  const { workspaceId } = await requireWorkspace();
  const url = new URL(request.url);
  const sectionId = (url.searchParams.get("sectionId") ?? "").trim();

  const { albumId } = await params;
  const album = await requireAlbum(workspaceId, albumId, { id: true });

  const comments = await getPrisma().albumSectionComment.findMany({
    where: {
      albumId: album.id,
      ...(sectionId ? { sectionId } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: COMMENT_SELECT,
  });

  return NextResponse.json({ comments });
});

export const POST = apiHandler(async (request: Request, { params }: Context) => {
  const { userId, workspaceId } = await requireWorkspace();
  const payload = await parseJsonBody(request, PostBodySchema, "Invalid payload.");
  const { albumId } = await params;
  const album = await requireAlbum(workspaceId, albumId, { id: true, title: true });
  const prisma = getPrisma();

  const created = await prisma.albumSectionComment.create({
    data: {
      albumId: album.id,
      sectionId: payload.sectionId,
      songTrackNumber: payload.songTrackNumber,
      sectionType: payload.sectionType,
      sectionOrder: payload.sectionOrder,
      authorUserId: userId,
      body: payload.body,
    },
    select: COMMENT_SELECT,
  });

  // @mentioned members hear about it first; the workspace owner otherwise.
  await notifyWorkspaceMembers(prisma, {
    workspaceId,
    albumId: album.id,
    actorUserId: userId,
    url: albumItemUrl(album.id, payload),
    body: payload.body,
    commentId: created.id,
    audiences: [
      {
        to: await findMentionedMembers(prisma, workspaceId, payload.body),
        type: "mention",
        title: `Mentioned in a comment · ${album.title}`,
      },
      { to: "owner", type: "comment", title: `New comment · ${album.title}` },
    ],
  });

  return NextResponse.json({ comment: created }, { status: 201 });
});
