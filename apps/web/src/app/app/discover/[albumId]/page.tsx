import Link from "next/link";
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

function getSongsFromAlbumData(data: unknown): Array<{ track_number: number; title: string }> {
  if (!data || typeof data !== "object") return [];
  const songs = (data as { songs?: unknown }).songs;
  if (!Array.isArray(songs)) return [];

  return songs
    .map((song) => {
      if (!song || typeof song !== "object") return null;
      const track_number = (song as { track_number?: unknown }).track_number;
      const title = (song as { title?: unknown }).title;
      if (typeof track_number !== "number" || typeof title !== "string") return null;
      return { track_number, title };
    })
    .filter((song): song is { track_number: number; title: string } => Boolean(song))
    .sort((a, b) => a.track_number - b.track_number);
}

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

  const songs = getSongsFromAlbumData(album.data);
  const coherence = analyzeAlbumCoherence(album.data);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs text-[var(--muted2)]">Discover</div>
          <div className="text-2xl font-semibold tracking-tight text-[var(--text)]">
            {album.title}
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            {album.artist ? `by ${album.artist}` : "Artist not set"} ·{" "}
            {album.primaryGenre || "Concept"} · {album.trackCount} tracks
          </div>
          {album.publishedAt ? (
            <div className="mt-2 text-xs text-[var(--muted2)]">
              Published {album.publishedAt.toLocaleString()}
            </div>
          ) : null}
          {album.conceptSummary ? (
            <div className="mt-3 max-w-[80ch] text-sm leading-relaxed text-[var(--muted)]">
              {album.conceptSummary}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/app/discover"
              className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
            >
              Back
            </Link>
            <DiscoverAlbumActions
              albumId={album.id}
              initialLiked={Boolean(album.likes.length)}
              initialLikes={album._count.likes}
            />
          </div>
          <div className="text-xs text-[var(--muted2)]">
            Forking creates a private copy in your workspace.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-[var(--muted2)]">Tracklist</div>
              <div className="text-sm font-semibold text-[var(--text)]">Songs</div>
            </div>
            <div className="text-xs text-[var(--muted)]">{songs.length} items</div>
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)]">
            <div className="max-h-[520px] overflow-auto">
              {songs.length ? (
                <ul className="divide-y divide-[rgba(255,255,255,0.06)]">
                  {songs.map((song) => (
                    <li key={`${song.track_number}-${song.title}`} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 text-xs tabular-nums text-[var(--muted2)]">
                          {String(song.track_number).padStart(2, "0")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-[var(--text)]">
                            {song.title}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-10 text-center text-sm text-[var(--muted)]">
                  No songs found in this project.
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="text-xs text-[var(--muted2)]">Coherence</div>
            <div className="mt-1 text-2xl font-semibold text-[var(--text)]">
              {coherence.score}/100
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {coherence.breakdown.slice(0, 3).map((item) => (
                <div
                  key={item.key}
                  className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted2)]"
                >
                  {item.label} {item.score}
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-[var(--muted2)]">
              {coherence.nextActions[0]?.title ?? coherence.issues[0]?.title ?? "No issues detected."}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="text-xs text-[var(--muted2)]">Why publish?</div>
            <div className="mt-2 space-y-2 text-sm text-[var(--muted)]">
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
