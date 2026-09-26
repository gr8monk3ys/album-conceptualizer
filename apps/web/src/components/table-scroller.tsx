"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ComponentProps,
  type FocusEvent,
  type RefObject,
} from "react";

import { useEdgeFade } from "@/components/use-edge-fade";
import { EDGE_SLACK_PX, edgeFadeClass } from "@/lib/edge-fade";
import { fadeClearScrollLeft } from "@/lib/scroll-clear";
import { cn } from "@/lib/utils";

/** The edge fade's width, 1.5rem (`@/lib/edge-fade`), in px at the current root font size. */
function fadeWidth() {
  const root = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return 1.5 * root;
}

/**
 * How far the sticky cells of `row` reach in from the scroller's visible left edge (the Story
 * bible's Theme column), skipping any cell that holds `skip`. 0 when the row has none.
 */
function stickyCover(row: Element, visibleLeft: number, skip?: HTMLElement): number {
  let cover = 0;
  for (const cell of Array.from(row.children)) {
    if (!(cell instanceof HTMLElement) || (skip && cell.contains(skip))) continue;
    if (getComputedStyle(cell).position !== "sticky") continue;
    cover = Math.max(cover, cell.getBoundingClientRect().right - visibleLeft);
  }
  return Math.max(0, cover);
}

/**
 * How far a sticky cell in the focused item's row reaches in from the scroller's visible left
 * edge, so focus scrolling keeps the item clear of it. 0 when the row has none, or the item is
 * itself in the sticky cell.
 */
function stickyStartCover(target: HTMLElement, visibleLeft: number): number {
  const row = target.closest("tr");
  return row ? stickyCover(row, visibleLeft, target) : 0;
}

/**
 * The part of the table that must be in view when `target` has focus: the target itself, plus
 * any cell of its row marked `data-keep-in-view` (the spine's track number, which names the
 * row a focused title belongs to), so focus scrolling never slides that cell under the fade.
 */
function focusExtent(target: HTMLElement): { left: number; right: number } {
  const box = target.getBoundingClientRect();
  let left = box.left;
  let right = box.right;
  const row = target.closest("tr");
  if (row) {
    for (const cell of Array.from(row.querySelectorAll<HTMLElement>(":scope > [data-keep-in-view]"))) {
      const rect = cell.getBoundingClientRect();
      left = Math.min(left, rect.left);
      right = Math.max(right, rect.right);
    }
  }
  return { left, right };
}

/**
 * The width of the table's sticky first column (0 when it has none, or it isn't sticky at this
 * size), measured from the first row and kept up to date as the region or the table changes
 * size. The start fade begins after it (`--sticky-start` in `@/lib/edge-fade`), so the column
 * that stays put to name the rows is never faded out.
 */
function useStickyStart(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const row = el.querySelector("tr");
      const visibleLeft = el.getBoundingClientRect().left + el.clientLeft;
      // Rounded, so sub-pixel jitter never re-renders.
      setWidth(row ? Math.round(stickyCover(row, visibleLeft)) : 0);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/**
 * The one wrapper for a table wider than its column: it scrolls sideways inside itself (a
 * labelled, focusable region, so keyboard users can scroll it) and never widens the page.
 * `relative` is the point: screen-reader-only text in the table is absolutely positioned, and
 * without a positioned ancestor here it is placed against the page and escapes the scroller.
 *
 * When the table is wider than the region, the edge with more of it past it fades out (a
 * transparency mask, so nothing moves when the cue appears), updated as it scrolls and as it
 * or the table changes size. While the region itself has keyboard focus the fade steps aside,
 * because a mask would also clip its focus ring; the ring says it scrolls. When focus moves to
 * something inside the table (a title link at the far edge), the region scrolls it fully into
 * view and at least the fade's width clear of each edge, so the fade never covers what has
 * focus (`scroll-px-6` asks the browser for the same margin when it scrolls to focus itself).
 * A sticky first column (the Theme map's) is left out of the start fade and out of the room
 * focus scrolling counts on, and a row's `data-keep-in-view` cell comes into view with it.
 */
export function TableScroller({
  label,
  className,
  ref,
  onFocus,
  style,
  ...props
}: ComponentProps<"div"> & { label: string }) {
  const own = useRef<HTMLDivElement | null>(null);
  const fade = useEdgeFade(own, "x");
  const stickyStart = useStickyStart(own);
  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      own.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  const keepFocusClear = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      onFocus?.(event);
      const scroller = own.current;
      const target = event.target;
      if (!scroller || target === scroller || !(target instanceof HTMLElement)) return;
      if (scroller.scrollWidth <= scroller.clientWidth + EDGE_SLACK_PX) return;
      const box = scroller.getBoundingClientRect();
      const item = focusExtent(target);
      const left = fadeClearScrollLeft({
        scrollLeft: scroller.scrollLeft,
        viewport: scroller.clientWidth,
        content: scroller.scrollWidth,
        start: item.left - box.left - scroller.clientLeft,
        width: item.right - item.left,
        margin: fadeWidth(),
        stickyStart: stickyStartCover(target, box.left + scroller.clientLeft),
      });
      if (left !== scroller.scrollLeft) scroller.scrollLeft = left;
    },
    [onFocus],
  );

  return (
    <div
      ref={setRef}
      role="region"
      aria-label={label}
      tabIndex={0}
      data-edge-fade={fade === "none" ? undefined : fade}
      onFocus={keepFocusClear}
      style={stickyStart > 0 ? ({ ...style, "--sticky-start": `${stickyStart}px` } as CSSProperties) : style}
      className={cn(
        "relative min-w-0 scroll-px-6 overflow-x-auto focus-visible:[mask-image:none]",
        edgeFadeClass(fade, "x"),
        className,
      )}
      {...props}
    />
  );
}
