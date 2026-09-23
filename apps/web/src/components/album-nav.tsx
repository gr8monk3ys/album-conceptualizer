"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { ButtonLink, PRIMARY_ACTION_MARKER } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Six tabs. A tab stays current on the screens it groups: Overview also covers the inbox
 * and version history (both opened from the Overview); Sound covers style, references and
 * demos, which have their own second-level navigation.
 */
const TABS = [
  { segment: "", label: "Overview", covers: ["", "inbox", "versions"] },
  { segment: "studio", label: "Studio", covers: ["studio"] },
  { segment: "bible", label: "Bible", covers: ["bible"] },
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

// The strip fades at whichever edge has more tabs past it. A mask, not a colour: the
// content itself goes transparent at the edge.
const EDGE_FADE = {
  none: "",
  start: "[mask-image:linear-gradient(to_right,transparent,black_1.5rem)]",
  end: "[mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)]",
  both: "[mask-image:linear-gradient(to_right,transparent,black_1.5rem,black_calc(100%-1.5rem),transparent)]",
} as const;

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
 * when the album column has room (32rem, so enlarged text needs more); with less room they
 * stack as a ruled grid of three, then two, columns, so every tab stays visible on a phone
 * rather than scrolling out of sight. If a row still can't fit (an unusually wide font), the
 * strip scrolls inside itself, centres the current tab and fades the edge with more tabs.
 */
export function AlbumNav({ albumId }: { albumId: string }) {
  const segment = useAlbumSegment(albumId);
  const base = `/app/albums/${albumId}`;
  const scrollerRef = useRef<HTMLElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);
  const [fade, setFade] = useState<keyof typeof EDGE_FADE>("none");

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const overflowing = el.scrollWidth > el.clientWidth + 1;
    if (!overflowing) return setFade("none");
    const atStart = el.scrollLeft <= 1;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
    setFade(atStart ? "end" : atEnd ? "start" : "both");
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // A ResizeObserver reports once as soon as it starts observing, which gives the first measure.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [measure]);

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
        // Scrolls inside itself: min-w-0 keeps the tab strip from ever widening the page.
        className={cn("-mx-1 min-w-0 max-w-[calc(100%+0.5rem)] overflow-x-auto", EDGE_FADE[fade])}
      >
        <ul className="grid grid-cols-2 px-1 @xs:grid-cols-3 @lg:flex @lg:min-w-max @lg:gap-1 @lg:border-b @lg:border-line">
          {TABS.map((tab) => {
            const active = (tab.covers as readonly string[]).includes(segment);
            return (
              // In the grid each tab carries its own hairline, so both rows are ruled.
              <li key={tab.label} className="min-w-0 border-b border-line @lg:border-b-0">
                <Link
                  ref={active ? activeRef : undefined}
                  href={tab.segment ? `${base}/${tab.segment}` : base}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    // The ring sits inside the tab so the scrolling strip doesn't clip it.
                    "-mb-px flex min-h-11 items-center break-words border-b-2 px-3 text-sm transition-colors hyphens-auto focus-visible:-outline-offset-2 @lg:inline-flex",
                    active
                      ? // Forced colors draw even transparent borders in the text colour, so
                        // there the current tab's underline turns Highlight and the idle tabs
                        // drop theirs, leaving the strip's own rule under them.
                        "border-accent font-semibold text-ink forced-colors:border-b-[Highlight]"
                      : "border-transparent text-ink-2 hover:border-line-strong hover:text-ink forced-colors:border-b-0",
                  )}
                >
                  {tab.label}
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
 * The spine sits beside the content on large screens and folds into a "Sequence"
 * disclosure above it on smaller ones; on the Overview, the album's home, that disclosure
 * starts open so a phone shows the whole sequence. The Studio has its own editable track
 * list, so the spine is left out there.
 */
export function AlbumBody({
  spine,
  compactSpine,
  trackCount,
  children,
}: {
  spine: ReactNode;
  compactSpine: ReactNode;
  trackCount: number;
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
  // wrap less.
  return (
    <div className="@container min-w-0">
      <div className="grid min-w-0 grid-cols-1 gap-6 @4xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] @4xl:gap-10 @6xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        {/* Sticky just below the app header; the negative margin and padding line its top up
            with the content while keeping it clear of the header once it sticks. */}
        <aside className="hidden @4xl:sticky @4xl:top-header @4xl:-mt-6 @4xl:block @4xl:max-h-[calc(100dvh-5rem)] @4xl:self-start @4xl:overflow-y-auto @4xl:pb-6 @4xl:pt-6">
          {spine}
        </aside>
        <div className="flex min-w-0 flex-col gap-6">
          <details className="@4xl:hidden" open={segment === ""}>
            <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded border border-line-strong px-4 text-sm font-semibold text-ink transition-colors hover:bg-hover">
              Sequence
              <span aria-hidden="true" className="text-ink-3">
                ·
              </span>
              <span className="type-figure font-normal text-ink-2">
                {trackCount} {trackCount === 1 ? "track" : "tracks"}
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
