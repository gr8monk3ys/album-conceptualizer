import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CatalogItems } from "@/components/album-card";
import { DiscoverAlbumActions } from "@/components/discover-album-actions";
import { RelativeTime } from "@/components/relative-time";
import { ReadOnlySpine } from "@/components/read-only-spine";
import { ButtonLink, Chip, PageHeader, Section } from "@/components/ui";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { lyricExcerptsByTrack, writtenSummaryItems } from "@/lib/discover";
import { getSpineRows, getSpineThemes } from "@/server/album-songs";
import {
  analyzeAlbumCoherence,
  dimensionsWeakestFirst,
  MIN_WRITTEN_TRACKS_FOR_SCORE,
  verdictText,
} from "@/server/coherence";
import { getCredits } from "@/server/credits";
import { getPrisma } from "@/server/db";
import { requireUser } from "@/server/identity";
import { effectivePlan } from "@/server/plan";
import { publishedAlbumTitle } from "@/server/page-titles";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";

const DESCRIPTION = "Read a published album's sequence and lyrics, then remix it into your workspace.";

/** "<album title> · Discover" in the browser tab and history. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ albumId: string }>;
}): Promise<Metadata> {
  const { albumId } = await params;
  const title = await publishedAlbumTitle(albumId);
  return { title: title ? `${title} · Discover` : "Discover", description: DESCRIPTION };
}

/** Each track's Story note (its narrative summary), keyed by track number. */
function readStoryNotes(data: unknown): Map<number, string> {
  const notes = new Map<number, string>();
  const songs = (data as { songs?: unknown } | null)?.songs;
  if (!Array.isArray(songs)) return notes;
  for (const raw of songs) {
    if (!raw || typeof raw !== "object") continue;
    const song = raw as Record<string, unknown>;
    if (typeof song.track_number !== "number") continue;
    if (typeof song.narrative_summary === "string" && song.narrative_summary.trim()) {
      notes.set(song.track_number, song.narrative_summary.trim());
    }
  }
  return notes;
}

function trackAnchor(trackNumber: number) {
  return `track-${trackNumber}`;
}

function pad(trackNumber: number) {
  return String(trackNumber).padStart(2, "0");
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
        workspaceId: true,
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

  const isOwn = album.workspaceId === workspace.id;
  const rows = getSpineRows(album.data);
  const themes = getSpineThemes(album.data);
  const storyNotes = readStoryNotes(album.data);
  const excerpts = lyricExcerptsByTrack(album.data);
  const coherence = analyzeAlbumCoherence(album.data);
  const written = writtenSummaryItems({
    tracks: rows.length,
    withLyrics: rows.filter((row) => row.lyricSections > 0).length,
  });
  // Tracks with something to read below the sequence: a story note or written lyrics.
  const readable = new Set(
    rows
      .filter((row) => storyNotes.has(row.trackNumber) || (excerpts.get(row.trackNumber) ?? []).length)
      .map((row) => row.trackNumber),
  );

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
                ...written.map((item) => (
                  <span key={item} className="type-figure">
                    {item}
                  </span>
                )),
                isOwn ? "Your album" : null,
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
            isOwn={isOwn}
          />
        }
      />

      {/* Rem-sized container query: with enlarged text the side column folds under the sequence. */}
      <div className="@container">
        <div className="grid grid-cols-1 gap-10 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
          <div className="flex min-w-0 flex-col gap-10">
            <section aria-labelledby="sequence-title" className="min-w-0">
              <h2 id="sequence-title" className="mb-2 text-lg font-semibold text-ink">
                Sequence
              </h2>
              {rows.length ? (
                <ReadOnlySpine
                  rows={rows}
                  themes={themes}
                  anchorFor={(trackNumber) => (readable.has(trackNumber) ? trackAnchor(trackNumber) : null)}
                />
              ) : (
                <p className="max-w-[65ch] text-sm text-ink-2">
                  This album was published before any tracks were added.
                </p>
              )}
            </section>

            {readable.size ? (
              <Section
                title="Lyrics"
                description="Each track's story note and the first lines written for it. Select a title in the sequence to jump to it."
              >
                <ol className="border-t border-line">
                  {rows
                    .filter((row) => readable.has(row.trackNumber))
                    .map((row) => {
                      const excerpt = excerpts.get(row.trackNumber) ?? [];
                      const story = storyNotes.get(row.trackNumber);
                      return (
                        <li
                          key={row.trackNumber}
                          id={trackAnchor(row.trackNumber)}
                          className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 border-b border-line py-4"
                        >
                          <span className="type-figure pt-0.5 text-sm font-semibold text-ink-3">
                            <span className="sr-only">Track </span>
                            {pad(row.trackNumber)}
                          </span>
                          <div className="min-w-0">
                            <h3 className="break-words text-base font-semibold text-ink hyphens-auto">{row.title}</h3>
                            {story ? (
                              <p className="mt-1 max-w-[65ch] break-words text-sm leading-relaxed text-ink-2">
                                {story}
                              </p>
                            ) : null}
                            {excerpt.length ? (
                              <figure className="mt-3">
                                <blockquote className="max-w-[65ch] border-l border-line-strong pl-3 text-sm leading-relaxed text-ink">
                                  {excerpt.map((line, index) => (
                                    <p key={index} className="break-words">
                                      {line}
                                      {index === excerpt.length - 1 ? " …" : null}
                                    </p>
                                  ))}
                                </blockquote>
                                <figcaption className="mt-1 pl-3 text-xs text-ink-3">
                                  Excerpt: the first written lines
                                </figcaption>
                              </figure>
                            ) : (
                              <p className="mt-1 text-sm text-ink-3">No lyrics written yet.</p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                </ol>
              </Section>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col gap-8">
            <Section
              title="How it holds together"
              headingLevel={2}
              description="The Coherence report, scored out of 100 from what the artist has written so far, weakest dimension first."
            >
              {coherence.insufficient ? (
                <p className="max-w-[65ch] text-sm leading-relaxed text-ink-2">
                  Not enough written to score yet: a score needs lyrics on at least{" "}
                  {MIN_WRITTEN_TRACKS_FOR_SCORE} tracks.
                </p>
              ) : (
                <>
                  {/* The verdict comes first: a score on a half-written album is capped, and the
                      label ("Unfinished · 3 of 8 tracks written") says why before the number. */}
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2 border-b border-line-strong pb-2">
                    <p className="min-w-0 text-sm font-semibold text-ink">
                      Overall
                      <Chip tone={coherence.verdict.tone} className="type-figure ml-2 align-middle">
                        {verdictText(coherence.verdict)}
                      </Chip>
                    </p>
                    <p className="type-figure text-sm text-ink-2">
                      <span className="text-lg font-semibold text-ink">{coherence.score}</span> / 100
                    </p>
                  </div>
                  {/* The same order as the owner's Coherence report ("By dimension"): weakest
                      first, so a visitor and the artist read the dimensions alike. */}
                  <dl>
                    {dimensionsWeakestFirst(coherence.breakdown).map((item) => (
                      <div key={item.key} className="flex items-baseline justify-between gap-3 border-b border-line py-2">
                        <dt className="text-sm text-ink-2">{item.label}</dt>
                        <dd className="type-figure text-sm font-semibold text-ink">{item.score}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}
            </Section>

            <Section title={isOwn ? "Your album" : "Remixing"}>
              <p className="max-w-[65ch] text-sm leading-relaxed text-ink-2">
                {isOwn
                  ? "This is how other artists see your album on Discover. Open it in the Studio to keep writing; changes show here as you save them."
                  : `A remix copies this album's concept, sequence, lyrics and chords into your workspace as a new private album credited to you, opened in the Studio; it keeps a note of the album it came from. It costs ${CREDIT_COSTS.albumFork} credits. The original and its artist are not affected.`}
              </p>
              <ButtonLink tone="ghost" href="/app/discover" className="mt-3 -ml-4">
                Back to Discover
              </ButtonLink>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}
