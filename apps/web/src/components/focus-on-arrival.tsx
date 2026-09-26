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
    document.getElementById(targetId)?.focus({ preventScroll: false });
  }, [targetId]);
  return null;
}
