/**
 * The create wizard's "Track titles" field: one title per line, in running order. A blank line
 * keeps its place as an untitled track (it opens as "Track 3" when it is the third line), so
 * "Lamp Room", "", "Fog Horn" names tracks 1 and 3. Blank lines after the last title are
 * dropped (they name nothing), and so are lines past the album's track count.
 *
 * Returns one entry per position, "" for an untitled one.
 */
export function trackTitlesByPosition(raw: string, trackCount: number = Number.POSITIVE_INFINITY): string[] {
  const lines = raw.split(/\r?\n/g).map((line) => line.trim());
  let end = lines.length;
  while (end > 0 && !lines[end - 1]) end -= 1;
  return lines.slice(0, Math.min(end, Math.max(0, trackCount)));
}

/** The title a track opens with: its own, or "Track N" by its number. */
export function openingTrackTitle(titles: readonly string[], index: number): string {
  return titles[index] || `Track ${index + 1}`;
}
