// A reference typed on one line in the create wizard ("Blonde — Frank Ocean"), read as the
// record's title and its artist, the two fields the References page keeps apart. Shared by the
// wizard (its Blueprint preview shows the split before saving) and the album create route
// (server/wizard-references), so what the artist sees is what is saved.

export type ReferenceLine = { title: string; artist: string | null };

/** The one form the wizard teaches: title, a spaced dash, artist. */
export const REFERENCE_LINE_SEPARATOR = " — ";

/** A spaced em dash, en dash or hyphen: the clearest separator, so it is looked for first. */
const DASH = / [—–-] /g;
/** " by ", in any case. */
const BY = / by /gi;

function lastMatch(text: string, pattern: RegExp): { index: number; length: number } | null {
  let last: { index: number; length: number } | null = null;
  for (const match of text.matchAll(pattern)) last = { index: match.index, length: match[0].length };
  return last;
}

function split(text: string, at: { index: number; length: number }): ReferenceLine | null {
  const title = text.slice(0, at.index).trim();
  const artist = text.slice(at.index + at.length).trim();
  return title && artist ? { title, artist } : null;
}

/**
 * One wizard line as title and artist, or null for a blank line. The line splits at its last
 * spaced dash ("Blonde — Frank Ocean", "Hey Jude - The Beatles"); failing that, at its last
 * " by " when at least two words come before it ("Stand by Me by Ben E. King"; "Stand by Me"
 * alone stays a title); failing that, at its last comma ("Hey, Soul Sister, Train"). The last
 * one, because titles hold commas and dashes more often than artist names do; a dash first,
 * because an artist's own comma ("Earth, Wind & Fire") then stays whole. A line with none of
 * these, or with nothing on one side, is all title. Spacing is collapsed.
 */
export function parseReferenceLine(raw: string): ReferenceLine | null {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return null;

  const dash = lastMatch(text, DASH);
  const byDash = dash ? split(text, dash) : null;
  if (byDash) return byDash;

  const by = lastMatch(text, BY);
  if (by && text.slice(0, by.index).trim().split(" ").length >= 2) {
    const byWord = split(text, by);
    if (byWord) return byWord;
  }

  const comma = text.lastIndexOf(",");
  if (comma >= 0) {
    const byComma = split(text, { index: comma, length: 1 });
    if (byComma) return byComma;
  }

  return { title: text, artist: null };
}
