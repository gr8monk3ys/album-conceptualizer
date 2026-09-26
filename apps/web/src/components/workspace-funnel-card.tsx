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
      {/* Columns by the room the section has (a container query in rem, so enlarged text
          needs more): four figures side by side from 36rem, two from 16rem, one below that,
          so a long word in a hint ("Downloaded") never runs into the next column at 320px
          with 200% text. Should a word still be wider than its column, it wraps inside it. */}
      <div className="@container">
        <dl className="mt-4 grid grid-cols-1 gap-y-5 border-y border-line py-5 @[16rem]:grid-cols-2 @[36rem]:grid-cols-4 @[36rem]:divide-x @[36rem]:divide-line">
          {METRICS.map((metric) => (
            <div key={metric.key} className="min-w-0 pr-4 wrap-break-word @[36rem]:px-5 @[36rem]:first:pl-0">
              <dt className="type-catalog text-xs text-ink-2">{metric.label}</dt>
              <dd className="type-figure mt-2 text-3xl font-semibold text-ink">
                {summary[metric.key]}
              </dd>
              <dd className="mt-1 text-xs text-ink-3">{metric.hint}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
