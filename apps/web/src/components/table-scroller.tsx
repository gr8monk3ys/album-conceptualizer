"use client";

import { useCallback, useRef, type ComponentProps } from "react";

import { useEdgeFade } from "@/components/use-edge-fade";
import { edgeFadeClass } from "@/lib/edge-fade";
import { cn } from "@/lib/utils";

/**
 * The one wrapper for a table wider than its column: it scrolls sideways inside itself (a
 * labelled, focusable region, so keyboard users can scroll it) and never widens the page.
 * `relative` is the point: screen-reader-only text in the table is absolutely positioned, and
 * without a positioned ancestor here it is placed against the page and escapes the scroller.
 *
 * When the table is wider than the region, the edge with more of it past it fades out (a
 * transparency mask, so nothing moves when the cue appears), updated as it scrolls and as it
 * or the table changes size. While the region itself has keyboard focus the fade steps aside,
 * because a mask would also clip its focus ring; the ring says it scrolls.
 */
export function TableScroller({ label, className, ref, ...props }: ComponentProps<"div"> & { label: string }) {
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
  return (
    <div
      ref={setRef}
      role="region"
      aria-label={label}
      tabIndex={0}
      data-edge-fade={fade === "none" ? undefined : fade}
      className={cn(
        "relative min-w-0 overflow-x-auto focus-visible:[mask-image:none]",
        edgeFadeClass(fade, "x"),
        className,
      )}
      {...props}
    />
  );
}
