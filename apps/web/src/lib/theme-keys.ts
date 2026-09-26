// How a theme matrix heads its columns: by the theme's name wherever there is room ("Names,
// not codes"), and only in the narrowest layouts by short keys (with a legend spelling them
// out, never rotated names); and one sentence per track that says which themes it carries,
// for screen readers.

import { andList } from "@/lib/and-list";

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

/**
 * What a track carries, as one phrase: "Carries memory and signal", or "Carries none of the
 * album themes". `carried` keeps the album's theme order and spelling.
 */
export function carriedThemesPhrase(carried: readonly string[], total: number): string {
  if (!total) return "";
  if (!carried.length) return "Carries none of the album themes";
  if (carried.length === total && total > 2) return `Carries all ${total} album themes`;
  return `Carries ${andList(carried)}`;
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

// ---------------------------------------------------------------------------------------------
// Wide heads: each theme column as wide as its whole name, where the sheet has the room.

/** A name's padding inside its slot (`px-0.5` either side), in rem. */
export const THEME_NAME_PADDING_REM = 0.25;
/** The widest a theme column grows to show its name whole: about 13 condensed capitals. */
export const WIDE_THEME_SLOT_MAX_REM = 7;

/**
 * Everything in a spine row but the themes, in rem, as the sheet sets it: the number column
 * (1.5rem), the title at its 8rem minimum, and the Lyrics and Role columns, which are as wide
 * as their heads ("LYRICS", "ROLE"); each of the three keeps a 0.25rem gap. The heads are
 * measured in the catalog cut like the theme names, so enlarged text scales it all together.
 */
export const SPINE_OTHER_COLUMNS_REM =
  1.5 + 8 + catalogWidthRem("Lyrics") + catalogWidthRem("Role") + 3 * 0.25;

function ceilTo(value: number, step: number) {
  // The epsilon keeps a value that is already on a step (7.0000000001) from rounding up past it.
  return Math.ceil(value / step - 1e-9) * step;
}

/**
 * The narrowest column that sets `theme` in whole words, in rem: the name on one line, or on
 * two at a space or hyphen it already has, whichever is narrower, plus the padding and the fit
 * margin. At least the 3rem slot and at most `WIDE_THEME_SLOT_MAX_REM`; a single word wider
 * than that is hyphenated there, or truncates with the legend, as in the 3rem slot.
 */
export function wideThemeSlotRem(theme: string, minSlotRem: number = THEME_NAME_SLOT_REM): number {
  const name = theme.trim();
  let text = catalogWidthRem(name);
  for (let i = 1; i < name.length; i += 1) {
    const atSpace = name[i] === " ";
    const afterHyphen = /[-‐–—/]/.test(name[i - 1]) && name[i] !== " ";
    if (!atSpace && !afterHyphen) continue;
    const first = atSpace ? name.slice(0, i).trimEnd() : name.slice(0, i);
    const second = atSpace ? name.slice(i + 1).trimStart() : name.slice(i);
    if (!first || !second) continue;
    text = Math.min(text, Math.max(catalogWidthRem(first), catalogWidthRem(second)));
  }
  const slot = ceilTo(text + FIT_MARGIN_REM + THEME_NAME_PADDING_REM, 0.05);
  return Math.min(WIDE_THEME_SLOT_MAX_REM, Math.max(minSlotRem, Number(slot.toFixed(2))));
}

/**
 * The widest each wide layout lets a column grow, narrowest first: a sheet with a little more
 * room than the 3rem slots widens every column to 4rem at most (so "MEMORY" and "WEATHER" read
 * whole while "ESTRANGEMENT" still hyphenates), then 5rem, then each name's own width.
 */
export const WIDE_THEME_SLOT_CAPS_REM = [4, 5, WIDE_THEME_SLOT_MAX_REM] as const;

export type WideThemeHeads = {
  /** Each theme's column width in this layout, in rem, in the album's theme order. */
  slotRem: number[];
  /** The container width from which the sheet takes this layout, in rem. */
  fromRem: number;
  /** A name still truncates at this width, so the legend stays up. */
  truncated: boolean;
};

/**
 * The wider layouts of a theme matrix's heads, narrowest first; empty when every name is
 * already whole in the 3rem slot. In each, a column is as wide as its own name needs
 * (`wideThemeSlotRem`) up to that layout's cap (`WIDE_THEME_SLOT_CAPS_REM`), so a long theme
 * doesn't widen the short ones; a layout starts where the sheet holds those columns beside
 * everything else at its minimum (`SPINE_OTHER_COLUMNS_REM`), so the room comes out of the
 * title column, down to its 8rem, and nothing else. Below the first, the 3rem slots (a long
 * word hyphenated) and then the keys take over. A layout that would change nothing is left out.
 * Another matrix (the Studio's track list) passes its own other columns and named slot.
 */
export function wideThemeHeads(
  themes: readonly string[],
  {
    otherColumnsRem = SPINE_OTHER_COLUMNS_REM,
    minSlotRem = THEME_NAME_SLOT_REM,
  }: {
    /** Everything in a row but the themes, at its minimum; the spine's by default. */
    otherColumnsRem?: number;
    /** The named slot the table uses below its wide layouts (the spine's 3rem by default). */
    minSlotRem?: number;
  } = {},
): WideThemeHeads[] {
  const needs = themes.map((theme) => wideThemeSlotRem(theme, minSlotRem));
  const layouts: WideThemeHeads[] = [];
  let previous = needs.map(() => minSlotRem);
  for (const cap of WIDE_THEME_SLOT_CAPS_REM) {
    const slotRem = needs.map((need) => Math.min(cap, need));
    if (slotRem.every((slot, index) => slot === previous[index])) continue;
    const total = slotRem.reduce((sum, slot) => sum + slot, 0);
    layouts.push({
      slotRem,
      fromRem: Number(ceilTo(otherColumnsRem + total, 0.05).toFixed(2)),
      truncated: themes.some(
        (theme, index) => themeHeadLines(theme, slotRem[index] - THEME_NAME_PADDING_REM).truncated,
      ),
    });
    previous = slotRem;
  }
  return layouts;
}

/** The class a theme's head carries in the wide layout at `layout`, so its rules can show it. */
export function wideThemeHeadClass(layout: number) {
  return `theme-head-w${layout}`;
}

/** The class a theme's column carries at `index`, so the wide layout can size it. */
export function wideThemeSlotClass(index: number) {
  return `theme-slot-${index}`;
}

/**
 * The style rules for one sheet's wide layouts, scoped to the element with
 * `data-theme-heads="<scope>"`: past each layout's `fromRem` of its container, the narrower head
 * (`.theme-head-narrow`, or the previous layout's) gives way to that layout's
 * (`wideThemeHeadClass`), each column takes its width (`wideThemeSlotClass`), and the legend goes
 * once no name truncates. Container widths are data here (one set per album), so they can't be
 * literal Tailwind classes; the rules sit outside Tailwind's layers, so they win over the 3rem
 * classes they replace. `scope` is a plain id.
 */
export function wideThemeHeadsCss(scope: string, layouts: readonly WideThemeHeads[]): string {
  if (!layouts.length) return "";
  const at = `[data-theme-heads="${scope.replace(/[^\w-]/g, "")}"]`;
  const rules = [layouts.map((_, index) => `${at} .${wideThemeHeadClass(index)}`).join(",") + "{display:none}"];
  layouts.forEach((layout, index) => {
    const hide = index === 0 ? `${at} .theme-head-narrow` : `${at} .${wideThemeHeadClass(index - 1)}`;
    rules.push(
      `@container (min-width:${layout.fromRem}rem){`,
      `${hide}{display:none}`,
      `${at} .${wideThemeHeadClass(index)}{display:block}`,
      ...layout.slotRem.map((slot, column) => `${at} .${wideThemeSlotClass(column)}{width:${slot}rem}`),
      layout.truncated ? "" : `${at} .theme-legend{display:none}`,
      "}",
    );
  });
  return rules.join("");
}
