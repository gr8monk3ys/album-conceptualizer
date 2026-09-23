"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { ButtonLink } from "@/components/ui";
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

/** One way around an album, the same on every album screen. */
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
    if (!el || el.scrollWidth <= el.clientWidth + 1) return;
    activeRef.current?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [segment]);

  return (
    <nav
      ref={scrollerRef}
      aria-label="Album"
      // Scrolls inside itself: min-w-0 keeps the tab strip from ever widening the page.
      className={cn("-mx-1 min-w-0 max-w-[calc(100%+0.5rem)] overflow-x-auto", EDGE_FADE[fade])}
    >
      <ul className="flex min-w-max gap-1 border-b border-line px-1">
        {TABS.map((tab) => {
          const active = (tab.covers as readonly string[]).includes(segment);
          return (
            <li key={tab.label}>
              <Link
                ref={active ? activeRef : undefined}
                href={tab.segment ? `${base}/${tab.segment}` : base}
                aria-current={active ? "page" : undefined}
                className={cn(
                  // The ring sits inside the tab so the scrolling strip doesn't clip it.
                  "-mb-px inline-flex min-h-11 items-center border-b-2 px-3 text-sm transition-colors focus-visible:-outline-offset-2",
                  active
                    ? "border-accent font-semibold text-ink"
                    : "border-transparent text-ink-2 hover:border-line-strong hover:text-ink",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Screens that are about reading the album, where the next step is the screen's one primary action. */
const READING_SEGMENTS = new Set(["", "bible", "coherence"]);

type HeaderStep = { action: string; href: string };

function NextActionButton({ albumId, step, welcome }: { albumId: string; step: HeaderStep; welcome: boolean }) {
  const segment = useAlbumSegment(albumId);
  const pathname = usePathname() ?? "";
  const target = step.href.split("?")[0];
  // Nothing to point at from the screen it opens, and the Studio has its own track list.
  if (pathname === target || segment === "studio") return null;
  // The welcome banner on the Overview carries the same action.
  if (welcome && segment === "") return null;
  return (
    <ButtonLink href={step.href} tone={READING_SEGMENTS.has(segment) ? "primary" : "secondary"}>
      {step.action}
    </ButtonLink>
  );
}

function NextActionWithParams(props: { albumId: string; step: HeaderStep }) {
  const welcome = useSearchParams()?.get("welcome") === "1";
  return <NextActionButton {...props} welcome={welcome} />;
}

/**
 * The release header's one action, from the album's state (see `nextAlbumStep`). It is the
 * primary action on reading screens and a secondary one where the screen has its own.
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
 * disclosure above it on smaller ones. The Studio has its own editable track list, so the
 * spine is left out there.
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
  if (segment === "studio") return <div className="min-w-0">{children}</div>;
  // The two columns are chosen by the room the album body actually has (a container query in
  // rem, so larger text needs more room), not by the viewport: with a sidebar open or text
  // scaled up, the spine folds into the disclosure instead of squeezing the content.
  return (
    <div className="@container min-w-0">
      <div className="grid min-w-0 grid-cols-1 gap-6 @4xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] @4xl:gap-10">
        {/* Sticky just below the app header; the negative margin and padding line its top up
            with the content while keeping it clear of the header once it sticks. */}
        <aside className="hidden @4xl:sticky @4xl:top-header @4xl:-mt-6 @4xl:block @4xl:max-h-[calc(100dvh-5rem)] @4xl:self-start @4xl:overflow-y-auto @4xl:pb-6 @4xl:pt-6">
          {spine}
        </aside>
        <div className="flex min-w-0 flex-col gap-6">
          <details className="@4xl:hidden">
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
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
