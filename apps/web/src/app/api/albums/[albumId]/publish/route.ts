import { NextResponse } from "next/server";
import { z } from "zod";

import { trackProductEventSafe } from "@/server/analytics";
import { apiHandler, parseJsonBody, requireAlbum, requireWorkspace } from "@/server/api";
import { getPrisma } from "@/server/db";

export const runtime = "nodejs";

const BodySchema = z.object({
  isPublic: z.boolean(),
});

export const POST = apiHandler(
  async (request: Request, { params }: { params: Promise<{ albumId: string }> }) => {
    const { userId, workspaceId } = await requireWorkspace();
    const payload = await parseJsonBody(request, BodySchema, "Invalid payload.");
    const { albumId } = await params;
    const existing = await requireAlbum(workspaceId, albumId, { id: true });

    const now = new Date();
    const updated = await getPrisma().album.update({
      where: { id: existing.id },
      data: {
        isPublic: payload.isPublic,
        publishedAt: payload.isPublic ? now : null,
        // Status follows publishing, so a published album never reads as a draft.
        status: payload.isPublic ? "published" : "draft",
      },
      select: { isPublic: true, publishedAt: true },
    });

    if (updated.isPublic) {
      await trackProductEventSafe({
        name: "album_published",
        workspaceId,
        userId,
        albumId: existing.id,
        path: `/api/albums/${existing.id}/publish`,
      });
    }

    return NextResponse.json(updated);
  },
);
