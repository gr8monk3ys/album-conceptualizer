import Link from "next/link";

import { AlbumCard, type AlbumListItem } from "@/components/album-card";
import { listAlbums } from "@/server/albums";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs text-[var(--muted2)]">Studio</div>
          <div className="text-2xl font-semibold tracking-tight text-[var(--text)]">
            Edit songs and sections
          </div>
          <div className="mt-2 max-w-[70ch] text-sm text-[var(--muted)]">
            Pick a project to edit lyrics drafts, chord loops, and section structure. Every save
            syncs to the database so exports stay up to date.
          </div>
        </div>

        <Link
          href="/app/create"
          className="rounded-2xl bg-[linear-gradient(90deg,var(--accent2),var(--accent))] px-5 py-3 text-sm font-semibold text-black hover:brightness-110"
        >
          New project
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {items.map((album) => (
          <AlbumCard key={album.id} album={album} href={`/app/albums/${album.id}/studio`} />
        ))}
      </div>

      {items.length ? null : (
        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-6 text-sm text-[var(--muted)]">
          No projects yet. Create one, then come back here to write section-by-section.
        </div>
      )}
    </div>
  );
}
