import Link from "next/link";
import { notFound } from "next/navigation";

import { AlbumPageViewTracker } from "@/components/album-page-view-tracker";
import { AlbumRoughDemoWorkspace } from "@/components/album-rough-demo-workspace";
import { getAlbum } from "@/server/albums";
import { getAlbumSongOptions } from "@/server/album-songs";
import { requireUser } from "@/server/identity";
import { listAlbumRoughDemos } from "@/server/rough-demos";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Rough Demos",
  description: "Capture rough demos, voice memos, and riff sketches before they disappear.",
};

export default async function AlbumRoughDemosPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const { albumId } = await params;
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const album = await getAlbum(workspace.id, albumId);
  if (!album) notFound();

  const demos = listAlbumRoughDemos(album.data);
  const songOptions = getAlbumSongOptions(album.data);

  return (
    <div className="flex flex-col gap-5">
      <AlbumPageViewTracker
        albumId={album.id}
        event="album_rough_demos_viewed"
        path={`/app/albums/${album.id}/demos`}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-[var(--muted2)]">Rough demos</div>
          <div className="text-2xl font-semibold tracking-tight text-[var(--text)]">
            {album.title}
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            {album.artist ? `by ${album.artist}` : "Artist not set"}
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
            href={`/app/albums/${album.id}/style`}
            className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
          >
            Style
          </Link>
          <Link
            href={`/app/albums/${album.id}/export`}
            className="rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90"
          >
            Export
          </Link>
        </div>
      </div>

      <AlbumRoughDemoWorkspace
        albumId={album.id}
        initialDemos={demos}
        songOptions={songOptions}
      />
    </div>
  );
}
