import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/server/auth";
import { trackProductEventSafe } from "@/server/analytics";
import { getPrisma } from "@/server/db";
import {
  buildHandoffPackMarkdown,
  getHandoffPackFilename,
  type HandoffTarget,
} from "@/server/handoff-pack";
import { checkRateLimit, getRateLimitFailure } from "@/server/rate-limit";
import { listAlbumReferences } from "@/server/references";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { contentDisposition } from "@/server/headers";

export const runtime = "nodejs";

const TargetSchema = z.enum(["suno", "udio", "daw"]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const rate = await checkRateLimit("export_zip", `user:${userId}`);
  const rateFailure = getRateLimitFailure(
    rate,
    "Too many handoff downloads. Please wait a bit and try again.",
  );
  if (rateFailure) {
    return NextResponse.json(rateFailure.body, {
      status: rateFailure.status,
      headers: rateFailure.headers,
    });
  }

  const { albumId } = await params;
  const workspace = await getActiveWorkspaceForUser(userId);
  const prisma = getPrisma();
  const album = await prisma.album.findFirst({
    where: { id: albumId, workspaceId: workspace.id },
    select: { id: true, title: true, data: true },
  });
  if (!album) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const url = new URL(request.url);
  const targetParsed = TargetSchema.safeParse(url.searchParams.get("target") ?? "suno");
  if (!targetParsed.success) {
    return NextResponse.json({ error: "Invalid handoff target." }, { status: 400 });
  }

  const references = await listAlbumReferences(workspace.id, album.id);
  const target = targetParsed.data as HandoffTarget;
  const markdown = buildHandoffPackMarkdown({
    albumData: album.data,
    references,
    target,
  });
  const filename = getHandoffPackFilename(album.title, target);

  await trackProductEventSafe({
    name: "album_handoff_downloaded",
    workspaceId: workspace.id,
    userId,
    albumId: album.id,
    path: `/api/albums/${album.id}/handoff`,
    metadata: {
      target,
      referenceCount: references.length,
    },
  });

  return new Response(markdown, {
    status: 200,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": contentDisposition(filename),
      "cache-control": "no-store",
    },
  });
}
