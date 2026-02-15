import Link from "next/link";

import { listAlbums } from "@/server/albums";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";

export default async function BiblesPage() {
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const albums = await listAlbums(workspace.id);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-[var(--muted2)]">Bibles</div>
          <div className="text-2xl font-semibold tracking-tight text-[var(--text)]">
            Album bibles
          </div>
          <div className="mt-2 max-w-[72ch] text-sm text-[var(--muted)]">
            A consistency dashboard for themes, motifs, characters, and narrative arcs across your
            albums.
          </div>
        </div>
        <Link
          href="/app/create"
          className="rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90"
        >
          New album
        </Link>
      </div>

      {albums.length ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {albums.map((album) => (
            <div
              key={album.id}
              className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.15)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--text)]">
                    {album.title}
                  </div>
                  <div className="mt-1 truncate text-xs text-[var(--muted2)]">
                    {album.artist ? `by ${album.artist}` : "Artist not set"} · {album.trackCount}{" "}
                    tracks
                  </div>
                </div>
                <div className="rounded-full bg-[rgba(255,255,255,0.08)] px-3 py-1 text-[10px] font-semibold text-[var(--muted2)]">
                  {album.status}
                </div>
              </div>

              {album.conceptSummary ? (
                <div className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
                  {album.conceptSummary.length > 180
                    ? `${album.conceptSummary.slice(0, 180)}…`
                    : album.conceptSummary}
                </div>
              ) : (
                <div className="mt-3 text-xs text-[var(--muted2)]">No concept summary yet.</div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[10px] text-[var(--muted2)]">
                  Updated {album.updatedAt.toLocaleString()}
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/app/albums/${album.id}/studio`}
                    className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-[10px] font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
                  >
                    Studio
                  </Link>
                  <Link
                    href={`/app/albums/${album.id}/bible`}
                    className="rounded-2xl bg-white px-3 py-2 text-[10px] font-semibold text-black hover:bg-white/90"
                  >
                    Open bible
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-6 text-sm text-[var(--muted)]">
          No albums yet. Create one to generate a bible.
        </div>
      )}
    </div>
  );
}
