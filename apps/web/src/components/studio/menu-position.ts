// Where a popup menu sits so it never leaves the viewport or widens the page. Pure; no DOM.

/** The gap a menu keeps from each edge of the viewport, in px. */
export const MENU_EDGE_GAP = 8;

/**
 * The menu's `left`, in px relative to its positioned wrapper. It prefers to hang from the
 * trigger's right edge (opening leftward, under the button), and is clamped so its box stays
 * within [gap, viewportWidth − gap − menuWidth] in the viewport. A menu wider than the room
 * (the CSS caps it at 100vw − 2 × gap, so only rounding gets here) starts at the left gap.
 * All inputs are viewport coordinates (getBoundingClientRect) except the width.
 */
export function menuLeftOffset({
  triggerRight,
  wrapperLeft,
  menuWidth,
  viewportWidth,
  gap = MENU_EDGE_GAP,
}: {
  triggerRight: number;
  wrapperLeft: number;
  menuWidth: number;
  viewportWidth: number;
  gap?: number;
}): number {
  const preferred = triggerRight - menuWidth;
  const furthestLeft = gap;
  const furthestRight = viewportWidth - gap - menuWidth;
  const left = Math.max(furthestLeft, Math.min(preferred, furthestRight));
  return Math.round(left - wrapperLeft);
}
