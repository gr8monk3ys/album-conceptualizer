"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { LiveStatus } from "@/components/ui";
import { takeArrival } from "@/lib/arrival-handoff";
import { cn } from "@/lib/utils";

function safeSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * The one line that says what just happened on arrival ("Restored …"), in an always-mounted
 * live region. The page renders it with its message, but the region mounts empty and the line
 * is filled in just after, so screen readers announce it: a region that appears already filled
 * is often read as nothing new.
 *
 * With `handoff`, the line is the one the previous screen left for this page
 * (`@/lib/arrival-handoff`, e.g. after a restore), read once and removed, so a reload doesn't
 * say it again. It never rides in the address: dropping a query parameter after the arrival
 * made the router restore its tree, and the route announcer read the page a second time.
 * With `takeFocus`, the line also takes focus when the arrival left it nowhere (the control
 * that navigated here is gone), as the create wizard's banner does. Then focus is what reads
 * it: the line is shown outside the live region, which stays empty, so it is heard once, not
 * once for the focus and again as a polite update.
 */
export function ArrivalStatus({
  message,
  tone = "ok",
  className,
  handoff = false,
  takeFocus = false,
}: {
  message?: string | null;
  tone?: "neutral" | "ok" | "danger";
  className?: string;
  handoff?: boolean;
  takeFocus?: boolean;
}) {
  const [shown, setShown] = useState<{ text: string; focus: boolean } | null>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    // A beat after the region is in the page, so assistive tech is listening when it fills.
    // The handoff is taken inside the timer, so an effect that is cleaned up before it fires
    // (a remount) leaves it for the next one.
    const timer = window.setTimeout(() => {
      const text =
        message ||
        (handoff ? takeArrival(safeSessionStorage(), window.location.pathname) : null);
      if (!text) {
        if (!handoff) setShown(null);
        return;
      }
      // Decided before the line appears, so the text goes to exactly one place.
      const active = document.activeElement;
      setShown({ text, focus: takeFocus && (!active || active === document.body) });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [message, handoff, takeFocus]);

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
