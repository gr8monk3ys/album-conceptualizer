import Link from "next/link";
import { getAlbumSongOptions } from "@/server/album-songs";
import { notFound } from "next/navigation";

import { DiscoverAlbumActions } from "@/components/discover-album-actions";
import { analyzeAlbumCoherence } from "@/server/coherence";
import { getPrisma } from "@/server/db";
import { requireUser } from "@/server/identity";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Discover Album",
  description: "Explore a published album and remix it into your workspace.",
};

export default async function DiscoverAlbumPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const { albumId } = await params;
  const { userId } = await requireUser();

  const prisma = getPrisma();
  const album = await prisma.album.findFirst({
    where: { id: albumId, isPublic: true },
    select: {
      id: true,
      title: true,
      artist: true,
      conceptSummary: true,
      primaryGenre: true,
      trackCount: true,
      data: true,
      publishedAt: true,
      _count: { select: { likes: true } },
      likes: { where: { userId }, select: { id: true } },
    },
  });
  if (!album) notFound();

  const songs = getAlbumSongOptions(album.data);
  const coherence = analyzeAlbumCoherence(album.data);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs text-ink-3">Discover</div>
          <div className="text-2xl font-semibold tracking-tight text-ink">
            {album.title}
          </div>
          <div className="mt-1 text-sm text-ink-2">
            {album.artist ? `by ${album.artist}` : "Artist not set"} ·{" "}
            {album.primaryGenre || "Concept"} · {album.trackCount} tracks
          </div>
          {album.publishedAt ? (
            <div className="mt-2 text-xs text-ink-3">
              Published {album.publishedAt.toLocaleString()}
            </div>
          ) : null}
          {album.conceptSummary ? (
            <div className="mt-3 max-w-[80ch] text-sm leading-relaxed text-ink-2">
              {album.conceptSummary}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/app/discover"
              className="rounded-2xl border border-line bg-raised px-4 py-2 text-xs font-semibold text-ink hover:bg-hover"
            >
              Back
            </Link>
            <DiscoverAlbumActions
              albumId={album.id}
              initialLiked={Boolean(album.likes.length)}
              initialLikes={album._count.likes}
            />
          </div>
          <div className="text-xs text-ink-3">
            Forking creates a private copy in your workspace.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border border-line bg-raised p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-ink-3">Tracklist</div>
              <div className="text-sm font-semibold text-ink">Songs</div>
            </div>
            <div className="text-xs text-ink-2">{songs.length} items</div>
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-line">
            <div className="max-h-[520px] overflow-auto">
              {songs.length ? (
                <ul className="divide-y divide-line">
                  {songs.map((song) => (
                    <li key={`${song.trackNumber}-${song.title}`} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 text-xs tabular-nums text-ink-3">
                          {String(song.trackNumber).padStart(2, "0")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-ink">
                            {song.title}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-10 text-center text-sm text-ink-2">
                  No songs found in this project.
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-line bg-raised p-4">
            <div className="text-xs text-ink-3">Coherence</div>
            <div className="mt-1 text-2xl font-semibold text-ink">
              {coherence.score}/100
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {coherence.breakdown.slice(0, 3).map((item) => (
                <div
                  key={item.key}
                  className="rounded-full border border-line bg-sunken px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-3"
                >
                  {item.label} {item.score}
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-ink-3">
              {coherence.nextActions[0]?.title ?? coherence.issues[0]?.title ?? "No issues detected."}
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-raised p-4">
            <div className="text-xs text-ink-3">Why publish?</div>
            <div className="mt-2 space-y-2 text-sm text-ink-2">
              <div>1. Get feedback signals (likes).</div>
              <div>2. Let others fork remixes safely.</div>
              <div>3. Build a catalog of reusable ideas.</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
