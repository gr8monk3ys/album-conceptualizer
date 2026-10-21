/**
 * Focus comes back after async work. When an action finishes on a screen that stays (a
 * confirm closes, a trigger is swapped for what it made, the route refreshes), focus has
 * usually just been dropped: the element that held it was removed, so the document's active
 * element is the body. `holdFocus` puts it on a sensible element (the trigger, or whatever
 * replaced it) and keeps watching for a moment, because a `router.refresh()` that lands a frame
 * later can replace that element too.
 *
 * It only ever acts while focus is lost (on the body, nowhere, or on an element that has been
 * removed), so it never takes focus away from something the person moved to, and it stops as
 * soon as they press a pointer.
 */

/** Anything that can take focus. `isConnected` is false once it has left the document. */
export type Focusable = { focus: (options?: FocusOptions) => void; isConnected?: boolean };

export type FocusHoldEnv = {
  activeElement: () => unknown;
  body: () => unknown;
  now: () => number;
  frame: (callback: () => void) => number;
  cancelFrame: (id: number) => void;
  /** Subscribe to the person pressing a pointer; returns the unsubscribe. */
  onPointerDown: (callback: () => void) => () => void;
};

/** How long after the commit a refresh may still replace the element (a server round trip). */
export const FOCUS_HOLD_MS = 3000;

/** Whether nothing meaningful has focus: the body, nothing, or an element no longer in the page. */
export function focusIsLost(active: unknown, body: unknown): boolean {
  if (active == null || active === body) return true;
  return (active as { isConnected?: boolean }).isConnected === false;
}

/**
 * Focus `resolve()` now if focus is lost, and again on any frame within `duration` in which
 * focus is lost (the element is resolved afresh each time, so a replaced element is found).
 * Returns a function that stops watching.
 */
export function holdFocus(
  resolve: () => Focusable | null | undefined,
  env: FocusHoldEnv,
  duration = FOCUS_HOLD_MS,
): () => void {
  const start = env.now();
  let frameId: number | null = null;
  let stopped = false;

  const reclaim = () => {
    if (!focusIsLost(env.activeElement(), env.body())) return;
    const target = resolve();
    if (target && target.isConnected !== false) target.focus();
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (frameId !== null) env.cancelFrame(frameId);
    unsubscribe();
  };

  const tick = () => {
    frameId = null;
    if (stopped) return;
    if (env.now() - start > duration) {
      stop();
      return;
    }
    reclaim();
    frameId = env.frame(tick);
  };

  const unsubscribe = env.onPointerDown(stop);
  reclaim();
  frameId = env.frame(tick);
  return stop;
}

/** The browser's environment for `holdFocus`. */
export function browserFocusEnv(): FocusHoldEnv {
  return {
    activeElement: () => document.activeElement,
    body: () => document.body,
    now: () => performance.now(),
    frame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (id) => cancelAnimationFrame(id),
    onPointerDown: (callback) => {
      document.addEventListener("pointerdown", callback, true);
      return () => document.removeEventListener("pointerdown", callback, true);
    },
  };
}
