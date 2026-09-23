import { notFound } from "next/navigation";

import { AlbumPageViewTracker } from "@/components/album-page-view-tracker";
import { AlbumRoughDemoWorkspace } from "@/components/album-rough-demo-workspace";
import { getAlbum } from "@/server/albums";
import { getAlbumSongOptions } from "@/server/album-songs";
import { requireUser } from "@/server/identity";
import { buildRoughDemoCollection } from "@/server/rough-demo-review";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Rough Demos",
  description: "Capture rough demos, voice memos, and riff sketches before they disappear.",
};

// The album layout renders the title, catalog line, album tabs and spine above this page.
export default async function AlbumRoughDemosPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const { albumId } = await params;
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const album = await getAlbum(workspace.id, albumId);
  if (!album) notFound();

  const { demos, reviews } = buildRoughDemoCollection(album.data);
  const songOptions = getAlbumSongOptions(album.data);

  return (
    <>
      <AlbumPageViewTracker
        albumId={album.id}
        event="album_rough_demos_viewed"
        path={`/app/albums/${album.id}/demos`}
      />
      <AlbumRoughDemoWorkspace
        albumId={album.id}
        initialDemos={demos}
        initialReviews={reviews}
        songOptions={songOptions}
      />
    </>
  );
}
