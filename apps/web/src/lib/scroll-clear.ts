/**
 * Where a sideways scroller should scroll so a focused item inside it sits fully in view and
 * at least `margin` (the edge fade's width) clear of each edge, so the fade never covers what
 * has focus. `start` is the item's left edge relative to the scroller's visible left edge,
 * `width` its width; `viewport`/`content` are clientWidth/scrollWidth. Returns the current
 * position when the item is already clear. An item too wide to fit with both margins is lined
 * up at the start margin (its beginning is what the reader needs first).
 */
export function fadeClearScrollLeft({
  scrollLeft,
  viewport,
  content,
  start,
  width,
  margin,
}: {
  scrollLeft: number;
  viewport: number;
  content: number;
  start: number;
  width: number;
  margin: number;
}): number {
  const max = Math.max(0, content - viewport);
  const clamp = (value: number) => Math.max(0, Math.min(max, Math.round(value)));
  const end = start + width;
  // At the very start or end of the table there is no fade on that side, so no margin needed.
  const startMargin = scrollLeft + start - margin <= 0 ? 0 : margin;
  const endMargin = scrollLeft + end + margin >= content ? 0 : margin;
  if (width > viewport - startMargin - endMargin || start < startMargin) {
    return clamp(scrollLeft + start - startMargin);
  }
  if (end > viewport - endMargin) return clamp(scrollLeft + end - (viewport - endMargin));
  return scrollLeft;
}
