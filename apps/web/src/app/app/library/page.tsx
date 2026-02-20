import { AlbumCard, type AlbumListItem } from "@/components/album-card";
import { listAlbums } from "@/server/albums";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Library",
  description: "Browse your concept album projects and recent activity.",
};

export default async function LibraryPage() {
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const albums = await listAlbums(workspace.id);

  const items: AlbumListItem[] = albums.map((album) => ({
    id: album.id,
    title: album.title,
    subtitle: `${album.primaryGenre || "Concept"} | ${album.trackCount} tracks`,
    tag: album.status === "draft" ? "draft" : undefined,
    cover: album.coverUrl ?? undefined,
  }));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="text-xs text-[var(--muted2)]">Library</div>
        <div className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          All projects
        </div>
        <div className="mt-2 max-w-[70ch] text-sm text-[var(--muted)]">
          Everything you&apos;ve saved in this workspace.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {items.map((album) => (
          <AlbumCard key={album.id} album={album} href={`/app/albums/${album.id}`} />
        ))}
      </div>
    </div>
  );
}
