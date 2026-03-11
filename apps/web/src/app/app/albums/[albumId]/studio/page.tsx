import Link from "next/link";
import { notFound } from "next/navigation";

import { AlbumPageViewTracker } from "@/components/album-page-view-tracker";
import { AlbumStudio } from "@/components/album-studio";
import { getAlbum } from "@/server/albums";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Album Studio",
  description: "Edit songs, lyrics, chords, and section-level details for your album.",
};

export default async function AlbumStudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ albumId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { albumId } = await params;
  const query = await searchParams;

  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const album = await getAlbum(workspace.id, albumId);
  if (!album) notFound();

  return (
    <div className="flex flex-col gap-4">
      <AlbumPageViewTracker
        albumId={album.id}
        event="album_studio_viewed"
        path={`/app/albums/${album.id}/studio`}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs text-[var(--muted2)]">Studio</div>
          <div className="text-xl font-semibold tracking-tight text-[var(--text)]">
            {album.title}
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            Edit lyrics drafts, chord loops, and structure per section.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/app/albums/${album.id}`}
            className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
          >
            Back
          </Link>
          <Link
            href={`/app/albums/${album.id}/export`}
            className="rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90"
          >
            Export
          </Link>
        </div>
      </div>

      <AlbumStudio
        albumId={album.id}
        initialAlbum={album.data}
        initialSelection={{
          song: typeof query.song === "string" ? query.song : undefined,
          section: typeof query.section === "string" ? query.section : undefined,
          sid: typeof query.sid === "string" ? query.sid : undefined,
          q: typeof query.q === "string" ? query.q : undefined,
        }}
      />
    </div>
  );
}
