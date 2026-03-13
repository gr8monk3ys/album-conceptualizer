import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/server/auth";
import { trackProductEventSafe } from "@/server/analytics";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const runtime = "nodejs";

const BodySchema = z.object({
  albumId: z.string().min(1),
  event: z.enum([
    "album_bible_viewed",
    "album_studio_viewed",
    "album_coherence_viewed",
    "album_style_bible_viewed",
  ]),
  path: z.string().min(1).max(300),
});

export async function POST(request: Request) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = BodySchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid analytics payload." }, { status: 400 });
  }

  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();
  const album = await prisma.album.findFirst({
    where: {
      id: payload.data.albumId,
      workspaceId: workspace.id,
    },
    select: { id: true },
  });

  if (!album) {
    return NextResponse.json({ error: "Album not found." }, { status: 404 });
  }

  await trackProductEventSafe({
    name: payload.data.event,
    workspaceId: workspace.id,
    userId,
    albumId: album.id,
    path: payload.data.path,
    source: "client",
  });

  return new NextResponse(null, { status: 204 });
}
