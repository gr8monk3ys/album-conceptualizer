import { atScrollEnd, atScrollStart } from "@/lib/edge-fade";

/**
 * Where a sideways scroller should scroll so a focused item inside it sits fully in view and
 * at least `margin` (the edge fade's width) clear of each edge, so the fade never covers what
 * has focus. `start` is the item's left edge relative to the scroller's visible left edge,
 * `width` its width; `viewport`/`content` are clientWidth/scrollWidth. Returns the current
 * position when the item is already clear. An item too wide to fit with both margins is lined
 * up at the start margin (its beginning is what the reader needs first), unless it is the last
 * thing in the table and fits beside a sticky column, when the end shows it whole.
 *
 * At the very start or end of the table there is no fade, so no margin is kept there: an item
 * that lies within the fade's width of an end is scrolled fully to that end (0, or the
 * maximum), so the fade on that side actually goes away. "At the end" is the same test the
 * fade itself uses (`atScrollStart` / `atScrollEnd` in `@/lib/edge-fade`), so the two never
 * disagree by a few pixels and leave a fade over the focused item.
 *
 * `stickyStart` is how much of the scroller's start edge a sticky first column covers (its
 * width, which the scroller also declares as `scroll-padding-left`): an item is kept clear of
 * that column as well as of the fade, so Shift+Tab never lands under it.
 */
export function fadeClearScrollLeft({
  scrollLeft,
  viewport,
  content,
  start,
  width,
  margin,
  stickyStart = 0,
}: {
  scrollLeft: number;
  viewport: number;
  content: number;
  start: number;
  width: number;
  margin: number;
  stickyStart?: number;
}): number {
  const max = Math.max(0, content - viewport);
  const clamp = (value: number) => Math.max(0, Math.min(max, value));
  // The item's edges in the table's own coordinates, which don't move as it scrolls.
  const itemStart = scrollLeft + start;
  const itemEnd = itemStart + width;

  // Whether the item is fully in view and clear of every fade the scroller shows at `left`.
  const clearAt = (left: number) => {
    const fadeStart = atScrollStart(left) ? 0 : margin;
    const fadeEnd = atScrollEnd(left, viewport, content) ? 0 : margin;
    // Half a pixel of slack for sub-pixel layout.
    return itemStart - left >= stickyStart + fadeStart - 0.5 && itemEnd - left <= viewport - fadeEnd + 0.5;
  };
  if (clearAt(scrollLeft)) return scrollLeft;

  // Within a fade's width of the table's first scrolling column, or of its end.
  const touchesStart = itemStart - stickyStart - margin <= 0;
  const touchesEnd = itemEnd + margin >= content;
  if (touchesStart) return 0;

  const alignStart = Math.floor(clamp(itemStart - stickyStart - margin));
  const room = viewport - stickyStart - margin - (touchesEnd ? 0 : margin);
  if (width > room) {
    // No position clears it. At the end it is at least wholly in view (only the start fade's
    // edge over it) rather than lined up at the start and running on under the end fade.
    return touchesEnd && width <= viewport - stickyStart ? max : alignStart;
  }
  if (touchesEnd) return max;
  if (itemStart - scrollLeft < stickyStart + margin) return alignStart;
  return Math.ceil(clamp(itemEnd - viewport + margin));
}
