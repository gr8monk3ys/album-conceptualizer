// Lenient readers for values in an album snapshot, which is read as `unknown` wherever it is
// only looked at: a value of the wrong shape reads as empty rather than throwing.

/** `value` when it is an array, otherwise an empty list. */
export function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
