import { notFound } from "next/navigation";

import { CatalogItems } from "@/components/album-card";
import { DiscoverAlbumActions } from "@/components/discover-album-actions";
import { RelativeTime } from "@/components/relative-time";
import { ButtonLink, PageHeader, Section } from "@/components/ui";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { analyzeAlbumCoherence } from "@/server/coherence";
import { getCredits } from "@/server/credits";
import { getPrisma } from "@/server/db";
import { requireUser } from "@/server/identity";
import { effectivePlan } from "@/server/plan";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Discover album",
  description: "Read a published album's sequence and remix it into your workspace.",
};

type Track = { trackNumber: number; title: string; themes: string[]; narrative: string | null };

/** The published album's sequence, read from its snapshot: number, title, themes, role. */
function readTracks(data: unknown): Track[] {
  const songs = (data as { songs?: unknown } | null)?.songs;
  if (!Array.isArray(songs)) return [];
  const tracks: Track[] = [];
  for (const raw of songs) {
    if (!raw || typeof raw !== "object") continue;
    const song = raw as Record<string, unknown>;
    if (typeof song.track_number !== "number" || typeof song.title !== "string") continue;
    const themes = Array.isArray(song.themes)
      ? song.themes.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      : [];
    const narrative =
      typeof song.narrative_summary === "string" && song.narrative_summary.trim()
        ? song.narrative_summary.trim()
        : null;
    tracks.push({ trackNumber: song.track_number, title: song.title, themes, narrative });
  }
  return tracks.sort((a, b) => a.trackNumber - b.trackNumber);
}

export default async function DiscoverAlbumPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const { albumId } = await params;
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);

  const prisma = getPrisma();
  const [album, credits] = await Promise.all([
    prisma.album.findFirst({
      where: { id: albumId, isPublic: true },
      select: {
        id: true,
        title: true,
        artist: true,
        conceptSummary: true,
        primaryGenre: true,
        data: true,
        publishedAt: true,
        _count: { select: { likes: true } },
        likes: { where: { userId }, select: { id: true } },
      },
    }),
    getCredits({ workspaceId: workspace.id, plan: effectivePlan(workspace.subscription) }),
  ]);
  if (!album) notFound();

  const tracks = readTracks(album.data);
  const coherence = analyzeAlbumCoherence(album.data);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title={album.title}
        catalog={
          <span className="flex flex-wrap gap-x-2 gap-y-0.5">
            <CatalogItems
              items={[
                album.artist || "Artist not named",
                album.primaryGenre,
                <span key="tracks" className="type-figure">
                  {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
                </span>,
                album.publishedAt ? (
                  <span key="published">
                    Published <RelativeTime date={album.publishedAt.toISOString()} />
                  </span>
                ) : null,
              ]}
            />
          </span>
        }
        description={album.conceptSummary || undefined}
        actions={
          <DiscoverAlbumActions
            albumId={album.id}
            initialLiked={Boolean(album.likes.length)}
            initialLikes={album._count.likes}
            creditsRemaining={credits.remaining}
          />
        }
      />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <section aria-labelledby="sequence-title" className="min-w-0">
          <h2 id="sequence-title" className="text-lg font-semibold text-ink">
            Sequence
          </h2>
          {tracks.length ? (
            <ol className="mt-3 border-t border-line">
              {tracks.map((track) => (
                <li key={`${track.trackNumber}-${track.title}`} className="flex gap-4 border-b border-line py-3">
                  <span className="type-figure w-9 shrink-0 text-2xl font-semibold leading-none text-ink-3">
                    {String(track.trackNumber).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-base font-semibold text-ink hyphens-auto">{track.title}</p>
                    {track.narrative ? (
                      <p className="mt-1 max-w-[65ch] break-words text-sm leading-relaxed text-ink-2">{track.narrative}</p>
                    ) : null}
                    {track.themes.length ? (
                      <p className="type-catalog mt-1.5 text-xs text-ink-3">
                        <span className="sr-only">Themes: </span>
                        {track.themes.join(" · ")}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-ink-2">
              This album was published before any tracks were added.
            </p>
          )}
        </section>

        <aside aria-label="About this album" className="flex min-w-0 flex-col gap-8">
          <Section
            title="How it holds together"
            headingLevel={2}
            description="Coherence report scores out of 100, computed from what the artist has written so far."
          >
            {coherence.insufficient ? (
              <p className="text-sm leading-relaxed text-ink-2">
                Not enough written yet to score: this album has lyrics on fewer than two tracks.
              </p>
            ) : (
              <dl>
                {coherence.breakdown.map((item) => (
                  <div key={item.key} className="flex items-baseline justify-between gap-3 border-b border-line py-2">
                    <dt className="text-sm text-ink-2">{item.label}</dt>
                    <dd className="type-figure text-sm font-semibold text-ink">{item.score}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Section>

          <Section title="Remixing">
            <p className="max-w-[65ch] text-sm leading-relaxed text-ink-2">
              A remix copies this album&apos;s concept, sequence, lyrics and chords into your
              workspace as a new private album, opened in the Studio. It costs{" "}
              {CREDIT_COSTS.albumFork} credits. The original and its artist are not affected.
            </p>
            <ButtonLink tone="ghost" href="/app/discover" className="mt-3 -ml-4">
              Back to community albums
            </ButtonLink>
          </Section>
        </aside>
      </div>
    </div>
  );
}
