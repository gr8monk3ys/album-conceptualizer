"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { LiveStatus } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * The one line that says what just happened on arrival ("Restored …"), in an always-mounted
 * live region. The page renders it with its message, but the region mounts empty and the line
 * is filled in just after, so screen readers announce it: a region that appears already filled
 * is often read as nothing new.
 *
 * `param` names the query parameter that carried the arrival (`restored`): once the line is
 * shown it is dropped from the address, so a reload or a later refresh doesn't say it again.
 * With `takeFocus`, the line also takes focus when the arrival left it nowhere (the control
 * that navigated here is gone), as the create wizard's banner does. Then focus is what reads
 * it: the line is shown outside the live region, which stays empty, so it is heard once, not
 * once for the focus and again as a polite update.
 */
export function ArrivalStatus({
  message,
  tone = "ok",
  className,
  param,
  takeFocus = false,
}: {
  message: string | null;
  tone?: "neutral" | "ok" | "danger";
  className?: string;
  param?: string;
  takeFocus?: boolean;
}) {
  const [shown, setShown] = useState<{ text: string; focus: boolean } | null>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    // A beat after the region is in the page, so assistive tech is listening when it fills.
    const timer = window.setTimeout(() => {
      if (!message) {
        setShown(null);
        return;
      }
      // Decided before the line appears, so the text goes to exactly one place.
      const active = document.activeElement;
      setShown({ text: message, focus: takeFocus && (!active || active === document.body) });
      if (param) {
        const url = new URL(window.location.href);
        if (url.searchParams.has(param)) {
          url.searchParams.delete(param);
          // `null` state syncs the Next.js router, so its next refresh keeps the new address.
          window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
        }
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [message, param, takeFocus]);

  // Once the line is in the page (and focusable), it takes focus if nothing else has it yet.
  useLayoutEffect(() => {
    if (!shown?.focus) return;
    const active = document.activeElement;
    if (!active || active === document.body) lineRef.current?.focus();
  }, [shown]);

  const focused = shown?.focus ? shown.text : null;
  const color = tone === "ok" ? "text-ok" : tone === "danger" ? "text-danger" : "text-ink-2";
  return (
    // Idle, it is out of the flow (zero size), so it adds no gap to the column it sits in.
    <div className={shown ? className : "absolute"}>
      <LiveStatus message={focused ? null : (shown?.text ?? null)} tone={tone} />
      {focused ? (
        <p ref={lineRef} tabIndex={-1} className={cn("text-sm", color)}>
          {focused}
        </p>
      ) : null}
    </div>
  );
}
