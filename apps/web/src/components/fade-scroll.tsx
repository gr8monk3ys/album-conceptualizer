"use client";

import { useRef, type ComponentProps, type FocusEvent } from "react";

import { useEdgeFade } from "@/components/use-edge-fade";
import { edgeFadeClass } from "@/lib/edge-fade";
import { fadeClearScrollLeft } from "@/lib/scroll-clear";
import { cn } from "@/lib/utils";

/** The vertical edge fade's depth, 2rem (`@/lib/edge-fade`), in px at the current root size. */
function fadeWidth() {
  const root = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return 2 * root;
}

/**
 * A column that scrolls on its own (the sidebar, the mobile navigation sheet) and fades the
 * edge with more of it past it, so a column taller than the window (a phone held sideways,
 * 200% text) says it scrolls. The same cue as TableScroller, vertically. The caller gives it
 * its overflow and size; the fade is only a mask, so nothing moves when it appears.
 */
export function FadeScroll({ className, onFocus, ...props }: ComponentProps<"div">) {
  const ref = useRef<HTMLDivElement | null>(null);
  const fade = useEdgeFade(ref, "y");
  // A focused item (Tab through the sidebar on a short window) is kept clear of the fades, as
  // TableScroller does sideways: the browser only scrolls it into view, under the fade.
  const keepFocusClear = (event: FocusEvent<HTMLDivElement>) => {
    onFocus?.(event);
    const column = ref.current;
    const target = event.target;
    if (!column || target === column || !(target instanceof HTMLElement)) return;
    // Only keyboard focus: a clicked link must not jump out from under the pointer.
    if (!target.matches(":focus-visible")) return;
    if (column.scrollHeight <= column.clientHeight + 1) return;
    const box = column.getBoundingClientRect();
    const item = target.getBoundingClientRect();
    const top = fadeClearScrollLeft({
      scrollLeft: column.scrollTop,
      viewport: column.clientHeight,
      content: column.scrollHeight,
      start: item.top - box.top - column.clientTop,
      width: item.height,
      margin: fadeWidth(),
    });
    if (top !== column.scrollTop) column.scrollTop = top;
  };
  return (
    <div
      ref={ref}
      data-edge-fade={fade === "none" ? undefined : fade}
      className={cn(className, edgeFadeClass(fade, "y"))}
      onFocus={keepFocusClear}
      {...props}
    />
  );
}
