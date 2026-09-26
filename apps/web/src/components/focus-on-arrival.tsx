"use client";

import { useLayoutEffect } from "react";

/**
 * Arrivals Say Where You Are: after a client navigation that replaced the control the person
 * was on (the create wizard's "Save and continue"), focus would fall to the page. This moves
 * it to the element that says what happened, once, and only while focus has nowhere better to
 * be (it never pulls focus away from something the person already moved to).
 */
export function FocusOnArrival({ targetId }: { targetId: string }) {
  useLayoutEffect(() => {
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const target = document.getElementById(targetId);
    if (!target) return;
    // A new page starts at its top, so the release title above the line is on screen: the
    // client navigation keeps the scroll the wizard was at. Only when the line itself would
    // then be below the fold (a phone) does the page scroll, just far enough to show it.
    target.focus({ preventScroll: true });
    const bottom = target.getBoundingClientRect().bottom + window.scrollY;
    if (bottom <= window.innerHeight) window.scrollTo({ top: 0 });
    else target.scrollIntoView({ block: "nearest" });
  }, [targetId]);
  return null;
}
