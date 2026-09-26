import { describe, expect, it } from "vitest";

import { carriedThemesPhrase, themeAbbreviations, themeHeadClasses, themeNamesFromRem } from "@/lib/theme-keys";

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
