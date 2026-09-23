import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { AlbumPageViewTracker } from "@/components/album-page-view-tracker";
import { BibleActions } from "@/components/bible-actions";
import { ThemeMark } from "@/components/theme-mark";
import { ButtonLink, Chip, EmptyState, Section, TableScroller } from "@/components/ui";
import { getAlbum } from "@/server/albums";
import { getSpineRows } from "@/server/album-songs";
import { buildAlbumBible, looseThreadsSummary, themeTracksPhrase, type AlbumBible, type BibleIssue } from "@/server/bible";
import { buildMotifCharacterGraph, type MotifCharacterGraph } from "@/server/bible-relationships";
import { coherenceFixHref } from "@/server/coherence";
import { requireUser } from "@/server/identity";
import { summarizeStyleBible } from "@/server/style-bible";
import { albumPageTitle, workspaceAlbumTitle } from "@/server/page-titles";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { albumMotifIndex, type MotifEntry } from "@/lib/motifs";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
/** "Album Bible · <album title>" in the browser tab and history. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ albumId: string }>;
}): Promise<Metadata> {
  const { albumId } = await params;
  return {
    title: albumPageTitle("Album Bible", await workspaceAlbumTitle(albumId)),
    description: "Themes, motifs, characters and story beats across the album, and what still needs tagging.",
  };
}

/** The map's text version is listed in full up to this many connections, then folded away. */
const CONNECTIONS_SHOWN = 10;
const DISCLOSURE =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded border border-line-strong px-4 text-sm font-semibold text-ink transition-colors hover:bg-hover";

function pad(trackNumber: number) {
  return String(trackNumber).padStart(2, "0");
}

/** The signature view: which of the album's themes each track carries, in sequence. */
function ThemeMatrix({ albumId, bible }: { albumId: string; bible: AlbumBible }) {
  const { tracks, rows } = bible.themeGrid;
  if (!tracks.length) {
    return (
      <EmptyState
        title="No tracks yet"
        action={<ButtonLink href={`/app/albums/${albumId}/studio`}>Open the Studio</ButtonLink>}
      >
        Add tracks in the Studio, then tag the themes each one carries.
      </EmptyState>
    );
  }
  if (!rows.length) {
    return (
      <EmptyState
        title="No themes to map yet"
        action={
          <ButtonLink href={coherenceFixHref(albumId, { focus: "album" })}>Add album themes</ButtonLink>
        }
      >
        Name the album&apos;s 3 to 6 central themes, then tag each track with the ones it carries. The
        map fills in as you go.
      </EmptyState>
    );
  }

  // The theme column sticks while the track columns scroll under it, at a width set against the
  // scroller (`cqw`, from the @container wrapper) so it can never outgrow it at 200% text: at
  // most 12rem or 40% of the scroller. The scroller's scroll padding is the same width, so a
  // track link reached by Tab scrolls clear of the sticky column instead of under it. Below
  // 28rem (rem, so enlarged text reaches it sooner) there's no room for a sticky column; it
  // scrolls with the rest.
  const themeColumn =
    "w-[min(12rem,40cqw)] min-w-[min(12rem,40cqw)] max-w-[45cqw] bg-ground pr-4 text-left sticky left-0 z-10 @max-[28rem]:static";
  return (
    <div className="@container min-w-0 border-y border-line">
      <TableScroller label="Theme map" className="scroll-ps-[min(12rem,40%)] @max-[28rem]:scroll-ps-0">
        {/* Auto layout: larger text widens the table (it scrolls inside this region) instead
            of starving the theme names. */}
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Themes by track. Each row is a theme and says which tracks carry it; select a track
            number to edit that track&apos;s themes.
          </caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className={cn(themeColumn, "py-2 text-xs font-semibold text-ink-3")}>
                Theme
              </th>
              {tracks.map((track) => (
                <th key={track.trackNumber} scope="col" className="w-12 min-w-12 p-0 font-normal">
                  <Link
                    href={coherenceFixHref(albumId, { focus: "song-themes", trackNumber: track.trackNumber })}
                    title={`${track.title}: edit its themes`}
                    className="type-figure mx-auto grid h-11 w-11 place-items-center rounded-sm text-sm font-semibold text-ink-3 hover:bg-hover hover:text-ink"
                  >
                    {pad(track.trackNumber)}
                    <span className="sr-only">{`, ${track.title}: edit its themes`}</span>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-line last:border-b-0">
                <th scope="row" className={cn(themeColumn, "py-2.5 font-normal")}>
                  <span className="block font-semibold text-ink wrap-anywhere hyphens-auto">{row.label}</span>
                  <span className="type-figure block text-xs text-ink-3">
                    {row.trackNumbers.length
                      ? `${row.trackNumbers.length} of ${tracks.length} tracks`
                      : "On no track yet"}
                    {/* One phrase per row instead of a "yes"/"no" for every cell. */}
                    {row.trackNumbers.length ? (
                      <span className="sr-only">{`, ${themeTracksPhrase(row.trackNumbers, tracks.length)}`}</span>
                    ) : null}
                  </span>
                </th>
                {row.presence.map((present, index) => (
                  <td key={`${row.label}-${tracks[index]?.trackNumber ?? index}`} className="p-0 text-center">
                    <ThemeMark carries={present} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroller>
    </div>
  );
}

/** Characters on the left, motifs on the right, a line wherever a track carries both. */
function RelationshipMap({ graph }: { graph: MotifCharacterGraph }) {
  if (!graph.characters.length || !graph.motifs.length) {
    return (
      <p className="text-sm text-ink-2">
        Tag characters and motifs on the same tracks to see who carries which motif.
      </p>
    );
  }

  const chars = graph.characters;
  const motifs = graph.motifs;
  const edges = graph.edges.slice(0, 120);
  const row = 34;
  const padY = 26;
  const viewW = 800;
  const viewH = Math.max(chars.length, motifs.length) * row + padY * 2;
  const leftX = 220;
  const rightX = 580;
  const yForIndex = (idx: number) => padY + idx * row + row / 2;
  const charY = new Map(chars.map((c, i) => [c.name, yForIndex(i)] as const));
  const motifY = new Map(motifs.map((m, i) => [m.name, yForIndex(i)] as const));

  return (
    <div className="flex flex-col gap-4">
      <TableScroller label="Character and motif map">
        <svg
          viewBox={`0 0 ${viewW} ${viewH}`}
          className="w-full min-w-[640px] max-w-[880px]"
          role="img"
          aria-label="Which characters appear on tracks with which motifs"
        >
          {edges.map((edge) => {
            const y1 = charY.get(edge.character);
            const y2 = motifY.get(edge.motif);
            if (!y1 || !y2) return null;
            return (
              <line
                key={`${edge.character}::${edge.motif}`}
                x1={leftX}
                y1={y1}
                x2={rightX}
                y2={y2}
                className="stroke-ink-3"
                strokeWidth={Math.min(5, 1 + edge.weight)}
                strokeOpacity={Math.min(0.9, 0.35 + edge.weight * 0.15)}
                vectorEffect="non-scaling-stroke"
              >
                <title>
                  {`${edge.character} and ${edge.motif}: tracks ${edge.trackNumbers.join(", ")}`}
                </title>
              </line>
            );
          })}
          {chars.map((c) => {
            const y = charY.get(c.name) ?? 0;
            return (
              <g key={`c-${c.name}`}>
                <circle cx={leftX} cy={y} r={6} className="fill-ink" />
                <text x={leftX - 16} y={y + 5} fontSize={16} textAnchor="end" className="fill-ink">
                  {c.name}
                </text>
              </g>
            );
          })}
          {motifs.map((m) => {
            const y = motifY.get(m.name) ?? 0;
            return (
              <g key={`m-${m.name}`}>
                <rect x={rightX - 6} y={y - 6} width={12} height={12} className="fill-ink-2" />
                <text x={rightX + 16} y={y + 5} fontSize={16} textAnchor="start" className="fill-ink">
                  {m.name}
                </text>
              </g>
            );
          })}
        </svg>
      </TableScroller>
      {graph.edges.length > CONNECTIONS_SHOWN ? (
        <details>
          <summary className={DISCLOSURE}>{`All ${graph.edges.length} connections`}</summary>
          <div className="mt-3">
            <ConnectionList edges={graph.edges} />
          </div>
        </details>
      ) : graph.edges.length ? (
        <ConnectionList edges={graph.edges} />
      ) : null}
    </div>
  );
}

/** The map's text version: every character–motif pair and the tracks that carry both. */
function ConnectionList({ edges }: { edges: MotifCharacterGraph["edges"] }) {
  return (
    <ul className="divide-y divide-line border-y border-line text-sm">
      {edges.map((edge) => (
        <li key={`edge-${edge.character}-${edge.motif}`} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2">
          <span className="min-w-0 break-words text-ink">
            {edge.character} <span className="text-ink-3">with</span> {edge.motif}
          </span>
          <span className="type-figure text-xs text-ink-3">
            {edge.trackNumbers.length === 1 ? "Track" : "Tracks"} {edge.trackNumbers.join(", ")}
          </span>
        </li>
      ))}
    </ul>
  );
}

function IssueRow({ albumId, issue }: { albumId: string; issue: BibleIssue }) {
  return (
    <li className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-6">
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-semibold text-ink">{issue.title}</p>
        <p className="mt-0.5 max-w-[65ch] text-sm leading-relaxed text-ink-2">{issue.detail}</p>
      </div>
      {issue.fix ? (
        <Link
          href={coherenceFixHref(albumId, issue.fix)}
          className="inline-flex min-h-11 min-w-0 items-center gap-1 self-start text-sm font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink-3"
        >
          {issue.fix.focus === "style" ? "Open the Style bible" : "Fix in Studio"}
          <span className="sr-only">: {issue.title}</span>
        </Link>
      ) : null}
    </li>
  );
}

/**
 * Every motif of the album: its own motifs and the motif tags on its tracks, from the same
 * source the Coherence report reads (`@/lib/motifs`).
 */
function MotifList({ albumId, motifs }: { albumId: string; motifs: MotifEntry[] }) {
  if (!motifs.length) {
    return (
      <p className="text-sm text-ink-2">
        No motifs yet.{" "}
        <Link
          href={coherenceFixHref(albumId, { focus: "album-motifs" })}
          className="font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink-3"
        >
          Name the album&apos;s motifs in the Studio
        </Link>
      </p>
    );
  }
  return (
    <ul className="divide-y divide-line border-y border-line text-sm">
      {motifs.map((motif) => (
        <li key={motif.name} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <span className="min-w-0 break-words text-ink">{motif.name}</span>
            {motif.albumLevel ? <span className="text-xs text-ink-3">Album motif</span> : null}
          </span>
          <span className="type-figure text-xs text-ink-3">
            {motif.trackNumbers.length
              ? `${motif.trackNumbers.length === 1 ? "Track" : "Tracks"} ${motif.trackNumbers.join(", ")}`
              : "On no track yet"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function IndexList({ entries, empty }: { entries: Array<{ name: string; trackNumbers: number[] }>; empty: string }) {
  if (!entries.length) return <p className="text-sm text-ink-2">{empty}</p>;
  return (
    <ul className="divide-y divide-line border-y border-line text-sm">
      {entries.map((entry) => (
        <li key={entry.name} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
          <span className="min-w-0 break-words text-ink">{entry.name}</span>
          <span className="type-figure text-xs text-ink-3">
            {entry.trackNumbers.length === 1 ? "Track" : "Tracks"} {entry.trackNumbers.join(", ")}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function AlbumBiblePage({ params }: { params: Promise<{ albumId: string }> }) {
  const { albumId } = await params;
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const album = await getAlbum(workspace.id, albumId);
  if (!album) notFound();

  const bible = buildAlbumBible(album.data);
  const styleSummary = summarizeStyleBible(bible.styleBible);
  const graph = buildMotifCharacterGraph(bible, { maxCharacters: 10, maxMotifs: 10, minEdgeWeight: 1 });
  const motifs = albumMotifIndex(album.data);
  // Track-by-track gaps are the Coherence report's job and Style bible gaps show under
  // "Voice and style"; this page checks only how the album's threads hang together.
  const structure = bible.issues.filter((issue) => issue.scope === "structure");
  const warnings = structure.filter((issue) => issue.level === "warn");
  const notes = structure.filter((issue) => issue.level === "info");
  const base = `/app/albums/${album.id}`;
  const spine = getSpineRows(album.data);
  const writtenTracks = spine.filter((row) => row.lyricSections > 0).length;

  return (
    <div className="flex flex-col gap-10">
      <AlbumPageViewTracker albumId={album.id} event="album_bible_viewed" path={`${base}/bible`} />

      <Section id="bible-concept" title="Concept">
        {bible.conceptSummary ? (
          <p className="max-w-[65ch] text-base leading-relaxed text-ink-2">{bible.conceptSummary}</p>
        ) : (
          <p className="text-sm text-ink-2">
            No concept summary yet.{" "}
            <Link
              href={coherenceFixHref(album.id, { focus: "album" })}
              className="font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink-3"
            >
              Write the concept summary in the Studio
            </Link>
          </p>
        )}
        {/* Tagging shows its suggestions for review right here, under the buttons. */}
        <BibleActions albumId={album.id} className="mt-4" />
      </Section>

      <Section
        id="bible-themes"
        title="Theme map"
        description={`The album's themes across the ${
          bible.timeline.mode === "chronological" ? "story order" : "tracklist"
        }. Select a track number to edit its themes.`}
      >
        <ThemeMatrix albumId={album.id} bible={bible} />
      </Section>

      <Section
        id="bible-issues"
        title="Loose threads"
        description={looseThreadsSummary({
          warnings: warnings.length,
          writtenTracks,
          totalTracks: spine.length,
        })}
        actions={
          <ButtonLink href={`${base}/coherence`} tone="ghost">
            Open the Coherence report
          </ButtonLink>
        }
      >
        <p className="mb-4 max-w-[65ch] text-sm leading-relaxed text-ink-2">
          Lyrics, chords, story notes and tags on each track are checked in the Coherence report.
        </p>
        {warnings.length ? (
          <ul className="divide-y divide-line border-y border-line">
            {warnings.map((issue) => (
              <IssueRow key={`warn-${issue.title}`} albumId={album.id} issue={issue} />
            ))}
          </ul>
        ) : null}
        {notes.length ? (
          <details className="mt-4">
            <summary className={DISCLOSURE}>
              {notes.length === 1 ? "1 smaller note" : `${notes.length} smaller notes`}
            </summary>
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {notes.map((issue) => (
                <IssueRow key={`note-${issue.title}`} albumId={album.id} issue={issue} />
              ))}
            </ul>
          </details>
        ) : null}
      </Section>

      <Section
        id="bible-story"
        title="Story beats"
        description={
          bible.timeline.mode === "chronological"
            ? "Tracks in story order, which differs from the tracklist."
            : "Tracks in tracklist order."
        }
      >
        {bible.timeline.tracks.length ? (
          <ol className="divide-y divide-line border-y border-line">
            {bible.timeline.tracks.map((track) => {
              const tags = [...track.themes.slice(0, 6), ...track.motifs.slice(0, 4), ...track.characters.slice(0, 4)];
              const sections = track.sections
                .slice(0, 6)
                .map((section) =>
                  [
                    section.sectionType,
                    section.narrativeFunction ? `function: ${section.narrativeFunction}` : null,
                    section.emotionalArc ? `arc: ${section.emotionalArc}` : null,
                  ]
                    .filter(Boolean)
                    .join(", "),
                )
                .join(" · ");
              return (
                <li key={track.trackNumber} className="flex gap-4 py-4">
                  <span className="type-figure flex h-11 w-8 shrink-0 items-center text-xl font-semibold text-ink-3">
                    {pad(track.trackNumber)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4">
                      <h3 className="min-w-0 text-sm font-semibold text-ink">
                        {track.title}
                        {typeof track.chronologicalOrder === "number" ? (
                          <span className="type-figure ml-2 text-xs font-normal text-ink-3">
                            story order {track.chronologicalOrder}
                          </span>
                        ) : null}
                      </h3>
                      <Link
                        href={coherenceFixHref(album.id, { focus: "story", trackNumber: track.trackNumber })}
                        className="inline-flex min-h-11 items-center gap-1 text-sm text-ink-2 hover:text-ink"
                      >
                        Edit story note
                        <span className="sr-only">{` for ${track.title}`}</span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </div>
                    <p className={cn("max-w-[65ch] text-sm leading-relaxed", track.narrativeSummary ? "text-ink-2" : "text-ink-3")}>
                      {track.narrativeSummary || "No story note yet."}
                    </p>
                    {tags.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {tags.map((tag, index) => (
                          <Chip key={`${track.trackNumber}-${tag}-${index}`}>{tag}</Chip>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-2 max-w-[65ch] text-xs text-ink-3">{sections || "No sections yet."}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-ink-2">No tracks yet.</p>
        )}
      </Section>

      <Section
        id="bible-cast"
        title="Characters and motifs"
        description="Who carries which motif, and where each one comes back. Motifs are the album's own plus the motif tags on its tracks."
      >
        <div className="flex flex-col gap-8">
          <RelationshipMap graph={graph} />
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="min-w-0">
              <h3 className="mb-2 text-sm font-semibold text-ink">Characters</h3>
              <IndexList entries={bible.characterIndex} empty="No characters tagged yet." />
            </div>
            <div className="min-w-0">
              <h3 className="mb-2 text-sm font-semibold text-ink">Motifs</h3>
              <MotifList albumId={album.id} motifs={motifs} />
            </div>
          </div>
        </div>
      </Section>

      <Section
        id="bible-style"
        title="Voice and style"
        description={`${styleSummary.filledCount} of ${styleSummary.totalCount} parts of the Style bible are set.`}
        actions={<ButtonLink href={`${base}/style`} tone="ghost">Open the Style bible</ButtonLink>}
      >
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-[10rem_minmax(0,1fr)]">
          <dt className="text-sm font-semibold text-ink">Lead voice</dt>
          <dd className="max-w-[65ch] text-sm leading-relaxed text-ink-2">{bible.styleBible.lead_voice || "Not set yet."}</dd>
          <dt className="text-sm font-semibold text-ink">Sonic palette</dt>
          <dd className="flex flex-wrap gap-1.5 text-sm text-ink-2">
            {bible.styleBible.sonic_palette.length
              ? bible.styleBible.sonic_palette.map((item) => <Chip key={`palette-${item}`}>{item}</Chip>)
              : "Not set yet."}
          </dd>
          <dt className="text-sm font-semibold text-ink">Mix priorities</dt>
          <dd className="flex flex-wrap gap-1.5 text-sm text-ink-2">
            {bible.styleBible.mix_priorities.length
              ? bible.styleBible.mix_priorities.map((item) => <Chip key={`mix-${item}`}>{item}</Chip>)
              : "Not set yet."}
          </dd>
        </dl>
      </Section>
    </div>
  );
}
