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
