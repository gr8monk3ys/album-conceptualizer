import { NextResponse } from "next/server";

import { forkIntoWorkspace } from "@/server/album-fork";
import { ApiError, apiHandler, enforceRateLimit, requireWorkspace } from "@/server/api";
import { getPrisma } from "@/server/db";

export const runtime = "nodejs";

export const POST = apiHandler(
  async (_request: Request, { params }: { params: Promise<{ albumId: string }> }) => {
    const { userId, workspaceId, plan } = await requireWorkspace();
    await enforceRateLimit(
      "albums_create",
      `user:${userId}`,
      "Too many new albums in a short time. Wait a minute and try again.",
    );

    const { albumId } = await params;
    const source = await getPrisma().album.findFirst({
      where: { id: albumId, isPublic: true },
      select: { id: true, data: true },
    });
    if (!source?.data) throw new ApiError(404, "Not found.");

    const id = await forkIntoWorkspace({
      source: source.data,
      workspaceId,
      plan,
      userId,
      versionMessage: "Forked from Discover",
      creditMetadata: { source: "discover", albumId: source.id },
    });
    return NextResponse.json({ id }, { status: 201 });
  },
);
