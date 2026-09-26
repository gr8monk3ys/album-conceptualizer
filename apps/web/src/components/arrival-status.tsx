"use client";

import { useEffect, useRef, useState } from "react";

import { LiveStatus } from "@/components/ui";

/**
 * The one line that says what just happened on arrival ("Restored …"), in an always-mounted
 * live region. The page renders it with its message, but the region mounts empty and the line
 * is filled in just after, so screen readers announce it: a region that appears already filled
 * is often read as nothing new.
 *
 * `param` names the query parameter that carried the arrival (`restored`): once the line is
 * shown it is dropped from the address, so a reload or a later refresh doesn't say it again.
 * With `takeFocus`, the line also takes focus when the arrival left it nowhere (the control
 * that navigated here is gone), as the create wizard's banner does.
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
  const [shown, setShown] = useState<string | null>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // A beat after the region is in the page, so assistive tech is listening when it fills.
    const timer = window.setTimeout(() => {
      setShown(message);
      if (!message) return;
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
  }, [message, param]);

  // Once the line is in the page (and focusable), it takes focus if nothing else has it.
  useEffect(() => {
    if (!takeFocus || !shown) return;
    const active = document.activeElement;
    if (!active || active === document.body) lineRef.current?.focus();
  }, [shown, takeFocus]);
  return (
    // Idle, it is out of the flow (zero size), so it adds no gap to the column it sits in.
    <div ref={lineRef} tabIndex={takeFocus && shown ? -1 : undefined} className={shown ? className : "absolute"}>
      <LiveStatus message={shown} tone={tone} />
    </div>
  );
}
