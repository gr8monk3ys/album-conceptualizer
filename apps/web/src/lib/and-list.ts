/**
 * Joins phrases into one English "and" list, as `Intl.ListFormat("en", { style: "long", type:
 * "conjunction" })` does: "tide", "tide and signal", "tide, signal, and static".
 *
 * Written out rather than calling Intl: the first `Intl.ListFormat` a page builds loads ICU's
 * list data, about 30–60ms on a throttled phone, and a module-level formatter paid that while
 * the page's scripts were starting up, inside the one long task before it responds to input.
 */
export function andList(items: readonly string[]): string {
  const count = items.length;
  if (count <= 1) return items[0] ?? "";
  if (count === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[count - 1]}`;
}
