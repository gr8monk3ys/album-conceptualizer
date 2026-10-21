"use client";

import { useState, type ReactNode } from "react";

/**
 * Discover's Sort, Show and Genre selects. In a narrow form (below 40rem: a phone, enlarged
 * text) they fold into a "Filters" disclosure whose summary says what they are set to
 * ("Filters · Newest · Finished only"), so the list starts in the first screen; it starts
 * open when a filter is set. From 40rem the summary gives way and the selects always show.
 *
 * The disclosure is a `<details>` inside the page's GET form, so the selects submit the same
 * parameters open or closed, and it works without JavaScript. Wide, its content is shown with
 * `::details-content` whatever the open state; a browser without that pseudo-element keeps the
 * summary, so the filters are one click away there rather than hidden. Once the reader opens
 * or closes it, the choice stays across the form's own navigations.
 *
 * Needs an `@container/filters` ancestor (the form).
 */
export function DiscoverFilters({
  summary,
  defaultOpen,
  children,
}: {
  /** What the filters are set to, in order ("Newest", "Finished only"). */
  summary: string[];
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="mt-3 @min-[40rem]/filters:details-content:[content-visibility:visible]"
    >
      {/* Wraps rather than overflowing at enlarged text; like every catalog line, a separator
          ends the item before it, held to it by a word joiner. */}
      <summary className="inline-flex min-h-11 max-w-full cursor-pointer flex-wrap items-center gap-x-2 rounded border border-line-strong px-4 py-1 text-sm font-semibold text-ink transition-colors hover:bg-hover @min-[40rem]/filters:supports-[selector(::details-content)]:hidden">
        <span className="whitespace-nowrap">
          Filters{"⁠"}
          <span aria-hidden="true" className="ml-2 text-ink-3">
            ·
          </span>
        </span>
        {summary.map((item, index) => (
          <span key={item} className="min-w-0 break-words font-normal text-ink-2">
            {item}
            {index < summary.length - 1 ? (
              <>
                {"⁠"}
                <span aria-hidden="true" className="ml-2 text-ink-3">
                  ·
                </span>
              </>
            ) : null}
          </span>
        ))}
      </summary>
      <div className="mt-3 @min-[40rem]/filters:mt-0">{children}</div>
    </details>
  );
}
