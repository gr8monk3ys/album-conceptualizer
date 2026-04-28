import { NextResponse } from "next/server";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { buildAlbumBible } from "@/server/bible";
import { buildBiblePdfBuffer } from "@/server/bible-pdf";
import { contentDisposition } from "@/server/headers";

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
    select: { id: true, data: true },
  });
  if (!album) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const bible = buildAlbumBible(album.data);
  const { buffer, filename } = await buildBiblePdfBuffer(bible);
  // Convert to a plain ArrayBuffer (BodyInit types in this codebase reject Buffer/SharedArrayBuffer).
  const body = new Uint8Array(buffer).buffer;

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": contentDisposition(filename),
      "cache-control": "no-store",
    },
  });
}
