import { notFound } from "next/navigation";

import { AlbumPageViewTracker } from "@/components/album-page-view-tracker";
import { AlbumStyleBibleWorkspace } from "@/components/album-style-bible-workspace";
import { getAlbum } from "@/server/albums";
import { requireUser } from "@/server/identity";
import { listAlbumReferences } from "@/server/references";
import { getAlbumStyleBible, summarizeStyleBible } from "@/server/style-bible";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Voice / Style Bible",
  description: "Define the vocal identity, sonic palette, and production rules for your album.",
};

// The album layout renders the title, catalog line, album tabs and spine above this page.
export default async function AlbumStyleBiblePage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const { albumId } = await params;
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const album = await getAlbum(workspace.id, albumId);
  if (!album) notFound();

  const references = await listAlbumReferences(workspace.id, album.id);
  const styleBible = getAlbumStyleBible(album.data);
  const summary = summarizeStyleBible(styleBible, references);

  return (
    <>
      <AlbumPageViewTracker
        albumId={album.id}
        event="album_style_bible_viewed"
        path={`/app/albums/${album.id}/style`}
      />
      <AlbumStyleBibleWorkspace
        albumId={album.id}
        initialStyleBible={styleBible}
        initialSummary={summary}
        referenceTargets={references.map((reference) => ({
          id: reference.id,
          title: reference.title,
          artist: reference.artist,
          targetRole: reference.targetRole,
          songTitle: reference.songTitle,
          songTrackNumber: reference.songTrackNumber,
        }))}
      />
    </>
  );
}
