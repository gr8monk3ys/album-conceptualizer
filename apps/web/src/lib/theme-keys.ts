// How a theme matrix heads its columns: by the theme's name wherever there is room ("Names,
// not codes"), and only in the narrowest layouts by short keys (with a legend spelling them
// out, never rotated names); and one sentence per track that says which themes it carries,
// for screen readers.

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

/** The width of a theme column headed by its name: 3rem, about seven condensed capitals. */
export const THEME_NAME_SLOT_REM = 3;

/**
 * The container width at which a spine with `count` themes heads them by name, in rem (so
 * enlarged text needs more room): the number, lyrics and role columns and the 8rem title take
 * 15rem, and each name takes a 3rem slot. One theme from 18rem, three from 24rem, six from
 * 33rem.
 */
export function themeNamesFromRem(count: number): number {
  return 15 + THEME_NAME_SLOT_REM * Math.max(1, Math.min(6, count));
}

export type ThemeHeadClasses = { keys: string; names: string; slot: string; legend: string };

// Literal class names, so Tailwind generates them; each is `@min-[<themeNamesFromRem>rem]`.
const THEME_HEADS: Record<number, ThemeHeadClasses> = {
  1: { keys: "@min-[18rem]:hidden", names: "hidden @min-[18rem]:block", slot: "@min-[18rem]:w-12", legend: "@min-[18rem]:hidden" },
  2: { keys: "@min-[21rem]:hidden", names: "hidden @min-[21rem]:block", slot: "@min-[21rem]:w-12", legend: "@min-[21rem]:hidden" },
  3: { keys: "@min-[24rem]:hidden", names: "hidden @min-[24rem]:block", slot: "@min-[24rem]:w-12", legend: "@min-[24rem]:hidden" },
  4: { keys: "@min-[27rem]:hidden", names: "hidden @min-[27rem]:block", slot: "@min-[27rem]:w-12", legend: "@min-[27rem]:hidden" },
  5: { keys: "@min-[30rem]:hidden", names: "hidden @min-[30rem]:block", slot: "@min-[30rem]:w-12", legend: "@min-[30rem]:hidden" },
  6: { keys: "@min-[33rem]:hidden", names: "hidden @min-[33rem]:block", slot: "@min-[33rem]:w-12", legend: "@min-[33rem]:hidden" },
};

/**
 * The classes that switch a theme matrix's heads between names and keys by the room its
 * container (an `@container` ancestor) has, for `count` themes: `keys` on the key, `names` on
 * the name, `slot` on each column's box (1rem for a key, 3rem for a name), `legend` on the key
 * legend, which is shown only while the keys are.
 */
export function themeHeadClasses(count: number): ThemeHeadClasses {
  return THEME_HEADS[Math.max(1, Math.min(6, count))];
}

// ---------------------------------------------------------------------------------------------
// Theme heads that fit their slot: the whole name on up to two lines.

/**
 * Advance widths of the catalog cut at the size theme heads use (Archivo 600, 75% width,
 * 0.75rem, 0.06em tracking), in rem, measured in Chromium. Rem, so it holds at any text size.
 * Anything not listed counts as a wide capital.
 */
const CATALOG_ADVANCE_REM: Record<string, number> = {
  A: 0.456, B: 0.455, C: 0.474, D: 0.476, E: 0.435, F: 0.392, G: 0.505, H: 0.476, I: 0.226,
  J: 0.389, K: 0.466, L: 0.383, M: 0.579, N: 0.478, O: 0.507, P: 0.443, Q: 0.507, R: 0.468,
  S: 0.431, T: 0.419, U: 0.47, V: 0.44, W: 0.621, X: 0.454, Y: 0.455, Z: 0.429,
  "0": 0.393, "1": 0.365, "2": 0.393, "3": 0.393, "4": 0.386, "5": 0.397, "6": 0.392,
  "7": 0.363, "8": 0.388, "9": 0.392,
  " ": 0.158, "-": 0.249, "'": 0.199, "’": 0.199, "&": 0.477, ".": 0.221, ",": 0.221,
};
const WIDE_CAPITAL_REM = 0.58;
/** Kept clear of the slot's edge, so a line the estimate calls a fit never meets the ellipsis. */
const FIT_MARGIN_REM = 0.15;

/** How wide `text` sets in the catalog cut (uppercased, as the heads show it), in rem. */
export function catalogWidthRem(text: string): number {
  let width = 0;
  for (const char of text.toUpperCase().normalize("NFKD")) {
    if (/\p{M}/u.test(char)) continue;
    width += CATALOG_ADVANCE_REM[char] ?? WIDE_CAPITAL_REM;
  }
  return width;
}

const VOWEL = /^[aeiouy]$/i;
/** Letter pairs a hyphen never splits. */
const DIGRAPHS = new Set(["ch", "ck", "gh", "ng", "ph", "qu", "sh", "th", "wh"]);
/** Consonant clusters a syllable can start with, so a break may fall before them. */
const ONSETS = new Set([
  "bl", "br", "ch", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "ph", "pl", "pr", "sc", "sh",
  "sk", "sl", "sm", "sn", "sp", "st", "sw", "th", "tr", "wh", "wr", "scr", "shr", "spl", "spr",
  "str", "thr",
]);

const SUFFIXES = /(?:ings?|ness|ment|less|ful)$/;

function baseLetter(char: string | undefined) {
  return (char ?? "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

function isLetter(char: string | undefined) {
  return !!char && /\p{L}/u.test(char);
}

function isVowel(text: string, index: number) {
  const letter = baseLetter(text[index]);
  if (letter === "y") return index > 0 && isLetter(text[index - 1]);
  return VOWEL.test(letter);
}

/**
 * Where a word may take a hyphen: between syllables, by the usual rules of thumb (a single
 * consonant between vowels starts the next syllable, a cluster splits before a consonant or a
 * cluster a syllable can start with, never inside "th", "ch" or "qu"), with at least two
 * letters before the break and three after, plus before a common suffix ("-ing", "-ness").
 * Returns string indices to break before, in order.
 */
export function hyphenationPoints(text: string): number[] {
  const points: number[] = [];
  let start = 0;
  while (start < text.length) {
    if (!isLetter(text[start])) {
      start += 1;
      continue;
    }
    let end = start;
    while (end < text.length && isLetter(text[end])) end += 1;
    for (let i = start + 2; i <= end - 3; i += 1) {
      if (isVowel(text, i)) continue;
      // The consonant cluster around the break, from the vowel before to the vowel after.
      let left = i;
      while (left > start && !isVowel(text, left - 1)) left -= 1;
      let right = i;
      while (right < end && !isVowel(text, right)) right += 1;
      if (left === start || right === end) continue;
      const before = baseLetter(text.slice(left, i));
      const after = baseLetter(text.slice(i, right));
      if (after.length > 1 && !ONSETS.has(after)) continue;
      if (DIGRAPHS.has(`${before.slice(-1)}${after.charAt(0)}`)) continue;
      points.push(i);
    }
    // A suffix the cluster rules can't see ("long-ing", "dark-ness").
    const suffix = SUFFIXES.exec(baseLetter(text.slice(start, end)));
    const at = suffix ? end - suffix[0].length : -1;
    if (at >= start + 2 && !points.includes(at)) points.push(at);
    start = end;
  }
  return points.sort((a, b) => a - b);
}

/**
 * The shortest word a head may hyphenate, in letters. A short word split over two lines
 * ("ME-/MORY", "SIG-/NAL") reads as two fragments; it truncates instead, and the legend under
 * the table names it in full.
 */
export const MIN_HYPHENATED_WORD_LETTERS = 8;

/** The number of letters in the word around string index `index` (0 when it isn't in a word). */
function wordLettersAt(text: string, index: number): number {
  if (!isLetter(text[index])) return 0;
  let start = index;
  while (start > 0 && isLetter(text[start - 1])) start -= 1;
  let end = index;
  while (end < text.length && isLetter(text[end])) end += 1;
  return end - start;
}

export type ThemeHead = {
  /** One or two lines, as set (a hyphen ends the first when the break falls inside a word). */
  lines: string[];
  /** The name doesn't fit even on two lines: the head truncates and a legend has to name it. */
  truncated: boolean;
};

/**
 * How a theme's name heads a column `widthRem` wide: on one line when it fits, otherwise on
 * two, broken at a space or an existing hyphen when that fits, at a syllable (with a hyphen)
 * when only that does, choosing the most even pair. Only a word of eight letters or more is
 * hyphenated ("ISOLA-/TION"); a shorter one ("memory", "signal") is never split. When not
 * even two lines hold the name, the head keeps one truncated line and says so, so the table
 * can show its legend.
 */
export function themeHeadLines(theme: string, widthRem: number): ThemeHead {
  const name = theme.trim();
  const room = widthRem - FIT_MARGIN_REM;
  if (catalogWidthRem(name) <= room) return { lines: [name], truncated: false };

  let best: { lines: string[]; rank: number; widest: number } | null = null;
  const consider = (first: string, second: string, rank: number) => {
    const widest = Math.max(catalogWidthRem(first), catalogWidthRem(second));
    if (!first || !second || widest > room) return;
    if (!best || rank < best.rank || (rank === best.rank && widest < best.widest)) {
      best = { lines: [first, second], rank, widest };
    }
  };
  for (let i = 1; i < name.length; i += 1) {
    if (name[i] === " ") consider(name.slice(0, i).trimEnd(), name.slice(i + 1).trimStart(), 0);
    if (/[-‐–—/]/.test(name[i - 1]) && name[i] !== " ") consider(name.slice(0, i), name.slice(i), 0);
  }
  for (const i of hyphenationPoints(name)) {
    if (wordLettersAt(name, i) < MIN_HYPHENATED_WORD_LETTERS) continue;
    consider(`${name.slice(0, i)}-`, name.slice(i), 1);
  }

  const chosen = best as { lines: string[] } | null;
  return chosen ? { lines: chosen.lines, truncated: false } : { lines: [name], truncated: true };
}
