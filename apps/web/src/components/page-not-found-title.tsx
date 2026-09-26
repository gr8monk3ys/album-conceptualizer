/** The tab title of every not-found screen, as the root layout's template writes it. */
export const PAGE_NOT_FOUND_TITLE = "Page not found · Album Conceptualizer";

/**
 * The not-found screen names itself in the tab (WCAG 2.4.2). The metadata is the main
 * mechanism: each not-found file exports `metadata`, each address that only exists to call
 * notFound() carries the same title (the `[...missing]` pages), and the page-title helpers
 * call notFound() for a missing album (server/page-titles.ts), so what the page hands the
 * tab after hydration is "Page not found" too. This element is the screen's own copy of it:
 * React 19 hoists a rendered <title> into the document head, so a not-found screen reached
 * some other way still carries its title with it.
 */
export function PageNotFoundTitle() {
  return <title>{PAGE_NOT_FOUND_TITLE}</title>;
}
