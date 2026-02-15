import { NextResponse } from "next/server";

import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { buildAlbumBible } from "@/server/bible";
import { buildBibleMarkdown } from "@/server/bible-markdown";

export const runtime = "nodejs";

function sanitizeFilename(value: string) {
  return value.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "album_bible";
}

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
    select: { id: true, title: true, data: true },
  });
  if (!album) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const bible = buildAlbumBible(album.data);
  const markdown = buildBibleMarkdown(bible);

  const filename = sanitizeFilename(`${album.title}_album_bible`) + ".md";
  return new Response(markdown, {
    status: 200,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename=\"${filename}\"`,
      "cache-control": "no-store",
    },
  });
}

