import { describe, expect, it } from "vitest";

import {
  SPINE_OTHER_COLUMNS_REM,
  THEME_NAME_PADDING_REM,
  WIDE_THEME_SLOT_MAX_REM,
  carriedThemesPhrase,
  catalogWidthRem,
  hyphenationPoints,
  themeAbbreviations,
  themeHeadClasses,
  themeHeadLines,
  themeNamesFromRem,
  wideThemeHeads,
  wideThemeHeadsCss,
  wideThemeSlotRem,
} from "@/lib/theme-keys";

describe("themeAbbreviations", () => {
  it("uses one letter when every theme starts differently", () => {
    expect(themeAbbreviations(["Isolation", "Duty", "Memory", "Weather"])).toEqual(["I", "D", "M", "W"]);
  });

  it("uses two letters only for the themes that share a first letter", () => {
    expect(themeAbbreviations(["Memory", "Mourning", "Signal"])).toEqual(["ME", "MO", "S"]);
  });

  it("falls back to letter and position when two letters still clash", () => {
    expect(themeAbbreviations(["Memory", "Melancholy", "Salt"])).toEqual(["M1", "M2", "S"]);
  });

  it("ignores punctuation, spaces and case", () => {
    expect(themeAbbreviations(["the sea", "  hope!", "Élan"])).toEqual(["T", "H", "E"]);
  });

  it("never returns an empty key", () => {
    expect(themeAbbreviations(["—", "Home"])).toEqual(["?", "H"]);
  });
});

describe("carriedThemesPhrase", () => {
  it("names the themes a track carries in one phrase", () => {
    expect(carriedThemesPhrase(["memory", "signal"], 5)).toBe("Carries memory and signal");
    expect(carriedThemesPhrase(["Memory"], 5)).toBe("Carries Memory");
  });

  it("says so when a track carries none", () => {
    expect(carriedThemesPhrase([], 4)).toBe("Carries none of the album themes");
  });

  it("summarises a track that carries every theme", () => {
    expect(carriedThemesPhrase(["A", "B", "C"], 3)).toBe("Carries all 3 album themes");
  });

  it("is empty when the album has no themes", () => {
    expect(carriedThemesPhrase([], 0)).toBe("");
  });
});

describe("theme heads: names, not codes", () => {
  it("heads the columns by name from 15rem plus 3rem a theme", () => {
    expect(themeNamesFromRem(1)).toBe(18);
    expect(themeNamesFromRem(3)).toBe(24);
    expect(themeNamesFromRem(6)).toBe(33);
  });

  it("switches at exactly that container width, for every count", () => {
    for (let count = 1; count <= 6; count += 1) {
      const at = `@min-[${themeNamesFromRem(count)}rem]`;
      const classes = themeHeadClasses(count);
      expect(classes.keys).toBe(`${at}:hidden`);
      expect(classes.names).toBe(`hidden ${at}:block`);
      expect(classes.slot).toBe(`${at}:w-12`);
      expect(classes.legend).toBe(`${at}:hidden`);
    }
  });

  it("clamps to one to six themes", () => {
    expect(themeHeadClasses(0)).toEqual(themeHeadClasses(1));
    expect(themeHeadClasses(9)).toEqual(themeHeadClasses(6));
  });
});

describe("themeHeadLines: the whole name over its column", () => {
  // The spine's 3rem slot, less its padding.
  const SLOT = 2.75;

  it("keeps a name that fits on one line", () => {
    expect(themeHeadLines("signal", SLOT)).toEqual({ lines: ["signal"], truncated: false });
    expect(themeHeadLines("  tide ", SLOT)).toEqual({ lines: ["tide"], truncated: false });
  });

  it("breaks a two-word name at the space", () => {
    expect(themeHeadLines("late night", SLOT)).toEqual({ lines: ["late", "night"], truncated: false });
  });

  it("breaks after a hyphen the name already has, without adding one", () => {
    expect(themeHeadLines("self-doubt", SLOT)).toEqual({ lines: ["self-", "doubt"], truncated: false });
  });

  it("hyphenates a long single word at a syllable, choosing the most even pair", () => {
    expect(themeHeadLines("isolation", SLOT)).toEqual({ lines: ["isola-", "tion"], truncated: false });
    expect(themeHeadLines("Heartbreak", SLOT)).toEqual({ lines: ["Heart-", "break"], truncated: false });
  });

  it("never splits a word of seven letters or fewer: it truncates and the legend names it", () => {
    // "ME-/MORY" and "SIG-/NAL" read as fragments; the head keeps the word whole.
    expect(themeHeadLines("memory", SLOT)).toEqual({ lines: ["memory"], truncated: true });
    // The Studio's narrower head (2.5rem): "signal" no longer fits on one line there.
    expect(themeHeadLines("signal", 2.5)).toEqual({ lines: ["signal"], truncated: true });
    expect(themeHeadLines("longing", SLOT)).toEqual({ lines: ["longing"], truncated: true });
    // Eight letters is long enough to take a hyphen.
    expect(themeHeadLines("darkness", 2.3).lines).toEqual(["dark-", "ness"]);
  });

  it("still breaks a short word's name at a space", () => {
    expect(themeHeadLines("new tides", 2.3).lines).toEqual(["new", "tides"]);
    expect(themeHeadLines("old signal", SLOT)).toEqual({ lines: ["old", "signal"], truncated: false });
  });

  it("prefers a space to a hyphen when both fit", () => {
    expect(themeHeadLines("new tides", 2.3).lines).toEqual(["new", "tides"]);
  });

  it("says when not even two lines hold the name, so the legend can name it", () => {
    expect(themeHeadLines("unrequited homecomings", SLOT)).toEqual({
      lines: ["unrequited homecomings"],
      truncated: true,
    });
  });

  it("fits more on one line in a wider slot", () => {
    expect(themeHeadLines("isolation", 4.5)).toEqual({ lines: ["isolation"], truncated: false });
  });
});

describe("hyphenationPoints", () => {
  it("breaks before a single consonant between vowels and inside clusters", () => {
    expect(hyphenationPoints("isolation")).toEqual([3, 5]);
    expect(hyphenationPoints("heartbreak")).toEqual([5, 6]);
  });

  it("breaks before a common suffix", () => {
    expect(hyphenationPoints("longing")).toEqual([4]);
    expect(themeHeadLines("longings", 2.75).lines).toEqual(["long-", "ings"]);
  });

  it("never splits th, ch, ng or qu, and leaves two letters before and three after", () => {
    expect(hyphenationPoints("mother")).toEqual([2]);
    expect(hyphenationPoints("quiet")).toEqual([]);
    expect(hyphenationPoints("quietly")).toEqual([]);
    expect(hyphenationPoints("tide")).toEqual([]);
  });
});

describe("catalogWidthRem", () => {
  it("measures the uppercased name, accents on their base letter", () => {
    expect(catalogWidthRem("i")).toBeCloseTo(0.226);
    expect(catalogWidthRem("é")).toBeCloseTo(catalogWidthRem("E"));
    expect(catalogWidthRem("mw")).toBeGreaterThan(catalogWidthRem("il"));
  });
});

describe("wide theme heads: whole names where the sheet has room", () => {
  const ALBUM = ["isolation", "signal", "tide", "memory"];

  it("sizes a column to its own name, never under the 3rem slot or over 7rem", () => {
    expect(wideThemeSlotRem("tide")).toBe(3);
    expect(wideThemeSlotRem("signal")).toBe(3);
    // Wider than the 3rem slot holds: "ISOLA-/TION" and "MEMO…" there.
    expect(wideThemeSlotRem("isolation")).toBeGreaterThan(3);
    expect(wideThemeSlotRem("memory")).toBeGreaterThan(3);
    expect(wideThemeSlotRem("correspondences and letters")).toBeLessThanOrEqual(WIDE_THEME_SLOT_MAX_REM);
  });

  it("holds each name whole, on one line, in its column", () => {
    for (const theme of ["isolation", "memory", "estrangement", "correspondence"]) {
      const head = themeHeadLines(theme, wideThemeSlotRem(theme) - THEME_NAME_PADDING_REM);
      expect(head).toEqual({ lines: [theme], truncated: false });
    }
  });

  it("sets a two-word name on two lines at its space rather than widening for one line", () => {
    const slot = wideThemeSlotRem("salt water");
    expect(slot).toBeLessThan(catalogWidthRem("salt water"));
    expect(themeHeadLines("salt water", slot - THEME_NAME_PADDING_REM).lines).toEqual(["salt", "water"]);
  });

  it("widens nothing when every name is already whole in 3rem", () => {
    expect(wideThemeHeads(["tide", "salt", "grief"])).toEqual([]);
    expect(wideThemeHeads([])).toEqual([]);
  });

  it("starts where the columns fit beside the other columns and an 8rem title", () => {
    const layouts = wideThemeHeads(ALBUM);
    const last = layouts[layouts.length - 1];
    const total = last.slotRem.reduce((sum, slot) => sum + slot, 0);
    expect(last.fromRem).toBeGreaterThanOrEqual(SPINE_OTHER_COLUMNS_REM + total);
    expect(last.fromRem).toBeLessThan(SPINE_OTHER_COLUMNS_REM + total + 0.05);
    // Four themes on a laptop's Overview: its 28rem side column takes the whole names.
    expect(last.fromRem).toBeLessThanOrEqual(28);
    expect(last.slotRem.slice(1, 3)).toEqual([3, 3]);
    expect(last.truncated).toBe(false);
  });

  it("steps up through 4rem and 5rem columns to each name's own width, narrowest first", () => {
    const layouts = wideThemeHeads(["estrangement", "inheritance", "weather", "salt", "correspondence", "grief"]);
    expect(layouts.map((layout) => Math.max(...layout.slotRem))).toEqual([4, 5, wideThemeSlotRem("correspondence")]);
    const from = layouts.map((layout) => layout.fromRem);
    expect([...from].sort((a, b) => a - b)).toEqual(from);
    // At 4rem, "WEATHER" is already whole; "ESTRANGEMENT" still has to hyphenate or truncate.
    expect(layouts[0].slotRem[2]).toBe(wideThemeSlotRem("weather"));
  });

  it("takes another matrix's own columns and named slot", () => {
    // A Studio-like list: 3.5rem named slots beside 14rem of other columns.
    const layouts = wideThemeHeads(["isolation", "memory"], { otherColumnsRem: 14, minSlotRem: 3.5 });
    const last = layouts[layouts.length - 1];
    expect(last.slotRem[1]).toBe(3.5);
    expect(last.fromRem).toBeCloseTo(14 + last.slotRem[0] + 3.5, 5);
    expect(wideThemeHeads(["memory"], { minSlotRem: 3.5 })).toEqual([]);
  });

  it("leaves out a step that would change nothing", () => {
    // "isolation" needs just over 4rem, so the 5rem step is the same as the last.
    expect(wideThemeHeads(ALBUM)).toHaveLength(2);
  });

  it("writes rules scoped to one sheet, widening each column past its step", () => {
    const layouts = wideThemeHeads(ALBUM);
    const css = wideThemeHeadsCss("album-spine-theme-keys", layouts);
    const at = '[data-theme-heads="album-spine-theme-keys"]';
    expect(css.startsWith(`${at} .theme-head-w0,${at} .theme-head-w1{display:none}`)).toBe(true);
    expect(css).toContain(`@container (min-width:${layouts[0].fromRem}rem){${at} .theme-head-narrow{display:none}`);
    expect(css).toContain(`@container (min-width:${layouts[1].fromRem}rem){${at} .theme-head-w0{display:none}`);
    expect(css).toContain(`${at} .theme-slot-0{width:${layouts[1].slotRem[0]}rem}`);
    expect(css).toContain(`${at} .theme-legend{display:none}`);
    expect(wideThemeHeadsCss("x", [])).toBe("");
  });

  it("keeps the legend when a name truncates even at 7rem, and strips anything but an id from the scope", () => {
    const long = "internationalisations";
    const layouts = wideThemeHeads([long]);
    const last = layouts[layouts.length - 1];
    expect(last.slotRem).toEqual([WIDE_THEME_SLOT_MAX_REM]);
    const css = wideThemeHeadsCss('a"]{}b', layouts);
    expect(css).toContain('[data-theme-heads="ab"]');
    if (last.truncated) expect(css.split("@container").pop()).not.toContain("theme-legend");
  });
});
