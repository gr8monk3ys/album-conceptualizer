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
    <div className="rounded-2xl border border-line bg-raised p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-ink-3">Workspace funnel</div>
          <div className="mt-1 text-lg font-semibold tracking-tight text-ink">
            Last {summary.windowDays} days
          </div>
          <div className="mt-1 max-w-[62ch] text-sm text-ink-2">
            Measure whether projects are moving from creation to meaningful activation, export, and
            publishing.
          </div>
        </div>
        <Link
          href={href}
          className="rounded-full border border-line bg-raised px-3 py-2 text-xs font-semibold text-ink hover:bg-hover"
        >
          View analytics
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {METRICS.map((metric) => (
          <div
            key={metric.key}
            className="rounded-2xl border border-line bg-sunken p-4"
          >
            <div className="text-xs text-ink-3">{metric.label}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-ink">
              {summary[metric.key]}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 text-xs text-ink-3">
        Signups tracked: {summary.signups}. Billing checkouts started: {summary.checkoutStarts}.
      </div>
    </div>
  );
}
