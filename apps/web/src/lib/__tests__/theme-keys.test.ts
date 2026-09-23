import { describe, expect, it } from "vitest";

import { carriedThemesPhrase, themeAbbreviations } from "@/lib/theme-keys";

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
