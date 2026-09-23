import { notFound } from "next/navigation";

import { AlbumReferencesWorkspace } from "@/components/album-references-workspace";
import { SoundNav } from "@/components/sound-nav";
import { getAlbumSongOptions } from "@/server/album-songs";
import { getAlbum } from "@/server/albums";
import { requireUser } from "@/server/identity";
import { listAlbumReferences } from "@/server/references";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Reference tracks",
  description: "Capture reference songs, roles, mood tags, and arrangement notes for an album.",
};

// The album layout renders the title, catalog line, album tabs and spine above this page;
// the Sound sub-navigation comes first in the page itself.
export default async function AlbumReferencesPage({
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
  const songOptions = getAlbumSongOptions(album.data);

  return (
    <div className="flex flex-col gap-6">
      <SoundNav albumId={album.id} current="references" />
      <AlbumReferencesWorkspace
        albumId={album.id}
        initialReferences={references}
        songOptions={songOptions}
      />
    </div>
  );
}
