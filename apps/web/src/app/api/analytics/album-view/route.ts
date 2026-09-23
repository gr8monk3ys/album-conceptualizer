import { NextResponse } from "next/server";
import { z } from "zod";

import { trackProductEventSafe } from "@/server/analytics";
import { apiHandler, parseJsonBody, requireAlbum, requireWorkspace } from "@/server/api";

export const runtime = "nodejs";

const BodySchema = z.object({
  albumId: z.string().min(1),
  event: z.enum([
    "album_bible_viewed",
    "album_studio_viewed",
    "album_coherence_viewed",
    "album_style_bible_viewed",
    "album_rough_demos_viewed",
  ]),
  path: z.string().min(1).max(300),
});

export const POST = apiHandler(async (request: Request) => {
  const { userId, workspaceId } = await requireWorkspace();
  const payload = await parseJsonBody(request, BodySchema, "Invalid analytics payload.");
  const album = await requireAlbum(workspaceId, payload.albumId, { id: true });

  await trackProductEventSafe({
    name: payload.event,
    workspaceId,
    userId,
    albumId: album.id,
    path: payload.path,
    source: "client",
  });

  return new NextResponse(null, { status: 204 });
});
