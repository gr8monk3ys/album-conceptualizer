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
  if (score >= 85) return { label: "Excellent", className: "text-ok" };
  if (score >= 70) return { label: "Solid", className: "text-ink-2" };
  if (score >= 50) return { label: "Needs polish", className: "text-warn" };
  return { label: "Broken", className: "text-danger" };
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
          <div className="text-xs text-ink-3">Project</div>
          <div className="truncate text-2xl font-semibold tracking-tight text-ink">
            {album.title}
          </div>
          <div className="mt-1 text-sm text-ink-2">Coherence report v2</div>
          <div className="mt-3 max-w-[72ch] text-sm leading-relaxed text-ink-2">
            {report.summary}
          </div>
        </div>
        <Link
          href={`/app/albums/${album.id}`}
          className="rounded-full border border-line bg-raised px-4 py-2 text-xs font-semibold text-ink hover:bg-hover"
        >
          Back
        </Link>
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <CoherenceAiReview albumId={album.id} />
          <div className="rounded-2xl border border-line bg-raised p-4">
            <div className="text-xs text-ink-3">Overall score</div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div className="text-4xl font-semibold tracking-tight text-ink">
                {report.score}
                <span className="text-sm text-ink-3">/100</span>
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
                  className="rounded-2xl border border-line bg-sunken px-3 py-2"
                >
                  <div className="text-[11px] text-ink-3">{stat.label}</div>
                  <div className="mt-1 text-sm font-semibold text-ink">
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-raised p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-ink-3">Breakdown</div>
                <div className="text-sm font-semibold text-ink">
                  Narrative, lyrics, harmony, sequence, motifs
                </div>
              </div>
              <div className="text-xs text-ink-2">{report.breakdown.length} areas</div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {report.breakdown.map((item) => (
                <div
                  key={item.key}
                  className="rounded-2xl border border-line bg-sunken px-4 py-3"
                >
                  <div className="text-[11px] uppercase tracking-wide text-ink-3">
                    {item.label}
                  </div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                    {item.score}
                    <span className="text-xs text-ink-3">/100</span>
                  </div>
                  <div className="mt-2 text-xs leading-relaxed text-ink-2">
                    {item.summary}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-raised p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-ink-3">Findings</div>
                <div className="text-sm font-semibold text-ink">
                  Issues & suggestions
                </div>
              </div>
              <div className="text-xs text-ink-2">{report.issues.length} items</div>
            </div>

            <div className="mt-3 space-y-2">
              {report.issues.length ? (
                report.issues.map((issue) => (
                  <div
                    key={issue.id}
                    className="rounded-2xl border border-line bg-sunken px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-ink">
                        {issue.title}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="rounded-full bg-selected px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-3">
                          {issue.category}
                        </div>
                        <div
                          className={[
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                            issue.severity === "error"
                              ? "bg-danger-soft text-danger"
                              : issue.severity === "warning"
                                ? "bg-[rgba(255,202,40,0.16)] text-warn"
                                : "bg-selected text-ink-3",
                          ].join(" ")}
                        >
                          {issue.severity}
                        </div>
                      </div>
                    </div>
                    <div className="mt-1 text-sm text-ink-2">{issue.detail}</div>
                    {issue.relatedTracks?.length ? (
                      <div className="mt-2 text-xs text-ink-3">
                        Related tracks: {issue.relatedTracks.join(", ")}
                      </div>
                    ) : null}
                    {issue.suggestion ? (
                      <div className="mt-2 text-xs text-ink-3">
                        Suggestion: {issue.suggestion}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-line bg-sunken px-4 py-10 text-center text-sm text-ink-2">
                  No issues detected.
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-line bg-raised p-4">
            <div className="text-xs text-ink-3">Next actions</div>
            <div className="mt-1 text-sm font-semibold text-ink">
              Fix the highest-leverage issues next
            </div>
            <div className="mt-3 space-y-3">
              {report.nextActions.length ? (
                report.nextActions.map((action) => (
                  <Link
                    key={action.id}
                    href={actionHref(album.id, action.target)}
                    className="block rounded-2xl border border-line bg-sunken px-4 py-3 hover:bg-sunken"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-ink">
                        {action.title}
                      </div>
                      <div className="rounded-full bg-selected px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-3">
                        {action.target}
                      </div>
                    </div>
                    <div className="mt-2 text-xs leading-relaxed text-ink-2">
                      {action.detail}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-2xl border border-line bg-sunken px-4 py-10 text-center text-sm text-ink-2">
                  No immediate action items.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-raised p-4">
            <div className="text-xs text-ink-3">Coverage snapshot</div>
            <div className="mt-2 space-y-2 text-sm text-ink-2">
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
