"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";

import { ButtonLink, PRIMARY_ACTION_MARKER } from "@/components/ui";
import { useEdgeFade } from "@/components/use-edge-fade";
import { edgeFadeClass } from "@/lib/edge-fade";
import { cn } from "@/lib/utils";

/**
 * Six tabs, each named after what it opens ("Story bible" opens the Story bible, "Sound" the
 * Sound bible). A tab stays current on the screens it groups: Overview also covers the inbox
 * (opened from the Overview); Sound covers the Sound bible, references and demos, which have
 * their own second-level navigation. Version history is no tab's page: it opens from the
 * release header's catalog line, which marks itself current there, so no tab claims it.
 */
const TABS = [
  { segment: "", label: "Overview", covers: ["", "inbox"] },
  { segment: "studio", label: "Studio", covers: ["studio"] },
  { segment: "bible", label: "Story bible", covers: ["bible"] },
  { segment: "coherence", label: "Coherence", covers: ["coherence"] },
  { segment: "style", label: "Sound", covers: ["style", "references", "demos"] },
  { segment: "export", label: "Export", covers: ["export"] },
] as const;

/** The first path segment after /app/albums/<id>, or "" on the Overview. */
function useAlbumSegment(albumId: string) {
  const pathname = usePathname() ?? "";
  const base = `/app/albums/${albumId}`;
  return pathname.startsWith(`${base}/`) ? pathname.slice(base.length + 1).split("/")[0] : "";
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Scrolls the strip so the current tab sits in the middle, without `scrollIntoView`: that
 * also moves the document's sequential-focus starting point, so the first Tab would skip
 * the skip link and the header.
 */
function centerTab(scroller: HTMLElement, tab: HTMLElement) {
  const strip = scroller.getBoundingClientRect();
  const box = tab.getBoundingClientRect();
  const left = scroller.scrollLeft + (box.left - strip.left) - (scroller.clientWidth - box.width) / 2;
  const max = scroller.scrollWidth - scroller.clientWidth;
  scroller.scrollTo({
    left: Math.max(0, Math.min(max, left)),
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}

/**
 * One way around an album, the same on every album screen. Six tabs in one row on a hairline
 * when the album column has room (36rem, so enlarged text needs more); with less room they
 * form an even grid of ruled cells, three columns (3 + 3) while a column fits the longest
 * name, two (2 x 3) when narrower, and one only at extreme text sizes, so every tab is visible,
 * whole and lined up with the row above on a phone. Wrapped, nothing scrolls or fades: the
 * strip clips nothing, so no first letter or focus ring is masked. Names break between words
 * ("Story bible") and inside a word only if that word is wider than the whole column. Only
 * the one row can overflow (an unusually wide font): then the strip scrolls inside itself,
 * centres the current tab and fades the edge with more tabs, and only while it overflows.
 */
export function AlbumNav({ albumId }: { albumId: string }) {
  const segment = useAlbumSegment(albumId);
  const base = `/app/albums/${albumId}`;
  const scrollerRef = useRef<HTMLElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);
  // The strip fades at whichever edge has more tabs past it (the same cue as TableScroller).
  const fade = useEdgeFade(scrollerRef, "x");

  // Keep the current tab in view when the strip is narrower than its tabs.
  useEffect(() => {
    const el = scrollerRef.current;
    const tab = activeRef.current;
    if (!el || !tab || el.scrollWidth <= el.clientWidth + 1) return;
    centerTab(el, tab);
  }, [segment]);

  return (
    <div className="@container min-w-0">
      <nav
        ref={scrollerRef}
        aria-label="Album"
        // One row scrolls inside itself (min-w-0 keeps the strip from ever widening the page);
        // wrapped rows never overflow, so they neither scroll nor fade (the fade measures an
        // actual overflow, so it stays off there).
        className={cn("-mx-1 min-w-0 max-w-[calc(100%+0.5rem)] @xl:overflow-x-auto", edgeFadeClass(fade, "x"))}
      >
        {/* Wrapped, an even grid: equal columns (minmax(0,1fr)), so the second row's tabs sit
            under the first row's. The thresholds are rem, like the name they must fit:
            "Coherence" in semibold measures 4.44rem, plus 1rem of padding, so three columns
            need 16.3rem (17rem here) and two 10.9rem (11rem). */}
        <ul className="grid grid-cols-1 px-1 @min-[11rem]:grid-cols-2 @min-[17rem]:grid-cols-3 @xl:flex @xl:min-w-max @xl:gap-1 @xl:border-b @xl:border-line">
          {TABS.map((tab) => {
            const active = (tab.covers as readonly string[]).includes(segment);
            return (
              // Wrapped, each cell carries its own hairline, so every row is ruled.
              <li key={tab.label} className="min-w-0 border-b border-line @xl:flex-none @xl:border-b-0">
                <Link
                  ref={active ? activeRef : undefined}
                  href={tab.segment ? `${base}/${tab.segment}` : base}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    // The ring sits inside the tab so the scrolling strip doesn't clip it.
                    "-mb-px flex h-full min-h-11 items-center border-b-2 px-2 py-1 text-sm transition-colors focus-visible:-outline-offset-2 @xl:inline-flex @xl:px-3",
                    active
                      ? // Forced colors draw even transparent borders in the text colour, so
                        // there the current tab's underline turns Highlight and the idle tabs
                        // drop theirs, leaving the strip's own rule under them.
                        "border-accent font-semibold text-ink forced-colors:border-b-[Highlight]"
                      : "border-transparent text-ink-2 hover:border-line-strong hover:text-ink forced-colors:border-b-0",
                  )}
                >
                  {/* Breaks between words; inside a word only as a last resort, when that
                      word is wider than the whole column (break-words, not wrap-anywhere). */}
                  <span className="min-w-0 break-words">{tab.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** Screens that are about reading the album, where nothing on the page claims the saffron. */
const READING_SEGMENTS = new Set(["", "bible", "coherence"]);

/** The album body's content column: the header's next step looks here for a primary of its own. */
const ALBUM_CONTENT_ATTR = "data-album-content";

/** Whether `content` shows a primary action that is visible (not inside a closed disclosure). */
function showsPrimary(content: Element) {
  const candidates = content.querySelectorAll<HTMLElement>(
    `.${PRIMARY_ACTION_MARKER}, a.bg-accent, button.bg-accent`,
  );
  return Array.from(candidates).some((el) => el.getClientRects().length > 0);
}

/**
 * True while the album screen's own content shows a primary action. On the server it goes by
 * what the screen is known to hold (reading screens have none); in the browser it watches the
 * content, so a form that opens, or a page that changes what it offers, keeps exactly one
 * saffron on the screen.
 */
function useContentHasPrimary(segment: string, enabled: boolean) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const content = enabled ? document.querySelector(`[${ALBUM_CONTENT_ATTR}]`) : null;
      if (!content) return () => {};
      let frame = 0;
      const observer = new MutationObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(onChange);
      });
      observer.observe(content, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["class", "open", "hidden"],
      });
      return () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
      };
    },
    [enabled],
  );
  const serverGuess = !READING_SEGMENTS.has(segment);
  return useSyncExternalStore(
    subscribe,
    () => {
      const content = enabled ? document.querySelector(`[${ALBUM_CONTENT_ATTR}]`) : null;
      return content ? showsPrimary(content) : serverGuess;
    },
    () => serverGuess,
  );
}

type HeaderStep = { action: string; href: string };

function NextActionButton({ albumId, step, welcome }: { albumId: string; step: HeaderStep; welcome: boolean }) {
  const segment = useAlbumSegment(albumId);
  const pathname = usePathname() ?? "";
  const target = step.href.split("?")[0];
  // Nothing to point at from the screen it opens, and the Studio has its own track list.
  // The welcome banner on the Overview carries the same action.
  const hidden = pathname === target || segment === "studio" || (welcome && segment === "");
  const hasPrimary = useContentHasPrimary(segment, !hidden);
  if (hidden) return null;
  return (
    <ButtonLink href={step.href} tone={hasPrimary ? "secondary" : "primary"}>
      {step.action}
    </ButtonLink>
  );
}

function NextActionWithParams(props: { albumId: string; step: HeaderStep }) {
  const welcome = useSearchParams()?.get("welcome") === "1";
  return <NextActionButton {...props} welcome={welcome} />;
}

/**
 * The release header's one action, from the album's state (see `nextAlbumStep`). One rule
 * sets its weight on every album screen: it is the screen's saffron primary, unless the
 * screen's own content shows a primary action (Export's download, a Sound form), and then it
 * steps back to secondary so the screen still has exactly one.
 */
export function AlbumNextAction(props: { albumId: string; step: HeaderStep }) {
  return (
    <Suspense fallback={<NextActionButton {...props} welcome={false} />}>
      <NextActionWithParams {...props} />
    </Suspense>
  );
}

/**
 * The side column's width by the number of album themes, so the spine can head its theme
 * columns by name (`themeHeadClasses`: 15rem plus 3rem a theme, and 1rem more for a scrollbar)
 * wherever the album body has room. From 56rem the column is 22rem, the narrowest, where
 * three or more themes fall back to keys; from 64rem it widens to fit names for up to four
 * themes (28rem at most, leaving the content at least 33.5rem); from 72rem, for all six.
 * (Literal class names, so Tailwind generates them.)
 */
const SPINE_COLUMNS: Record<number, string> = {
  2: "@4xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] @6xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]",
  3: "@4xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] @5xl:grid-cols-[minmax(0,25rem)_minmax(0,1fr)]",
  4: "@4xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] @5xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]",
  5: "@4xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] @5xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] @6xl:grid-cols-[minmax(0,31rem)_minmax(0,1fr)]",
  6: "@4xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] @5xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] @6xl:grid-cols-[minmax(0,34rem)_minmax(0,1fr)]",
};

/**
 * The spine sits beside the content on large screens and folds into a "Sequence"
 * disclosure above it on smaller ones; on the Overview, the album's home, that disclosure
 * starts open so a phone shows the whole sequence. The Studio has its own editable track
 * list, so the spine is left out there.
 */
export function AlbumBody({
  spine,
  compactSpine,
  trackCount,
  themeCount = 0,
  children,
}: {
  spine: ReactNode;
  compactSpine: ReactNode;
  trackCount: number;
  /** The album's central themes shown in the spine (at most six): the side column fits their names. */
  themeCount?: number;
  children: ReactNode;
}) {
  const segment = usePathname()?.match(/\/app\/albums\/[^/]+\/([^/]+)/)?.[1] ?? "";
  const content = { [ALBUM_CONTENT_ATTR]: "" };
  if (segment === "studio")
    return (
      <div className="min-w-0" {...content}>
        {children}
      </div>
    );
  // The two columns are chosen by the room the album body actually has (a container query in
  // rem, so larger text needs more room), not by the viewport: with a sidebar open or text
  // scaled up, the spine folds into the disclosure instead of squeezing the content. 22rem
  // fits six theme marks beside an 8rem title and the "Lyrics" and "Role" heads (21rem was
  // 10px short, so the spine scrolled sideways); from 72rem the spine takes 24rem so titles
  // wrap less; with three or more themes it widens further so they are headed by name.
  const columns = SPINE_COLUMNS[Math.max(2, Math.min(6, themeCount))];
  return (
    <div className="@container min-w-0">
      <div className={cn("grid min-w-0 grid-cols-1 gap-6 @4xl:gap-10", columns)}>
        {/* Sticky just below the app header (at the top on a short screen, where the header
            scrolls away); the negative margin and padding line its top up with the content
            while keeping it clear of the header once it sticks. */}
        <aside className="hidden @4xl:sticky @4xl:top-header-offset @4xl:-mt-6 @4xl:block @4xl:max-h-[calc(100dvh-5rem)] @4xl:self-start @4xl:overflow-y-auto @4xl:pb-6 @4xl:pt-6">
          {spine}
        </aside>
        <div className="flex min-w-0 flex-col gap-6">
          <details className="@4xl:hidden" open={segment === ""}>
            {/* Wraps rather than overflowing a narrow column at enlarged text; the count keeps
                its separator with it. */}
            <summary className="inline-flex min-h-11 max-w-full cursor-pointer flex-wrap items-center gap-x-2 rounded border border-line-strong px-4 py-1 text-sm font-semibold text-ink transition-colors hover:bg-hover">
              Sequence
              <span className="whitespace-nowrap">
                <span aria-hidden="true" className="text-ink-3">
                  ·
                </span>{" "}
                <span className="type-figure font-normal text-ink-2">
                  {trackCount} {trackCount === 1 ? "track" : "tracks"}
                </span>
              </span>
            </summary>
            <div className="mt-3">{compactSpine}</div>
          </details>
          <div className="min-w-0" {...content}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
