"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { browserFocusEnv, holdFocus, type Focusable } from "@/lib/focus-hold";

/**
 * Focus comes back after async work. Call the returned function in the same update that
 * closes a confirm or swaps a trigger, passing a resolver for where focus belongs
 * (`() => triggerRef.current`). After React commits that update, in a layout effect (so the
 * new element and its ref exist), focus goes there if it was dropped to the page body, and
 * keeps going back there for a moment if a `router.refresh()` replaces the element later.
 * It never takes focus from something the person moved to.
 */
export function useReturnFocus() {
  const pending = useRef<(() => Focusable | null | undefined) | null>(null);
  const [request, setRequest] = useState(0);

  useLayoutEffect(() => {
    const resolve = pending.current;
    if (!resolve) return;
    pending.current = null;
    return holdFocus(resolve, browserFocusEnv());
  }, [request]);

  return useCallback((resolve: () => Focusable | null | undefined) => {
    pending.current = resolve;
    setRequest((count) => count + 1);
  }, []);
}
