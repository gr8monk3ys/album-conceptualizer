/**
 * The Studio's sticky stack: the app header and the save bar. Both are counted in
 * `--sticky-offset` only while they stick, and the save bar sticks only while the two together
 * leave most of the window for writing.
 */

/** The media query (in em, so it follows the reader's text size) below which nothing sticks. */
export const STICKY_MIN_HEIGHT_QUERY = "(min-height: 31.3125em)";

/** The most of the window the header and save bar may cover together while stuck. */
export const STICKY_MAX_SHARE = 0.35;

/**
 * Whether the save bar should stick: only on a window tall enough for sticky layers at all,
 * and only while header + bar (+ the docked preview player, which is fixed to the bottom)
 * would cover less than 35% of it (a phone at 200% text, the bar grown by the version field,
 * or a phone with the player open lets it scroll away instead).
 */
export function saveBarSticks({
  tallEnough,
  headerHeight,
  barHeight,
  playerHeight = 0,
  viewportHeight,
}: {
  tallEnough: boolean;
  headerHeight: number;
  barHeight: number;
  /** The docked preview player's height, 0 while it isn't docked. */
  playerHeight?: number;
  viewportHeight: number;
}): boolean {
  if (!tallEnough || viewportHeight <= 0) return false;
  return headerHeight + barHeight + playerHeight < viewportHeight * STICKY_MAX_SHARE;
}

/**
 * Whether a focused target can be seen: its top is below the sticky layers and at least the
 * first line of it (up to `minVisible` px) is above the bottom of the window.
 */
export function visibleBelowSticky(
  rect: { top: number; bottom: number },
  stickyOffset: number,
  viewportHeight: number,
  minVisible = 48,
): boolean {
  const height = Math.max(0, rect.bottom - rect.top);
  return rect.top >= stickyOffset - 1 && rect.top + Math.min(height, minVisible) <= viewportHeight + 1;
}

/**
 * How to bring the lyrics into view on arrival ("Write track 1", Write next): with the track's
 * header ("01 Track 1", Preview song, More and its catalog line) when both fit in the window
 * below the sticky layers, so the writer sees which track they are in; otherwise the lyrics
 * alone. `scrollPaddingTop` is the page's own scroll padding (--sticky-offset plus 1rem), which
 * is where a `block: "start"` scroll puts the header, so nothing adds a second offset.
 *
 * - "stay": the header and the lyrics are both already in view; nothing moves.
 * - "frame": scroll the header to the top, just under the save bar; the lyrics follow below it.
 * - "target": they don't fit together; scroll to the lyrics as before.
 */
export function frameWithTarget(
  frame: { top: number },
  target: { top: number; bottom: number },
  scrollPaddingTop: number,
  viewportHeight: number,
): "stay" | "frame" | "target" {
  if (viewportHeight <= 0) return "target";
  if (frame.top >= scrollPaddingTop - 1 && target.bottom <= viewportHeight + 1) return "stay";
  return target.bottom - frame.top <= viewportHeight - scrollPaddingTop ? "frame" : "target";
}
