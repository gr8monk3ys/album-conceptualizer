// What counts as written, defined once: the spine, the Studio track list, Home's next step
// and the coherence report all read lyrics through these, so they can never disagree.

/** Lyrics count as written when anything is left after removing "[…]" placeholders. */
export function isWrittenLyrics(lyrics: unknown): boolean {
  return typeof lyrics === "string" && lyrics.replace(/\[[^\]]*\]/g, "").trim().length > 0;
}

/** How much of a song is written: sections with lyrics out of all sections. */
export function lyricProgress(sections: unknown): { written: number; total: number } {
  const list = Array.isArray(sections) ? sections : [];
  const written = list.filter((s) => isWrittenLyrics((s as { lyrics?: unknown } | null)?.lyrics)).length;
  return { written, total: list.length };
}

/** A track "has lyrics" once any of its sections is written. */
export function trackHasLyrics(sections: unknown): boolean {
  return lyricProgress(sections).written > 0;
}
