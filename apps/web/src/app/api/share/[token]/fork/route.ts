import { NextResponse } from "next/server";

import { forkIntoWorkspace } from "@/server/album-fork";
import { ApiError, apiHandler, enforceRateLimit, requireWorkspace } from "@/server/api";
import { findSharedAlbum } from "@/server/share-links";

export const runtime = "nodejs";

export const POST = apiHandler(
  async (_request: Request, { params }: { params: Promise<{ token: string }> }) => {
    const { userId, workspaceId, plan } = await requireWorkspace();
    await enforceRateLimit(
      "albums_create",
      `user:${userId}`,
      "Too many new albums in a short time. Wait a minute and try again.",
    );

    const { token } = await params;
    const shared = await findSharedAlbum(token, { id: true, data: true });
    if (!shared?.data) throw new ApiError(404, "Not found.");

    const id = await forkIntoWorkspace({
      source: shared.data,
      sourceAlbumId: shared.id,
      workspaceId,
      plan,
      userId,
      versionMessage: "Forked from share link",
      creditMetadata: { source: "share", token },
    });
    return NextResponse.json({ id }, { status: 201 });
  },
);
