import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { AlbumPageViewTracker } from "@/components/album-page-view-tracker";
import { CoherenceAiReview } from "@/components/coherence-ai-review";
import { Chip, Section } from "@/components/ui";
import {
  analyzeAlbumCoherence,
  coherenceFixHref,
  type CoherenceFix,
  type CoherenceIssueSeverity,
} from "@/server/coherence";
import { getAlbum } from "@/server/albums";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Album coherence",
  description: "How well the album's songs hold together against its concept, themes and motifs.",
};

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

export default async function CoherencePage({ params }: { params: Promise<{ albumId: string }> }) {
  const { albumId } = await params;
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const album = await getAlbum(workspace.id, albumId);
  if (!album) notFound();

  const report = analyzeAlbumCoherence(album.data);
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

  return (
    <div className="flex flex-col gap-10">
      <AlbumPageViewTracker
        albumId={album.id}
        event="album_coherence_viewed"
        path={`/app/albums/${album.id}/coherence`}
      />

      <Section id="coherence-summary" title="Coherence report" description={scored ? report.summary : undefined}>
        {scored ? (
          <div className="flex flex-col gap-6">
            <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="type-figure text-5xl font-semibold text-ink">
                {report.score}
                <span className="text-lg font-normal text-ink-3">/100</span>
              </span>
              <span className={`text-base font-semibold ${overall.className}`}>{overall.label}</span>
            </p>
          </div>
        ) : (
          <div className="flex max-w-[68ch] flex-col gap-3">
            <p className="text-base font-semibold text-ink">{report.summary}</p>
            <p className="text-sm leading-relaxed text-ink-2">
              Placeholder lines and the starting chord loop don&apos;t count. Still missing:
            </p>
            <ul className="divide-y divide-line border-y border-line">
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

      <Section
        id="coherence-next"
        title="Next actions"
        description="The highest-leverage fixes, each linked to where you make it."
      >
        {report.nextActions.length ? (
          <ol className="divide-y divide-line border-y border-line">
            {report.nextActions.map((action) => (
              <li key={action.id}>
                <Link
                  href={coherenceFixHref(album.id, action.fix)}
                  className="group flex min-h-11 items-start gap-4 py-3 pr-1 transition-colors hover:bg-hover"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{action.title}</span>
                      <Chip>{report.breakdown.find((item) => item.key === action.category)?.label}</Chip>
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-ink-2">{action.detail}</span>
                  </span>
                  <span className="mt-0.5 flex shrink-0 items-center gap-1 text-sm text-ink-2 group-hover:text-ink">
                    {fixLabel(action.fix)}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-ink-2">Nothing urgent. Every check is passing on this draft.</p>
        )}
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
              <span className="w-28 shrink-0 text-sm font-semibold text-ink">{item.label}</span>
              <span className="type-figure w-16 shrink-0 text-lg font-semibold text-ink">
                {scored ? (
                  <>
                    {item.score}
                    <span className="text-xs font-normal text-ink-3">/100</span>
                  </>
                ) : (
                  <span className="text-sm font-normal text-ink-3">Not yet</span>
                )}
              </span>
              <span className="min-w-0 flex-1 basis-64 text-sm leading-relaxed text-ink-2">{item.summary}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="coherence-findings"
        title="Findings"
        description={`${report.issues.length} ${report.issues.length === 1 ? "finding" : "findings"}, most serious first.`}
      >
        {report.issues.length ? (
          <ul className="divide-y divide-line border-y border-line">
            {report.issues.map((issue) => {
              const severity = SEVERITY[issue.severity];
              return (
                <li key={issue.id} className="flex flex-col gap-1.5 py-4 sm:flex-row sm:items-start sm:gap-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-ink">{issue.title}</h3>
                      <Chip tone={severity.tone}>{severity.label}</Chip>
                      <Chip>{report.breakdown.find((item) => item.key === issue.category)?.label}</Chip>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-ink-2">{issue.detail}</p>
                    {issue.suggestion ? (
                      <p className="mt-1 text-sm leading-relaxed text-ink-3">{issue.suggestion}</p>
                    ) : null}
                    {issue.relatedTracks?.length ? (
                      <p className="type-figure mt-1 text-xs text-ink-3">
                        {issue.relatedTracks.length === 1 ? "Track" : "Tracks"} {issue.relatedTracks.join(", ")}
                      </p>
                    ) : null}
                  </div>
                  {issue.fix ? (
                    <Link
                      href={coherenceFixHref(album.id, issue.fix)}
                      className="inline-flex min-h-11 shrink-0 items-center gap-1 self-start text-sm font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink-3"
                    >
                      {fixLabel(issue.fix)}
                      <span className="sr-only">: {issue.title}</span>
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-ink-2">No findings. The tracks hold together on this draft.</p>
        )}
      </Section>

      <CoherenceAiReview albumId={album.id} />
    </div>
  );
}
