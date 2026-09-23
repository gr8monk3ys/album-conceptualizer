// Short keys for an album's themes, so a theme matrix can head its narrow columns with
// horizontal letters (with a legend spelling them out) instead of rotated names, and one
// sentence per track that says which themes it carries, for screen readers.

function letters(theme: string) {
  return theme.normalize("NFKD").replace(/[^\p{L}\p{N}]/gu, "").toUpperCase();
}

/**
 * One key per theme, in order: the shortest prefix (1 or 2 letters) that no other theme
 * shares, falling back to the first letter plus its position ("M3") when two themes start
 * with the same two letters. Keys never exceed three characters.
 */
export function themeAbbreviations(themes: readonly string[]): string[] {
  const words = themes.map((theme) => letters(theme) || "?");
  return words.map((word, index) => {
    for (const length of [1, 2]) {
      const key = word.slice(0, length);
      if (key.length < length) break;
      const clash = words.some((other, j) => j !== index && other.slice(0, length) === key);
      if (!clash) return key;
    }
    return `${word.charAt(0)}${index + 1}`;
  });
}

const LIST = new Intl.ListFormat("en", { style: "long", type: "conjunction" });

/**
 * What a track carries, as one phrase: "Carries memory and signal", or "Carries none of the
 * album themes". `carried` keeps the album's theme order and spelling.
 */
export function carriedThemesPhrase(carried: readonly string[], total: number): string {
  if (!total) return "";
  if (!carried.length) return "Carries none of the album themes";
  if (carried.length === total && total > 2) return `Carries all ${total} album themes`;
  return `Carries ${LIST.format(carried)}`;
}
