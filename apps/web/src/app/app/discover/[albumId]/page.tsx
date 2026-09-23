import { notFound } from "next/navigation";
import { Check } from "lucide-react";

import { CatalogItems } from "@/components/album-card";
import { DiscoverAlbumActions } from "@/components/discover-album-actions";
import { RelativeTime } from "@/components/relative-time";
import { ThemeMark } from "@/components/theme-mark";
import { ButtonLink, PageHeader, Section } from "@/components/ui";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { lyricExcerptsByTrack, writtenSummaryLine } from "@/lib/discover";
import { getSpineRows, getSpineThemes } from "@/server/album-songs";
import { analyzeAlbumCoherence, MIN_WRITTEN_TRACKS_FOR_SCORE } from "@/server/coherence";
import { getCredits } from "@/server/credits";
import { getPrisma } from "@/server/db";
import { requireUser } from "@/server/identity";
import { effectivePlan } from "@/server/plan";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Discover album",
  description: "Read a published album's sequence and lyrics, then remix it into your workspace.",
};

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

function pad(trackNumber: number) {
  return String(trackNumber).padStart(2, "0");
}

/** "memory", "memory and signal", "memory, signal and loss". */
function spokenList(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
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
  const written = writtenSummaryLine({
    tracks: rows.length,
    withLyrics: rows.filter((row) => row.lyricSections > 0).length,
  });

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
                <span key="written" className="type-figure">
                  {written}
                </span>,
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
          <section aria-labelledby="sequence-title" className="min-w-0">
            <h2 id="sequence-title" className="text-lg font-semibold text-ink">
              Sequence
            </h2>
            {themes.length ? (
              <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-ink-2">
                <span className="text-ink-3">Album themes: </span>
                {themes.join(" · ")}
              </p>
            ) : null}
            {rows.length ? (
              <ol className="mt-3 border-t border-line">
                {rows.map((row) => {
                  const themeKeys = new Set(row.themeKeys);
                  const carried = themes.filter((theme) => themeKeys.has(theme.toLowerCase()));
                  const excerpt = excerpts.get(row.trackNumber) ?? [];
                  const story = storyNotes.get(row.trackNumber);
                  return (
                    <li
                      key={row.trackNumber}
                      className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 border-b border-line py-4"
                    >
                      <span className="type-figure pt-0.5 text-sm font-semibold text-ink-3">
                        <span className="sr-only">Track </span>
                        {pad(row.trackNumber)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <h3 className="min-w-0 break-words text-base font-semibold text-ink hyphens-auto">
                            {row.title}
                          </h3>
                          {row.sections ? (
                            <p className="type-figure text-sm text-ink-2">
                              <span aria-hidden="true">
                                Lyrics {row.lyricSections}/{row.sections}
                              </span>
                              <span className="sr-only">
                                Lyrics: {row.lyricSections} of {row.sections}{" "}
                                {row.sections === 1 ? "section" : "sections"} written
                              </span>
                            </p>
                          ) : (
                            <p className="text-sm text-ink-3">No sections yet</p>
                          )}
                        </div>

                        {row.narrativePosition || carried.length ? (
                          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
                            {row.narrativePosition ? (
                              <span className="inline-flex min-w-0 items-center gap-1.5">
                                <Check className="h-3.5 w-3.5 text-ink-3" aria-hidden="true" />
                                <span className="break-words">Role: {row.narrativePosition}</span>
                              </span>
                            ) : null}
                            {carried.length ? (
                              <span className="inline-flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="sr-only">Carries {spokenList(carried)}</span>
                                {carried.map((theme) => (
                                  <span key={theme} aria-hidden="true" className="inline-flex items-center gap-1.5">
                                    <span className="inline-block w-2.5">
                                      <ThemeMark carries label="" />
                                    </span>
                                    {theme}
                                  </span>
                                ))}
                              </span>
                            ) : null}
                          </p>
                        ) : null}

                        {story ? (
                          <p className="mt-2 max-w-[65ch] break-words text-sm leading-relaxed text-ink-2">
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
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-ink-2">
                This album was published before any tracks were added.
              </p>
            )}
          </section>

          <div className="flex min-w-0 flex-col gap-8">
            <Section
              title="How it holds together"
              headingLevel={2}
              description="The Coherence report, scored out of 100 from what the artist has written so far."
            >
              {coherence.insufficient ? (
                <p className="max-w-[65ch] text-sm leading-relaxed text-ink-2">
                  Not enough written to score yet: a score needs lyrics on at least{" "}
                  {MIN_WRITTEN_TRACKS_FOR_SCORE} tracks.
                </p>
              ) : (
                <>
                  <p className="flex items-baseline justify-between gap-3 border-b border-line-strong pb-2">
                    <span className="text-sm font-semibold text-ink">Overall</span>
                    <span className="type-figure text-sm text-ink-2">
                      <span className="text-lg font-semibold text-ink">{coherence.score}</span> / 100
                    </span>
                  </p>
                  <dl>
                    {coherence.breakdown.map((item) => (
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
                  : `A remix copies this album's concept, sequence, lyrics and chords into your workspace as a new private album, opened in the Studio. It costs ${CREDIT_COSTS.albumFork} credits. The original and its artist are not affected.`}
              </p>
              <ButtonLink tone="ghost" href="/app/discover" className="mt-3 -ml-4">
                Back to community albums
              </ButtonLink>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}
