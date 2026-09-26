"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

import { edgeFade, type EdgeFade } from "@/lib/edge-fade";

/**
 * Which edges of a scroller have more content past them (see `@/lib/edge-fade`), kept up to
 * date as it scrolls and as it or its content changes size (a window resize, text scaling,
 * a web font arriving, rows added). "none" until the first measure, so server and client
 * render the same markup and a scroller that fits never flashes a fade.
 */
export function useEdgeFade(ref: RefObject<HTMLElement | null>, axis: "x" | "y" = "x"): EdgeFade {
  const [fade, setFade] = useState<EdgeFade>("none");

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setFade(
      axis === "x"
        ? edgeFade(el.scrollLeft, el.clientWidth, el.scrollWidth)
        : edgeFade(el.scrollTop, el.clientHeight, el.scrollHeight),
    );
  }, [ref, axis]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // A ResizeObserver reports once as soon as it starts observing, which gives the first
    // measure. The children are observed too: content can grow while the scroller doesn't.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [ref, measure]);

  return fade;
}
