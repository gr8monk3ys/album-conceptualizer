import Link from "next/link";
import { notFound } from "next/navigation";

import { ForkShareButton } from "@/components/fork-share-button";
import { getAuthSession } from "@/server/auth";
import { getPrisma } from "@/server/db";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Shared Album",
  description: "Review a shared album and fork it into your workspace.",
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

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const prisma = getPrisma();
  const session = await getAuthSession();

  const share = await prisma.albumShareLink.findUnique({
    where: { token },
    select: {
      revokedAt: true,
      expiresAt: true,
      album: {
        select: {
          id: true,
          title: true,
          artist: true,
          conceptSummary: true,
          data: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!share?.album) notFound();
  if (share.revokedAt) notFound();
  const now = new Date();
  if (share.expiresAt && share.expiresAt.getTime() < now.getTime()) notFound();

  const songs = getSongsFromAlbumData(share.album.data);
  const callbackUrl = `/share/${token}`;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_20%_20%,rgba(109,94,252,0.22),transparent_55%),radial-gradient(circle_at_80%_10%,rgba(255,62,165,0.20),transparent_45%),radial-gradient(circle_at_40%_90%,rgba(50,213,131,0.10),transparent_55%),var(--bg)] px-6 py-14 text-[var(--text)]">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="relative mx-auto flex max-w-[980px] flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs text-[var(--muted2)]">Shared project</div>
            <div className="truncate text-3xl font-semibold tracking-tight">{share.album.title}</div>
            <div className="mt-1 text-sm text-[var(--muted)]">
              {share.album.artist ? `by ${share.album.artist}` : "Artist not set"} · Updated{" "}
              {share.album.updatedAt.toLocaleString()}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {session?.user?.id ? (
              <ForkShareButton token={token} />
            ) : (
              <Link
                href={`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black shadow-[0_20px_70px_rgba(0,0,0,0.4)] hover:bg-white/90"
              >
                Sign in to remix
              </Link>
            )}
          </div>
        </div>

        {share.album.conceptSummary ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="text-xs text-[var(--muted2)]">Concept</div>
            <div className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              {share.album.conceptSummary}
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-[var(--muted2)]">Tracklist</div>
              <div className="text-sm font-semibold">Songs</div>
            </div>
            <div className="text-xs text-[var(--muted)]">{songs.length} tracks</div>
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)]">
            {songs.length ? (
              <ul className="divide-y divide-[rgba(255,255,255,0.06)]">
                {songs.map((song) => (
                  <li key={`${song.track_number}-${song.title}`} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 text-xs tabular-nums text-[var(--muted2)]">
                        {String(song.track_number).padStart(2, "0")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{song.title}</div>
                        <div className="truncate text-xs text-[var(--muted2)]">
                          Shared read-only preview.
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

          <div className="mt-4 text-xs text-[var(--muted2)]">
            Want to edit, export, and run agents? Sign in to create your own fork of this project.
          </div>
        </div>
      </div>
    </div>
  );
}
