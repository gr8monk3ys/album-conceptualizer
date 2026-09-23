import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { AlbumPageViewTracker } from "@/components/album-page-view-tracker";
import { CoherenceAiReview } from "@/components/coherence-ai-review";
import { Chip, Section } from "@/components/ui";
import {
  analyzeAlbumCoherence,
  coherenceFixHref,
  coherenceTrackHref,
  type CoherenceFix,
  type CoherenceIssue,
  type CoherenceIssueSeverity,
  type CoherenceReport,
} from "@/server/coherence";
import { getAlbum } from "@/server/albums";
import { getAgentAvailability } from "@/server/engine";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Album coherence",
  description: "How well the album's songs hold together against its concept, themes and motifs.",
};

/** The findings that get the emphasis: the most serious first. */
const LEAD_FINDINGS = 3;

function verdict(score: number) {
  if (score >= 85) return { label: "Tight", className: "text-ok" };
  if (score >= 70) return { label: "Solid", className: "text-ink-2" };
  if (score >= 50) return { label: "Needs polish", className: "text-warn" };
  return { label: "Loose", className: "text-danger" };
}

const SEVERITY: Record<CoherenceIssueSeverity, { label: string; tone: "danger" | "warn" | "neutral" }> = {
  error: { label: "Blocking", tone: "danger" },
  warning: { label: "Warning", tone: "warn" },
  info: { label: "Note", tone: "neutral" },
};

function fixLabel(fix: CoherenceFix | undefined) {
  return fix?.focus === "style" ? "Open the Style bible" : "Fix in Studio";
}

/** What a track link opens, for its accessible name: "Track 3 themes". */
const TRACK_LINK_SUFFIX: Record<string, string> = {
  song: "",
  story: " story",
  "song-themes": " themes",
  motifs: " motifs",
};

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
  const tracks = issue.relatedTracks ?? [];
  const suffix = TRACK_LINK_SUFFIX[issue.trackFocus ?? "song"] ?? "";
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
        {tracks.length > 1 ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1">
            <span className="mr-1 text-xs text-ink-3">Tracks</span>
            {tracks.map((trackNumber) => (
              <Link
                key={trackNumber}
                href={coherenceTrackHref(albumId, issue, trackNumber)}
                className="type-figure inline-grid min-h-11 min-w-11 place-items-center rounded-sm text-sm font-semibold text-ink-2 underline decoration-line-strong underline-offset-4 transition-colors hover:bg-hover hover:text-ink"
              >
                <span className="sr-only">Track </span>
                {trackNumber}
                {suffix ? <span className="sr-only">{suffix}</span> : null}
              </Link>
            ))}
          </div>
        ) : tracks.length === 1 ? (
          <p className="type-figure mt-1 text-xs text-ink-3">Track {tracks[0]}</p>
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

export default async function CoherencePage({ params }: { params: Promise<{ albumId: string }> }) {
  const { albumId } = await params;
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const album = await getAlbum(workspace.id, albumId);
  if (!album) notFound();

  const report = analyzeAlbumCoherence(album.data);
  const aiAvailable = await getAgentAvailability();
  const scored = !report.insufficient;
  const overall = verdict(report.score);
  const { stats } = report;
  const figures = [
    { label: "Tracks", value: stats.songCount },
    { label: "With lyrics", value: stats.songsWithLyrics },
    { label: "With chords", value: stats.songsWithChords },
    { label: "With a story note", value: stats.songsWithNarrativeSummary },
    { label: "On an album theme", value: stats.songsAlignedToThemes },
    { label: "Motifs that return", value: stats.callbackMotifs },
  ];
  // A level badge only tells findings apart when they aren't all the same level.
  const showSeverity = new Set(report.issues.map((issue) => issue.severity)).size > 1;
  const lead = report.issues.slice(0, LEAD_FINDINGS);
  const rest = report.issues.slice(LEAD_FINDINGS);

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
            <span className={`text-base font-semibold ${overall.className}`}>{overall.label}</span>
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="max-w-[65ch] text-base font-semibold text-ink">{report.summary}</p>
            <p className="max-w-[65ch] text-sm leading-relaxed text-ink-2">
              Placeholder lines and the starting chord loop don&apos;t count. Still missing:
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
          scored
            ? "Each dimension scored out of 100."
            : "Scores appear once enough lyrics are written. Until then, here is what each dimension still needs."
        }
      >
        <ul className="divide-y divide-line border-y border-line">
          {report.breakdown.map((item) => (
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
              <span className="min-w-0 max-w-[65ch] flex-1 basis-64 text-sm leading-relaxed text-ink-2">
                {item.summary}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <CoherenceAiReview albumId={album.id} aiAvailable={aiAvailable} />
    </div>
  );
}
