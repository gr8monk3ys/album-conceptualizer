import { AlbumList, toAlbumListItem } from "@/components/album-card";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { albumProgressById } from "@/server/album-progress";
import { listAlbums } from "@/server/albums";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Library",
  description: "Every album in your workspace, most recently edited first.",
};

export default async function LibraryPage() {
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const listed = await listAlbums(workspace.id);
  // Each row shows how far its album has come, the way Home shows the album it continues.
  const progress = await albumProgressById(
    workspace.id,
    listed.map((album) => album.id),
  );
  const albums = listed.map((album) => ({ ...toAlbumListItem(album), progress: progress.get(album.id) }));
  const count = `${albums.length} ${albums.length === 1 ? "album" : "albums"}`;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        size="page"
        title="Library"
        catalog={albums.length ? <span className="type-figure">{count}</span> : undefined}
        description="Every album in this workspace, most recently edited first."
      />

      {albums.length ? (
        <AlbumList label="Albums" albums={albums} hrefFor={(album) => `/app/albums/${album.id}`} />
      ) : (
        <EmptyState
          title="Your library is empty"
          action={
            // Secondary: the header's "New album" is this page's primary action.
            <ButtonLink tone="secondary" href="/app/create">
              Start your first album
            </ButtonLink>
          }
        >
          An album starts as a one-paragraph concept. The guided setup turns it into a sequence
          and a narrative arc you can rewrite track by track, then export to your DAW. Creating an
          album uses {CREDIT_COSTS.albumCreate} credits.
        </EmptyState>
      )}
    </div>
  );
}
