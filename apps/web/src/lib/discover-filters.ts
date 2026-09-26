// The Discover filters' disclosure on a narrow screen: what its summary says and whether it
// starts open.

import { DEFAULT_DISCOVER_VIEW, DISCOVER_SHOWS, DISCOVER_SORTS, type DiscoverView } from "@/lib/discover";

type FilterView = Pick<DiscoverView, "sort" | "show" | "genre">;

/** Whether any filter differs from the plain view (a sort, "Finished only", a genre). */
export function hasActiveDiscoverFilters(view: FilterView): boolean {
  return view.sort !== DEFAULT_DISCOVER_VIEW.sort || view.show !== DEFAULT_DISCOVER_VIEW.show || Boolean(view.genre);
}

/**
 * What the collapsed filters are set to, for the disclosure's summary ("Filters · Newest ·
 * Finished only · Folk"): the sort always, so the list's order is never a guess; then only
 * the filters that narrow the list.
 */
export function discoverFilterSummary(view: FilterView): string[] {
  const sort = DISCOVER_SORTS.find((option) => option.value === view.sort)?.label ?? DISCOVER_SORTS[0].label;
  const show =
    view.show !== DEFAULT_DISCOVER_VIEW.show
      ? (DISCOVER_SHOWS.find((option) => option.value === view.show)?.label ?? null)
      : null;
  return [sort, show, view.genre?.trim() || null].filter((item): item is string => Boolean(item));
}
