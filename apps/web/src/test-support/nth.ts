/** The item at `index` (negative counts from the end), or a failure that says what was missing, so a test never reads past its data. */
export function nth<T>(items: readonly T[], index: number): T {
  const item = items.at(index);
  if (item === undefined) throw new Error(`Expected an item at index ${index}, but there are ${items.length}.`);
  return item;
}
