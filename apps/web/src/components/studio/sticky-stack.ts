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
 * and only while header + bar would cover less than 35% of it (a phone at 200% text, or the
 * bar grown by Undo or the version field, lets it scroll away instead).
 */
export function saveBarSticks({
  tallEnough,
  headerHeight,
  barHeight,
  viewportHeight,
}: {
  tallEnough: boolean;
  headerHeight: number;
  barHeight: number;
  viewportHeight: number;
}): boolean {
  if (!tallEnough || viewportHeight <= 0) return false;
  return headerHeight + barHeight < viewportHeight * STICKY_MAX_SHARE;
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
