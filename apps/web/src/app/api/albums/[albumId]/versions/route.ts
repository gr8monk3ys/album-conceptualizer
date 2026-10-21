import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, apiHandler, parseJsonBody, requireAlbum, requireWorkspace } from "@/server/api";
import { getPrisma } from "@/server/db";

export const runtime = "nodejs";

type Context = { params: Promise<{ albumId: string }> };

const CreateBodySchema = z.object({
  message: z.string().trim().min(1).max(200).optional(),
});

export const GET = apiHandler(async (_request: Request, { params }: Context) => {
  const { workspaceId } = await requireWorkspace();
  const { albumId } = await params;

  const versions = await getPrisma().albumVersion.findMany({
    where: { albumId, album: { workspaceId } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      message: true,
      createdAt: true,
      createdBy: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json({ versions });
});

export const POST = apiHandler(async (request: Request, { params }: Context) => {
  const { userId, workspaceId } = await requireWorkspace();
  const payload = await parseJsonBody(request, CreateBodySchema);
  const { albumId } = await params;
  const album = await requireAlbum(workspaceId, albumId, { id: true, data: true });
  if (!album.data) throw new ApiError(400, "Album has no saved data snapshot.");

  const created = await getPrisma().albumVersion.create({
    data: {
      albumId: album.id,
      createdByUserId: userId,
      message: payload.message ?? null,
      data: album.data,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
});
