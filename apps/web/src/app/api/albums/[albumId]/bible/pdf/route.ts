import { apiHandler, requireAlbum, requireWorkspace } from "@/server/api";
import { buildAlbumBible } from "@/server/bible";
import { buildBiblePdfBuffer } from "@/server/bible-pdf";
import { contentDisposition } from "@/server/headers";

export const runtime = "nodejs";

export const GET = apiHandler(
  async (_request: Request, { params }: { params: Promise<{ albumId: string }> }) => {
    const { workspaceId } = await requireWorkspace();
    const { albumId } = await params;
    const album = await requireAlbum(workspaceId, albumId, { data: true });

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
  },
);
