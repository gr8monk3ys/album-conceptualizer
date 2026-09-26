import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { AlbumPageViewTracker } from "@/components/album-page-view-tracker";
import { CoherenceAiReview } from "@/components/coherence-ai-review";
import { Chip, Section } from "@/components/ui";
import {
  analyzeAlbumCoherence,
  COHERENCE_BANDS,
  coherenceFixHref,
  coherenceTrackHref,
  dimensionsWeakestFirst,
  MIN_WRITTEN_TRACKS_FOR_SCORE,
  type CoherenceFix,
  type CoherenceIssue,
  type CoherenceIssueSeverity,
  type CoherenceReport,
  type CoherenceVerdict,
} from "@/server/coherence";
import { getAlbum } from "@/server/albums";
import { getCredits } from "@/server/credits";
import { getAgentAvailability } from "@/server/engine";
import { requireUser } from "@/server/identity";
import { albumPageTitle, workspaceAlbumTitle } from "@/server/page-titles";
import { effectivePlan } from "@/server/plan";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
/** "Coherence · <album title>" in the browser tab and history. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ albumId: string }>;
}): Promise<Metadata> {
  const { albumId } = await params;
  const albumTitle = await workspaceAlbumTitle(albumId);
  // A missing album renders the not-found screen, so its tab says so too (WCAG 2.4.2).
  if (!albumTitle) return { title: "Page not found" };
  return {
    title: albumPageTitle("Coherence", albumTitle),
    description: "How well the album's songs hold together against its concept, themes and motifs.",
  };
}

/** The findings that get the emphasis: the most serious first. */
const LEAD_FINDINGS = 3;

const VERDICT_CLASS: Record<CoherenceVerdict["tone"], string> = {
  ok: "text-ok",
  neutral: "text-ink-2",
  warn: "text-warn",
  danger: "text-danger",
};

/** Nothing in the report blocks an export, so the top level says what it means: fix it first. */
const SEVERITY: Record<CoherenceIssueSeverity, { label: string; tone: "danger" | "warn" | "neutral" }> = {
  error: { label: "Fix first", tone: "danger" },
  warning: { label: "Warning", tone: "warn" },
  info: { label: "Note", tone: "neutral" },
};

function fixLabel(fix: CoherenceFix | undefined) {
  return fix?.focus === "style" ? "Open the Style bible" : "Fix in Studio";
}

/** What a track link opens, for its accessible name: "Track 3 story note". */
const TRACK_LINK_SUFFIX: Record<string, string> = {
  song: "",
  lyrics: " lyrics",
  story: " story note",
  role: " role",
  "song-themes": " themes",
  motifs: " motifs",
};

const TRACK_LINK =
  "type-figure inline-grid min-h-11 min-w-11 place-items-center rounded-sm text-sm font-semibold text-ink-2 underline decoration-line-strong underline-offset-4 transition-colors hover:bg-hover hover:text-ink";

/** Track numbers as links in a catalog line: "1 · 4 · 7". */
function TrackLinks({ albumId, issue, tracks }: { albumId: string; issue: CoherenceIssue; tracks: number[] }) {
  const suffix = TRACK_LINK_SUFFIX[issue.trackFocus ?? "song"] ?? "";
  return (
    <>
      {tracks.map((trackNumber, index) => (
        <span key={trackNumber} className="inline-flex items-center">
          <Link href={coherenceTrackHref(albumId, issue, trackNumber)} className={TRACK_LINK}>
            <span className="sr-only">Track </span>
            {trackNumber}
            {suffix ? <span className="sr-only">{suffix}</span> : null}
          </Link>
          {/* Each number is a 44px target, so a comma would float in the gap; a catalog dot
              sits in it naturally. Screen readers hear "Track 1, Track 4" from the links. */}
          {index < tracks.length - 1 ? (
            <span aria-hidden="true" className="text-ink-3">
              ·
            </span>
          ) : null}
        </span>
      ))}
    </>
  );
}

/** A finding: what's wrong, how to fix it, and a link to every track it names. */
function Finding({
  albumId,
  issue,
  report,
  showSeverity,
  lead,
}: {
  albumId: string;
  issue: CoherenceIssue;
  report: CoherenceReport;
  showSeverity: boolean;
  lead: boolean;
}) {
  const severity = SEVERITY[issue.severity];
  const dimension = report.breakdown.find((item) => item.key === issue.category)?.label;
  const tracks = (issue.relatedTracks ?? []).slice().sort((left, right) => left - right);
  const suggested = (issue.suggestedTracks ?? []).slice().sort((left, right) => left - right);
  return (
    <li className={cn("flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-6", lead ? "py-5" : "py-4")}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={cn("min-w-0 break-words font-semibold text-ink", lead ? "text-base" : "text-sm")}>
            {issue.title}
          </h3>
          {showSeverity ? <Chip tone={severity.tone}>{severity.label}</Chip> : null}
          {dimension ? <Chip>{dimension}</Chip> : null}
        </div>
        <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-ink-2">{issue.detail}</p>
        {issue.suggestion ? (
          <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-ink-3">{issue.suggestion}</p>
        ) : null}
        {/* Tracks with the problem and tracks suggested for a fix read differently. */}
        {tracks.length > 1 ? (
          <p className="mt-2 flex flex-wrap items-center gap-y-1">
            <span className="mr-2 text-xs text-ink-3">On tracks</span>
            <TrackLinks albumId={albumId} issue={issue} tracks={tracks} />
          </p>
        ) : tracks.length === 1 ? (
          <p className="type-figure mt-1 text-xs text-ink-3">On track {tracks[0]}</p>
        ) : null}
        {suggested.length ? (
          <p className="mt-2 flex flex-wrap items-center gap-y-1">
            <span className="mr-2 text-xs text-ink-3">
              Suggestion: try it on {suggested.length === 1 ? "track" : "tracks"}
            </span>
            <TrackLinks albumId={albumId} issue={issue} tracks={suggested} />
          </p>
        ) : null}
      </div>
      {issue.fix ? (
        <Link
          href={coherenceFixHref(albumId, issue.fix)}
          className="inline-flex min-h-11 min-w-0 items-center gap-1 self-start text-sm font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink-3"
        >
          {fixLabel(issue.fix)}
          <span className="sr-only">: {issue.title}</span>
        </Link>
      ) : null}
    </li>
  );
}

const DIMENSION_HELP: Array<{ label: string; text: string }> = [
  {
    label: "Narrative",
    text: "The album's concept summary, a story note on every track, tracks that carry the album's themes, and an opener and closer that frame the record.",
  },
  {
    label: "Lyrics",
    text: "How many tracks have lyrics of their own, and whether they have choruses to hook on.",
  },
  {
    label: "Harmony",
    text: "Chords of each track's own, a key and a tempo on every track, and more than one key across the album.",
  },
  {
    label: "Sequence",
    text: "One number per track, at least two sections per song, variety in tempo and section patterns, and the bookends.",
  },
  {
    label: "Motifs",
    text: "The album's motifs and the motif tags on its tracks, and whether at least one comes back on a second track.",
  },
];

/** Plain words on how the report scores, for anyone wondering why a number is what it is. */
function HowScored({ report }: { report: CoherenceReport }) {
  const { songCount, songsWithLyrics } = report.stats;
  const capExample =
    !report.insufficient && songsWithLyrics < songCount
      ? `with ${songsWithLyrics} of ${songCount} tracks written, as now, no dimension can score above ${report.scoreCap}`
      : "with 3 of 7 tracks written, no dimension can score above 43";
  const bands = COHERENCE_BANDS.map((band, index) => {
    const upper = index === 0 ? null : COHERENCE_BANDS[index - 1].min - 1;
    return `${band.label} ${upper === null ? `${band.min} and up` : band.min === 0 ? `below ${upper + 1}` : `${band.min} to ${upper}`}`;
  });
  return (
    <details className="mt-6">
      <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded border border-line-strong px-4 text-sm font-semibold text-ink transition-colors hover:bg-hover">
        How this is scored
      </summary>
      <div className="mt-4 flex max-w-[65ch] flex-col gap-4 text-sm leading-relaxed text-ink-2">
        <p>
          The report reads the album as it stands. Placeholder lines like &ldquo;[Verse line 1]&rdquo; and
          the starter chord loop the setup writes don&apos;t count as written: a track counts once it has
          words, or chords, of its own.
        </p>
        <p>
          It gives a score once {MIN_WRITTEN_TRACKS_FOR_SCORE} tracks have lyrics (a one-track album needs
          only its track). Each dimension is scored out of 100:
        </p>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[7rem_minmax(0,1fr)]">
          {DIMENSION_HELP.map((item) => (
            <div key={item.label} className="contents">
              <dt className="font-semibold text-ink">{item.label}</dt>
              <dd>{item.text}</dd>
            </div>
          ))}
        </dl>
        <p>
          No dimension scores above the share of tracks that have lyrics: {capExample}. Harmony also
          scores no higher than the share of tracks with chords of their own, on the written tracks as
          well as the whole album. While a score is held down, its row says what lifts it, and under that
          what the written tracks score on their own; the rows run weakest first by that second number.
          The overall score weighs Narrative most, then Lyrics, Harmony, Sequence and Motifs.
        </p>
        <p>
          <span className="font-semibold text-ink">Unfinished</span> means at least one track still has no
          lyrics, whatever the score; the label says how many are written. Once every track is written the
          score gets a band: {bands.join(", ")}.
        </p>
      </div>
    </details>
  );
}

export default async function CoherencePage({ params }: { params: Promise<{ albumId: string }> }) {
  const { albumId } = await params;
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const album = await getAlbum(workspace.id, albumId);
  if (!album) notFound();

  const report = analyzeAlbumCoherence(album.data);
  const [aiAvailable, credits] = await Promise.all([
    getAgentAvailability(),
    getCredits({ workspaceId: workspace.id, plan: effectivePlan(workspace.subscription) }),
  ]);
  const scored = !report.insufficient;
  const overall = report.verdict;
  const { stats } = report;
  const figures = [
    { label: "Tracks", value: stats.songCount },
    { label: "Lyrics written", value: stats.songsWithLyrics },
    { label: "With chords of their own", value: stats.songsWithChords },
    { label: "With a story note", value: stats.songsWithNarrativeSummary },
    { label: "On an album theme", value: stats.songsAlignedToThemes },
    { label: "Motifs that return", value: stats.callbackMotifs },
  ];
  // A level badge only tells findings apart when they aren't all the same level.
  const showSeverity = new Set(report.issues.map((issue) => issue.severity)).size > 1;
  const lead = report.issues.slice(0, LEAD_FINDINGS);
  const rest = report.issues.slice(LEAD_FINDINGS);
  // Weakest first by each dimension's own value, so the weak spot leads even while the cap
  // holds every score at the same number.
  const dimensions = dimensionsWeakestFirst(report.breakdown);
  const anyHeld = scored && dimensions.some((item) => item.heldBecause);
  const partlyWritten = stats.songsWithLyrics < stats.songCount;

  return (
    <div className="flex flex-col gap-10">
      <AlbumPageViewTracker
        albumId={album.id}
        event="album_coherence_viewed"
        path={`/app/albums/${album.id}/coherence`}
      />

      <Section id="coherence-summary" title="Coherence report" description={scored ? report.summary : undefined}>
        {scored ? (
          <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="type-figure text-5xl font-semibold text-ink">
              {report.score}
              <span className="text-lg font-normal text-ink-3">/100</span>
            </span>
            <span className={`text-base font-semibold ${VERDICT_CLASS[overall.tone]}`}>
              {overall.label}
              {overall.detail ? <span className="type-figure font-normal"> · {overall.detail}</span> : null}
            </span>
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="max-w-[65ch] text-base font-semibold text-ink">{report.summary}</p>
            <p className="max-w-[65ch] text-sm leading-relaxed text-ink-2">
              Placeholder lines and the starter chord loop don&apos;t count. Still missing:
            </p>
            <ul className="max-w-[65ch] divide-y divide-line border-y border-line">
              {report.missing.map((piece) => (
                <li key={piece.id}>
                  <Link
                    href={coherenceFixHref(album.id, piece.fix)}
                    className="group flex min-h-11 items-center justify-between gap-3 py-2 pr-1 text-sm text-ink transition-colors hover:bg-hover"
                  >
                    <span className="min-w-0">{piece.label}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-ink-3 group-hover:text-ink" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
          {figures.map((figure) => (
            <div key={figure.label} className="flex flex-col">
              <dt className="text-xs text-ink-3">{figure.label}</dt>
              <dd className="type-figure text-xl font-semibold text-ink">{figure.value}</dd>
            </div>
          ))}
        </dl>

        <HowScored report={report} />
      </Section>

      {/* The most serious findings, not a second list: the rest follow in the disclosure. */}
      <Section
        id="coherence-next"
        title="Next actions"
        description={
          report.issues.length
            ? `The ${lead.length === 1 ? "most serious finding" : `${lead.length} most serious findings`}, each linked to where you fix ${lead.length === 1 ? "it" : "them"}.`
            : undefined
        }
      >
        {lead.length ? (
          <ul className="divide-y divide-line border-y border-line">
            {lead.map((issue) => (
              <Finding
                key={issue.id}
                albumId={album.id}
                issue={issue}
                report={report}
                showSeverity={showSeverity}
                lead
              />
            ))}
          </ul>
        ) : (
          <p className="max-w-[65ch] text-sm text-ink-2">
            Nothing to fix. Every check is passing on this draft.
          </p>
        )}
        {rest.length ? (
          <details className="mt-6">
            <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded border border-line-strong px-4 text-sm font-semibold text-ink transition-colors hover:bg-hover">
              {rest.length === 1 ? "1 more finding" : `${rest.length} more findings`}
            </summary>
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {rest.map((issue) => (
                <Finding
                  key={issue.id}
                  albumId={album.id}
                  issue={issue}
                  report={report}
                  showSeverity={showSeverity}
                  lead={false}
                />
              ))}
            </ul>
          </details>
        ) : null}
      </Section>

      <Section
        id="coherence-breakdown"
        title="By dimension"
        description={
          !scored
            ? "Scores appear once enough lyrics are written. Until then, here is what each dimension still needs."
            : anyHeld && partlyWritten
              ? "Each dimension out of 100, weakest first by what the written tracks show on their own."
              : "Each dimension scored out of 100, weakest first."
        }
      >
        <ul className="divide-y divide-line border-y border-line">
          {dimensions.map((item) => {
            const held = scored && item.heldBecause;
            return (
              <li key={item.key} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 py-3">
                <span className="min-w-0 basis-28 text-sm font-semibold text-ink">{item.label}</span>
                <span className="type-figure min-w-0 basis-16 text-lg font-semibold text-ink">
                  {scored ? (
                    <>
                      {item.score}
                      <span className="text-xs font-normal text-ink-3">/100</span>
                    </>
                  ) : (
                    <span className="text-sm font-normal text-ink-3">Not yet</span>
                  )}
                </span>
                {scored && item.lever ? (
                  // One plain sentence naming what lifts the score; the evidence (and, while the
                  // score is held, what the written tracks score alone) sits under it as detail.
                  // The rule itself is in "How this is scored".
                  <span className="min-w-0 max-w-[65ch] flex-1 basis-64 text-sm leading-relaxed text-ink-2">
                    <span className="block">{item.lever}</span>
                    <span className="type-figure mt-0.5 block text-xs text-ink-3">
                      {held
                        ? `${item.signal}. ${partlyWritten ? `The written tracks alone score ${item.uncapped}.` : `On its own it scores ${item.uncapped}.`}`
                        : item.summary}
                    </span>
                  </span>
                ) : (
                  <span className="min-w-0 max-w-[65ch] flex-1 basis-64 text-sm leading-relaxed text-ink-2">
                    {item.summary}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      <CoherenceAiReview albumId={album.id} aiAvailable={aiAvailable} creditsRemaining={credits.remaining} />
    </div>
  );
}
