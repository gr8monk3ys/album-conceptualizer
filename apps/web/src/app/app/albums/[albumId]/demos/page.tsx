import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AlbumPageViewTracker } from "@/components/album-page-view-tracker";
import { AlbumRoughDemoWorkspace } from "@/components/album-rough-demo-workspace";
import { SoundNav } from "@/components/sound-nav";
import { getAlbum } from "@/server/albums";
import { getAlbumSongOptions } from "@/server/album-songs";
import { requireUser } from "@/server/identity";
import { buildRoughDemoCollection } from "@/server/rough-demo-review";
import { albumPageTitle, workspaceAlbumTitle } from "@/server/page-titles";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
/** "Demos · <album title>" in the browser tab and history. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ albumId: string }>;
}): Promise<Metadata> {
  const { albumId } = await params;
  const albumTitle = await workspaceAlbumTitle(albumId);
  if (!albumTitle) return { title: "Page not found" };
  return {
    title: albumPageTitle("Demos", albumTitle),
    description: "Rough demos for this album: voice memos, riff sketches and rehearsal takes, by track.",
  };
}

// The album layout renders the title, catalog line, album tabs and spine above this page;
// the Sound sub-navigation comes first in the page itself.
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
    <div className="flex flex-col gap-6">
      <SoundNav albumId={album.id} current="demos" />
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
    </div>
  );
}
