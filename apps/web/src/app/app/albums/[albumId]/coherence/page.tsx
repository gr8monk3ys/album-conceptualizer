import Link from "next/link";
import { notFound } from "next/navigation";

import { analyzeAlbumCoherence } from "@/server/coherence";
import { getAlbum } from "@/server/albums";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";

function scoreLabel(score: number) {
  if (score >= 85) return { label: "Excellent", className: "text-[var(--ok)]" };
  if (score >= 70) return { label: "Solid", className: "text-[rgba(255,255,255,0.9)]" };
  if (score >= 50) return { label: "Needs polish", className: "text-[var(--warn)]" };
  return { label: "Broken", className: "text-[var(--bad)]" };
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs text-[var(--muted2)]">Project</div>
          <div className="truncate text-2xl font-semibold tracking-tight text-[var(--text)]">
            {album.title}
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">Coherence report</div>
        </div>
        <Link
          href={`/app/albums/${album.id}`}
          className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
        >
          Back
        </Link>
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
          <div className="text-xs text-[var(--muted2)]">Score</div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="text-4xl font-semibold tracking-tight text-[var(--text)]">
              {report.score}
              <span className="text-sm text-[var(--muted2)]">/100</span>
            </div>
            <div className={`text-sm font-semibold ${verdict.className}`}>{verdict.label}</div>
          </div>
          <div className="mt-3 text-sm text-[var(--muted)]">{report.summary}</div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              { label: "Tracks", value: report.stats.songCount },
              { label: "Sections", value: report.stats.sectionCount },
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
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[var(--text)]">
                      {issue.title}
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
                  <div className="mt-1 text-sm text-[var(--muted)]">{issue.detail}</div>
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
      </section>
    </div>
  );
}

