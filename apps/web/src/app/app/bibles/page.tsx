import { AlbumList, toAlbumListItem } from "@/components/album-card";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { listAlbums } from "@/server/albums";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Album Bibles",
  description: "Open the Album Bible for any album: themes, motifs, characters and style.",
};

export default async function BiblesPage() {
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const albums = (await listAlbums(workspace.id)).map(toAlbumListItem);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Album Bibles"
        description="Each album's reference for consistency: its concept, themes, motifs, characters and style, and which tracks carry them."
      />

      {albums.length ? (
        <AlbumList
          label="Albums"
          albums={albums}
          hint="Open Bible"
          hrefFor={(album) => `/app/albums/${album.id}/bible`}
        />
      ) : (
        <EmptyState
          title="No Album Bibles yet"
          action={
            <ButtonLink tone="primary" href="/app/create">
              Start your first album
            </ButtonLink>
          }
        >
          An Album Bible is built from the album itself. Start an album and give its songs themes
          and motifs; the Bible then shows which tracks carry each one.
        </EmptyState>
      )}
    </div>
  );
}
