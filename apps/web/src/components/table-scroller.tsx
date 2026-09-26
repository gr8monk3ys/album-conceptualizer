"use client";

import { useCallback, useRef, type ComponentProps, type FocusEvent } from "react";

import { useEdgeFade } from "@/components/use-edge-fade";
import { edgeFadeClass } from "@/lib/edge-fade";
import { fadeClearScrollLeft } from "@/lib/scroll-clear";
import { cn } from "@/lib/utils";

/** The edge fade's width, 1.5rem (`@/lib/edge-fade`), in px at the current root font size. */
function fadeWidth() {
  const root = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return 1.5 * root;
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
 */
export function TableScroller({
  label,
  className,
  ref,
  onFocus,
  ...props
}: ComponentProps<"div"> & { label: string }) {
  const own = useRef<HTMLDivElement | null>(null);
  const fade = useEdgeFade(own, "x");
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
      if (scroller.scrollWidth <= scroller.clientWidth + 1) return;
      const box = scroller.getBoundingClientRect();
      const item = target.getBoundingClientRect();
      const left = fadeClearScrollLeft({
        scrollLeft: scroller.scrollLeft,
        viewport: scroller.clientWidth,
        content: scroller.scrollWidth,
        start: item.left - box.left - scroller.clientLeft,
        width: item.width,
        margin: fadeWidth(),
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
      className={cn(
        "relative min-w-0 scroll-px-6 overflow-x-auto focus-visible:[mask-image:none]",
        edgeFadeClass(fade, "x"),
        className,
      )}
      {...props}
    />
  );
}
