"use client";

import { useCallback, useInsertionEffect, useRef } from "react";

/**
 * A handler whose identity never changes but which always runs the latest render's code, so a
 * memoized child (the track list, the story editor) isn't re-rendered just because the Studio
 * re-created its callbacks on a keystroke. For event handlers only: it must not be called
 * during render.
 */
export function useStableEvent<Args extends unknown[], Result>(
  handler: (...args: Args) => Result,
): (...args: Args) => Result {
  const ref = useRef(handler);
  // Before layout effects, so anything a layout effect triggers already sees the new handler.
  useInsertionEffect(() => {
    ref.current = handler;
  });
  return useCallback((...args: Args) => ref.current(...args), []);
}

/** Whether two objects agree on the given keys (by identity), for memo comparators. */
export function sameKeys<T extends object>(prev: T, next: T, keys: readonly (keyof T)[]): boolean {
  return keys.every((key) => Object.is(prev[key], next[key]));
}
