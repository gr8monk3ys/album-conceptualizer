import { AlbumList, toAlbumListItem } from "@/components/album-card";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { listAlbums } from "@/server/albums";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Studio",
  description: "Choose an album to write lyrics, chords and structure section by section.",
};

export default async function StudioPage() {
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const albums = (await listAlbums(workspace.id)).map(toAlbumListItem);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Studio"
        description="Choose an album to write lyrics, chords and song structure, section by section."
      />

      {albums.length ? (
        <AlbumList
          label="Albums"
          albums={albums}
          hint="Open Studio"
          hrefFor={(album) => `/app/albums/${album.id}/studio`}
        />
      ) : (
        <EmptyState
          title="Nothing to write yet"
          action={
            <ButtonLink tone="primary" href="/app/create">
              Start your first album
            </ButtonLink>
          }
        >
          The Studio is where each song gets its sections, lyrics and chord loops. Start an album
          first; its sequence shows up here, ready to write.
        </EmptyState>
      )}
    </div>
  );
}
