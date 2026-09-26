/**
 * Touch on a range slider: a finger that lands on it may be starting a scroll of the page, not
 * a drag of the slider. The slider only moves once the finger has clearly gone sideways; a
 * vertical swipe (or a tap) never changes its value.
 */

/** How far a finger travels before its direction counts, in px. */
export const SWIPE_INTENT_PX = 8;

export type SwipeIntent = "undecided" | "horizontal" | "vertical";

/** Which way a touch that has moved `dx`, `dy` from where it landed is going. */
export function swipeIntent(dx: number, dy: number, threshold = SWIPE_INTENT_PX): SwipeIntent {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return "undecided";
  return Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
}

/**
 * What a slider's wrapper does with a pointer pressed on it. Where the input takes pointer
 * events itself (`reachedInput`), it handles them natively. On a touch-first device (primary
 * pointer coarse) the input takes none, so everything reaches the wrapper: a touch moves the
 * slider only once it has gone sideways ("swipe"), while a mouse, trackpad or pen, which can't
 * be starting a scroll, drags it from where it pressed ("drag").
 */
export function sliderPointerStart(pointerType: string, reachedInput: boolean): "native" | "swipe" | "drag" {
  if (reachedInput) return "native";
  return pointerType === "touch" ? "swipe" : "drag";
}

/**
 * The value of a range slider under the point `x` (client px), given the track's box and the
 * thumb's width: the thumb's centre travels from `left + thumb / 2` to `right - thumb / 2`.
 * Clamped to `min`…`max` and rounded to a whole step of 1.
 */
export function rangeValueAt(
  x: number,
  track: { left: number; width: number },
  min: number,
  max: number,
  thumb = 16,
): number {
  const travel = Math.max(1, track.width - thumb);
  const ratio = Math.min(1, Math.max(0, (x - track.left - thumb / 2) / travel));
  return Math.round(min + ratio * (max - min));
}
