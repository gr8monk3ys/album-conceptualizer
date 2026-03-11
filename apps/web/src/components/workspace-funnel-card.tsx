import Link from "next/link";

import type { WorkspaceFunnelSummary } from "@/server/analytics";

const METRICS: Array<{
  key: keyof Pick<
    WorkspaceFunnelSummary,
    "projectsCreated" | "activatedAlbums" | "exportedAlbums" | "publishedAlbums"
  >;
  label: string;
}> = [
  { key: "projectsCreated", label: "Created" },
  { key: "activatedAlbums", label: "Activated" },
  { key: "exportedAlbums", label: "Exported" },
  { key: "publishedAlbums", label: "Published" },
];

export function WorkspaceFunnelCard({
  summary,
  href = "/app/settings/analytics",
}: {
  summary: WorkspaceFunnelSummary;
  href?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-[var(--muted2)]">Workspace funnel</div>
          <div className="mt-1 text-lg font-semibold tracking-tight text-[var(--text)]">
            Last {summary.windowDays} days
          </div>
          <div className="mt-1 max-w-[62ch] text-sm text-[var(--muted)]">
            Measure whether projects are moving from creation to meaningful activation, export, and
            publishing.
          </div>
        </div>
        <Link
          href={href}
          className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
        >
          View analytics
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {METRICS.map((metric) => (
          <div
            key={metric.key}
            className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] p-4"
          >
            <div className="text-xs text-[var(--muted2)]">{metric.label}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)]">
              {summary[metric.key]}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 text-xs text-[var(--muted2)]">
        Signups tracked: {summary.signups}. Billing checkouts started: {summary.checkoutStarts}.
      </div>
    </div>
  );
}
