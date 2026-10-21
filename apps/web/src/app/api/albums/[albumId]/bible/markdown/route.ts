import { apiHandler, requireAlbum, requireWorkspace } from "@/server/api";
import { buildAlbumBible } from "@/server/bible";
import { buildBibleMarkdown } from "@/server/bible-markdown";
import { contentDisposition, safeFilename } from "@/server/headers";

export const runtime = "nodejs";

export const GET = apiHandler(
  async (_request: Request, { params }: { params: Promise<{ albumId: string }> }) => {
    const { workspaceId } = await requireWorkspace();
    const { albumId } = await params;
    const album = await requireAlbum(workspaceId, albumId, { title: true, data: true });

    const bible = buildAlbumBible(album.data);
    const markdown = buildBibleMarkdown(bible);

    const filename = safeFilename(`${album.title}_album_bible`, "album_bible") + ".md";
    return new Response(markdown, {
      status: 200,
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": contentDisposition(filename),
        "cache-control": "no-store",
      },
    });
  },
);
