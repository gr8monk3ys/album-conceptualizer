import Link from "next/link";
import { notFound } from "next/navigation";

import { AlbumPageViewTracker } from "@/components/album-page-view-tracker";
import { CoherenceAiReview } from "@/components/coherence-ai-review";
import { analyzeAlbumCoherence } from "@/server/coherence";
import { getAlbum } from "@/server/albums";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Coherence Report",
  description: "Inspect narrative and musical coherence across album tracks and sections.",
};

function scoreLabel(score: number) {
  if (score >= 85) return { label: "Excellent", className: "text-[var(--ok)]" };
  if (score >= 70) return { label: "Solid", className: "text-[rgba(255,255,255,0.9)]" };
  if (score >= 50) return { label: "Needs polish", className: "text-[var(--warn)]" };
  return { label: "Broken", className: "text-[var(--bad)]" };
}

function actionHref(albumId: string, target: "album" | "bible" | "studio") {
  if (target === "bible") return `/app/albums/${albumId}/bible`;
  if (target === "studio") return `/app/albums/${albumId}/studio`;
  return `/app/albums/${albumId}`;
}

export default async function CoherencePage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const { albumId } = await params;
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const album = await getAlbum(workspace.id, albumId);
  if (!album) notFound();

  const report = analyzeAlbumCoherence(album.data);
  const verdict = scoreLabel(report.score);

  return (
    <div className="flex flex-col gap-6">
      <AlbumPageViewTracker
        albumId={album.id}
        event="album_coherence_viewed"
        path={`/app/albums/${album.id}/coherence`}
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs text-[var(--muted2)]">Project</div>
          <div className="truncate text-2xl font-semibold tracking-tight text-[var(--text)]">
            {album.title}
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">Coherence report v2</div>
          <div className="mt-3 max-w-[72ch] text-sm leading-relaxed text-[var(--muted)]">
            {report.summary}
          </div>
        </div>
        <Link
          href={`/app/albums/${album.id}`}
          className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
        >
          Back
        </Link>
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <CoherenceAiReview albumId={album.id} />
          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="text-xs text-[var(--muted2)]">Overall score</div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div className="text-4xl font-semibold tracking-tight text-[var(--text)]">
                {report.score}
                <span className="text-sm text-[var(--muted2)]">/100</span>
              </div>
              <div className={`text-sm font-semibold ${verdict.className}`}>{verdict.label}</div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: "Tracks", value: report.stats.songCount },
                { label: "Sections", value: report.stats.sectionCount },
                { label: "Theme-aligned", value: report.stats.songsAlignedToThemes },
                { label: "Callback motifs", value: report.stats.callbackMotifs },
                { label: "Keys", value: report.stats.uniqueKeys },
                { label: "Tempos", value: report.stats.uniqueTempos },
                { label: "Themes", value: report.stats.uniqueThemes },
                { label: "Motifs", value: report.stats.uniqueMotifs },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-3 py-2"
                >
                  <div className="text-[11px] text-[var(--muted2)]">{stat.label}</div>
                  <div className="mt-1 text-sm font-semibold text-[var(--text)]">
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-[var(--muted2)]">Breakdown</div>
                <div className="text-sm font-semibold text-[var(--text)]">
                  Narrative, lyrics, harmony, sequence, motifs
                </div>
              </div>
              <div className="text-xs text-[var(--muted)]">{report.breakdown.length} areas</div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {report.breakdown.map((item) => (
                <div
                  key={item.key}
                  className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-4 py-3"
                >
                  <div className="text-[11px] uppercase tracking-wide text-[var(--muted2)]">
                    {item.label}
                  </div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)]">
                    {item.score}
                    <span className="text-xs text-[var(--muted2)]">/100</span>
                  </div>
                  <div className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
                    {item.summary}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-[var(--muted2)]">Findings</div>
                <div className="text-sm font-semibold text-[var(--text)]">
                  Issues & suggestions
                </div>
              </div>
              <div className="text-xs text-[var(--muted)]">{report.issues.length} items</div>
            </div>

            <div className="mt-3 space-y-2">
              {report.issues.length ? (
                report.issues.map((issue) => (
                  <div
                    key={issue.id}
                    className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-[var(--text)]">
                        {issue.title}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="rounded-full bg-[rgba(255,255,255,0.10)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted2)]">
                          {issue.category}
                        </div>
                        <div
                          className={[
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                            issue.severity === "error"
                              ? "bg-[rgba(255,72,72,0.16)] text-[var(--bad)]"
                              : issue.severity === "warning"
                                ? "bg-[rgba(255,202,40,0.16)] text-[var(--warn)]"
                                : "bg-[rgba(255,255,255,0.10)] text-[var(--muted2)]",
                          ].join(" ")}
                        >
                          {issue.severity}
                        </div>
                      </div>
                    </div>
                    <div className="mt-1 text-sm text-[var(--muted)]">{issue.detail}</div>
                    {issue.relatedTracks?.length ? (
                      <div className="mt-2 text-xs text-[var(--muted2)]">
                        Related tracks: {issue.relatedTracks.join(", ")}
                      </div>
                    ) : null}
                    {issue.suggestion ? (
                      <div className="mt-2 text-xs text-[var(--muted2)]">
                        Suggestion: {issue.suggestion}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-4 py-10 text-center text-sm text-[var(--muted)]">
                  No issues detected.
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="text-xs text-[var(--muted2)]">Next actions</div>
            <div className="mt-1 text-sm font-semibold text-[var(--text)]">
              Fix the highest-leverage issues next
            </div>
            <div className="mt-3 space-y-3">
              {report.nextActions.length ? (
                report.nextActions.map((action) => (
                  <Link
                    key={action.id}
                    href={actionHref(album.id, action.target)}
                    className="block rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-4 py-3 hover:bg-[rgba(0,0,0,0.24)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-[var(--text)]">
                        {action.title}
                      </div>
                      <div className="rounded-full bg-[rgba(255,255,255,0.10)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted2)]">
                        {action.target}
                      </div>
                    </div>
                    <div className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
                      {action.detail}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-4 py-10 text-center text-sm text-[var(--muted)]">
                  No immediate action items.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="text-xs text-[var(--muted2)]">Coverage snapshot</div>
            <div className="mt-2 space-y-2 text-sm text-[var(--muted)]">
              <div>
                Lyrics on {report.stats.songsWithLyrics}/{report.stats.songCount} tracks
              </div>
              <div>
                Chords on {report.stats.songsWithChords}/{report.stats.songCount} tracks
              </div>
              <div>
                Narrative summaries on {report.stats.songsWithNarrativeSummary}/{report.stats.songCount} tracks
              </div>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
