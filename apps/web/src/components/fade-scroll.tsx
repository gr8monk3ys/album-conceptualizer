"use client";

import { useRef, type ComponentProps } from "react";

import { useEdgeFade } from "@/components/use-edge-fade";
import { edgeFadeClass } from "@/lib/edge-fade";
import { cn } from "@/lib/utils";

/**
 * A column that scrolls on its own (the sidebar, the mobile navigation sheet) and fades the
 * edge with more of it past it, so a column taller than the window (a phone held sideways,
 * 200% text) says it scrolls. The same cue as TableScroller, vertically. The caller gives it
 * its overflow and size; the fade is only a mask, so nothing moves when it appears.
 */
export function FadeScroll({ className, ...props }: ComponentProps<"div">) {
  const ref = useRef<HTMLDivElement | null>(null);
  const fade = useEdgeFade(ref, "y");
  return (
    <div
      ref={ref}
      data-edge-fade={fade === "none" ? undefined : fade}
      className={cn(className, edgeFadeClass(fade, "y"))}
      {...props}
    />
  );
}
