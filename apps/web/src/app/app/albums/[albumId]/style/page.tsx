import Link from "next/link";
import { notFound } from "next/navigation";

import { AlbumPageViewTracker } from "@/components/album-page-view-tracker";
import { AlbumStyleBibleWorkspace } from "@/components/album-style-bible-workspace";
import { getAlbum } from "@/server/albums";
import { requireUser } from "@/server/identity";
import { listAlbumReferences } from "@/server/references";
import { getAlbumStyleBible, summarizeStyleBible } from "@/server/style-bible";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Voice / Style Bible",
  description: "Define the vocal identity, sonic palette, and production rules for your album.",
};

export default async function AlbumStyleBiblePage({
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
  const styleBible = getAlbumStyleBible(album.data);
  const summary = summarizeStyleBible(styleBible, references);

  return (
    <div className="flex flex-col gap-5">
      <AlbumPageViewTracker
        albumId={album.id}
        event="album_style_bible_viewed"
        path={`/app/albums/${album.id}/style`}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-[var(--muted2)]">Voice / Style Bible</div>
          <div className="text-2xl font-semibold tracking-tight text-[var(--text)]">
            {album.title}
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            {album.artist ? `by ${album.artist}` : "Artist not set"}
            {album.primaryGenre ? ` · ${album.primaryGenre}` : ""}
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
            href={`/app/albums/${album.id}/bible`}
            className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
          >
            Bible
          </Link>
          <Link
            href={`/app/albums/${album.id}/references`}
            className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
          >
            References
          </Link>
          <Link
            href={`/app/albums/${album.id}/studio`}
            className="rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90"
          >
            Studio
          </Link>
        </div>
      </div>

      <AlbumStyleBibleWorkspace
        albumId={album.id}
        initialStyleBible={styleBible}
        initialSummary={summary}
        referenceTargets={references.map((reference) => ({
          id: reference.id,
          title: reference.title,
          artist: reference.artist,
          targetRole: reference.targetRole,
          songTitle: reference.songTitle,
          songTrackNumber: reference.songTrackNumber,
        }))}
      />
    </div>
  );
}
