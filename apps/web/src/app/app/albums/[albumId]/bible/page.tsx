import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { AlbumPageViewTracker } from "@/components/album-page-view-tracker";
import { BibleActions } from "@/components/bible-actions";
import { ButtonLink, Chip, EmptyState, Section } from "@/components/ui";
import { getAlbum } from "@/server/albums";
import { buildAlbumBible, type AlbumBible, type BibleIssue } from "@/server/bible";
import { buildMotifCharacterGraph, type MotifCharacterGraph } from "@/server/bible-relationships";
import { coherenceFixHref } from "@/server/coherence";
import { requireUser } from "@/server/identity";
import { summarizeStyleBible } from "@/server/style-bible";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Album Bible",
  description: "Themes, motifs, characters and story beats across the album, and what still needs tagging.",
};

const THEME_COLUMN_PX = 224;
const TRACK_COLUMN_PX = 48;

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

  return (
    <div className="relative overflow-x-auto border-y border-line">
      <table
        className="w-full table-fixed border-collapse text-sm"
        style={{ minWidth: THEME_COLUMN_PX + tracks.length * TRACK_COLUMN_PX }}
      >
        <caption className="sr-only">
          Themes by track. Each row is a theme; a filled mark means the track is tagged with it.
        </caption>
        <thead>
          <tr className="border-b border-line">
            <th
              scope="col"
              className="sticky left-0 z-10 bg-ground py-2 pr-4 text-left text-xs font-semibold text-ink-3"
            >
              Theme
            </th>
            {tracks.map((track) => (
              <th key={track.trackNumber} scope="col" className="p-0 font-normal" style={{ width: TRACK_COLUMN_PX }}>
                <Link
                  href={coherenceFixHref(albumId, { focus: "story", trackNumber: track.trackNumber })}
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
              <th scope="row" className="sticky left-0 z-10 bg-ground py-2.5 pr-4 text-left font-normal">
                <span className="block truncate font-semibold text-ink" title={row.label}>
                  {row.label}
                </span>
                <span className="type-figure block text-xs text-ink-3">
                  {row.trackNumbers.length
                    ? `${row.trackNumbers.length} of ${tracks.length} tracks`
                    : "On no track yet"}
                </span>
              </th>
              {row.presence.map((present, index) => (
                <td key={`${row.label}-${tracks[index]?.trackNumber ?? index}`} className="p-0 text-center">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mx-auto block h-3.5 w-3.5 rounded-sm",
                      present ? "bg-ink" : "border border-line-strong",
                    )}
                  />
                  <span className="sr-only">{present ? "Yes" : "No"}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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
      <div className="relative overflow-x-auto">
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
      </div>
      {graph.edges.length ? (
        <ul className="divide-y divide-line border-y border-line text-sm">
          {graph.edges.slice(0, 10).map((edge) => (
            <li key={`edge-${edge.character}-${edge.motif}`} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2">
              <span className="min-w-0 text-ink">
                {edge.character} <span className="text-ink-3">with</span> {edge.motif}
              </span>
              <span className="type-figure text-xs text-ink-3">Tracks {edge.trackNumbers.join(", ")}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function IssueRow({ albumId, issue }: { albumId: string; issue: BibleIssue }) {
  return (
    <li className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-6">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{issue.title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-ink-2">{issue.detail}</p>
      </div>
      {issue.fix ? (
        <Link
          href={coherenceFixHref(albumId, issue.fix)}
          className="inline-flex min-h-11 shrink-0 items-center gap-1 self-start text-sm font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink-3"
        >
          {issue.fix.focus === "style" ? "Open the Style bible" : "Fix in Studio"}
          <span className="sr-only">: {issue.title}</span>
        </Link>
      ) : null}
    </li>
  );
}

function IndexList({ entries, empty }: { entries: Array<{ name: string; trackNumbers: number[] }>; empty: string }) {
  if (!entries.length) return <p className="text-sm text-ink-2">{empty}</p>;
  return (
    <ul className="divide-y divide-line border-y border-line text-sm">
      {entries.slice(0, 14).map((entry) => (
        <li key={entry.name} className="flex items-baseline justify-between gap-3 py-2">
          <span className="min-w-0 truncate text-ink">{entry.name}</span>
          <span className="type-figure shrink-0 text-xs text-ink-3">
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
  const warnings = bible.issues.filter((issue) => issue.level === "warn");
  const notes = bible.issues.filter((issue) => issue.level === "info");
  const base = `/app/albums/${album.id}`;

  return (
    <div className="flex flex-col gap-10">
      <AlbumPageViewTracker albumId={album.id} event="album_bible_viewed" path={`${base}/bible`} />

      <Section
        id="bible-concept"
        title="Concept"
        actions={<BibleActions albumId={album.id} />}
      >
        {bible.conceptSummary ? (
          <p className="max-w-[68ch] text-base leading-relaxed text-ink-2">{bible.conceptSummary}</p>
        ) : (
          <p className="text-sm text-ink-2">
            No concept summary yet.{" "}
            <Link
              href={coherenceFixHref(album.id, { focus: "album" })}
              className="font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink-3"
            >
              Write the logline in the Studio
            </Link>
          </p>
        )}
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
        title="Needs attention"
        description={
          warnings.length
            ? `${warnings.length} ${warnings.length === 1 ? "warning" : "warnings"}, each linked to where it's fixed.`
            : "No warnings. The Bible gets sharper as you tag themes and write story notes."
        }
      >
        {warnings.length ? (
          <ul className="divide-y divide-line border-y border-line">
            {warnings.map((issue) => (
              <IssueRow key={`warn-${issue.title}`} albumId={album.id} issue={issue} />
            ))}
          </ul>
        ) : null}
        {notes.length ? (
          <details className="group mt-4">
            <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded border border-line-strong px-4 text-sm font-semibold text-ink hover:bg-hover">
              {`${notes.length} ${notes.length === 1 ? "note" : "notes"}`}
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
                    section.narrativeFunction ? `role: ${section.narrativeFunction}` : null,
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
                            story position {track.chronologicalOrder}
                          </span>
                        ) : null}
                      </h3>
                      <Link
                        href={coherenceFixHref(album.id, { focus: "story", trackNumber: track.trackNumber })}
                        className="inline-flex min-h-11 items-center gap-1 text-sm text-ink-2 hover:text-ink"
                      >
                        Edit story
                        <span className="sr-only">{` for ${track.title}`}</span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </div>
                    <p className={cn("text-sm leading-relaxed", track.narrativeSummary ? "text-ink-2" : "text-ink-3")}>
                      {track.narrativeSummary || "No story note yet."}
                    </p>
                    {tags.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {tags.map((tag, index) => (
                          <Chip key={`${track.trackNumber}-${tag}-${index}`}>{tag}</Chip>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-2 text-xs text-ink-3">{sections || "No sections yet."}</p>
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
        description="Who carries which motif, and where each one comes back."
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
              <IndexList entries={bible.motifIndex} empty="No motifs tagged yet." />
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
          <dd className="text-sm leading-relaxed text-ink-2">{bible.styleBible.lead_voice || "Not set yet."}</dd>
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
