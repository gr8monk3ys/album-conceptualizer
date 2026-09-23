import { notFound } from "next/navigation";

import { AlbumReferencesWorkspace } from "@/components/album-references-workspace";
import { getAlbumSongOptions } from "@/server/album-songs";
import { getAlbum } from "@/server/albums";
import { requireUser } from "@/server/identity";
import { listAlbumReferences } from "@/server/references";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Reference Tracks",
  description: "Capture reference songs, roles, mood tags, and arrangement notes for an album.",
};

// The album layout renders the title, catalog line, album tabs and spine above this page.
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
    <AlbumReferencesWorkspace
      albumId={album.id}
      initialReferences={references}
      songOptions={songOptions}
    />
  );
}
