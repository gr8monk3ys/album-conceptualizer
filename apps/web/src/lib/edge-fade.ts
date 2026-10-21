/**
 * The scroll cue for anything that scrolls inside itself (a table, the album tab strip, the
 * sidebar): the edge that has more content past it fades out. A transparency mask, not a
 * colour, so the content itself dissolves at the edge whatever sits behind it, and nothing
 * moves when the cue comes or goes (a mask never takes layout space).
 */
export type EdgeFade = "none" | "start" | "end" | "both";

/**
 * How close to an end a scroller must be to count as at that end, in px: a pixel of slack
 * absorbs sub-pixel rounding, so a strip that exactly fits never shows a fade. The one
 * threshold for "at the end": `@/lib/scroll-clear` uses it too, so focus scrolling that stops
 * at an end always leaves that end without a fade.
 */
export const EDGE_SLACK_PX = 1;

/** Whether a scroller at `offset` is at its start (no fade there). */
export function atScrollStart(offset: number): boolean {
  return offset <= EDGE_SLACK_PX;
}

/** Whether a scroller at `offset` is at its end (no fade there). */
export function atScrollEnd(offset: number, viewport: number, content: number): boolean {
  return offset + viewport >= content - EDGE_SLACK_PX;
}

/**
 * Which edges have more content past them. `offset` is the scroll position (scrollLeft or
 * scrollTop), `viewport` the visible size (clientWidth or clientHeight), `content` the full
 * size (scrollWidth or scrollHeight).
 */
export function edgeFade(offset: number, viewport: number, content: number): EdgeFade {
  if (content <= viewport + EDGE_SLACK_PX) return "none";
  const atStart = atScrollStart(offset);
  const atEnd = atScrollEnd(offset, viewport, content);
  if (atStart && atEnd) return "none";
  if (atStart) return "end";
  if (atEnd) return "start";
  return "both";
}

// Literal class names, so Tailwind generates them. The fade is 1.5rem across (2rem down the
// sidebar), in rem so it grows with the text it covers. Along x the start fade begins after
// `--sticky-start` (a sticky first column's width, which `TableScroller` measures; 0 when there
// is none), so a column that stays put while the rest scrolls under it is never faded.
const FADE_X: Record<EdgeFade, string> = {
  none: "",
  start:
    "[mask-image:linear-gradient(to_right,black_var(--sticky-start,0px),transparent_var(--sticky-start,0px),black_calc(var(--sticky-start,0px)_+_1.5rem))]",
  end: "[mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)]",
  both: "[mask-image:linear-gradient(to_right,black_var(--sticky-start,0px),transparent_var(--sticky-start,0px),black_calc(var(--sticky-start,0px)_+_1.5rem),black_calc(100%-1.5rem),transparent)]",
};

const FADE_Y: Record<EdgeFade, string> = {
  none: "",
  start: "[mask-image:linear-gradient(to_bottom,transparent,black_2rem)]",
  end: "[mask-image:linear-gradient(to_bottom,black_calc(100%-2rem),transparent)]",
  both: "[mask-image:linear-gradient(to_bottom,transparent,black_2rem,black_calc(100%-2rem),transparent)]",
};

/** The mask class for a fade along the horizontal (`x`) or vertical (`y`) axis. */
export function edgeFadeClass(fade: EdgeFade, axis: "x" | "y" = "x") {
  return (axis === "x" ? FADE_X : FADE_Y)[fade];
}
