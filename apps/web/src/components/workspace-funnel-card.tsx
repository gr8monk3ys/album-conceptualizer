import type { WorkspaceFunnelSummary } from "@/server/analytics";

const METRICS: Array<{
  key: keyof Pick<
    WorkspaceFunnelSummary,
    "projectsCreated" | "activatedAlbums" | "exportedAlbums" | "publishedAlbums"
  >;
  label: string;
  hint: string;
}> = [
  { key: "projectsCreated", label: "Created", hint: "New albums" },
  { key: "activatedAlbums", label: "Worked on", hint: "Opened in the Studio, Bible or Coherence report" },
  { key: "exportedAlbums", label: "Exported", hint: "Downloaded at least once" },
  { key: "publishedAlbums", label: "Published", hint: "Shared on Discover" },
];

/**
 * Album progress as one row of figures: how many albums reached each stage in the window.
 * Only album stages are shown; sign-up and checkout counts are for the people who run the
 * service, not for the artist.
 */
export function WorkspaceFunnelCard({ summary }: { summary: WorkspaceFunnelSummary }) {
  return (
    <section aria-labelledby="funnel-window-title" className="border-t border-line pt-6">
      <h2 id="funnel-window-title" className="text-lg font-semibold text-ink">
        Last {summary.windowDays} days
      </h2>
      <dl className="mt-4 grid grid-cols-2 gap-y-5 border-y border-line py-5 md:grid-cols-4 md:divide-x md:divide-line">
        {METRICS.map((metric) => (
          <div key={metric.key} className="min-w-0 pr-4 md:px-5 md:first:pl-0">
            <dt className="type-catalog text-xs text-ink-2">{metric.label}</dt>
            <dd className="type-figure mt-2 text-3xl font-semibold text-ink">
              {summary[metric.key]}
            </dd>
            <dd className="mt-1 text-xs text-ink-3">{metric.hint}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
