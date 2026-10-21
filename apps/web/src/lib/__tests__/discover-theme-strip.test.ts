import { describe, expect, it } from "vitest";

import { THEME_STRIP_PITCH, themeStripPaths, themeThreadPhrase, themeTrackMarks } from "@/lib/discover";

describe("themeTrackMarks", () => {
  it("marks, for each theme in order, the tracks that carry it, in sequence", () => {
    const rows = [{ themeKeys: ["tide"] }, { themeKeys: [] }, { themeKeys: ["tide", "memory"] }];
    expect(themeTrackMarks(["Memory", "tide", "signal"], rows)).toEqual([
      [false, false, true],
      [true, false, true],
      [false, false, false],
    ]);
  });

  it("is empty for an album without themes", () => {
    expect(themeTrackMarks([], [{ themeKeys: ["tide"] }])).toEqual([]);
  });
});

describe("themeThreadPhrase", () => {
  it("says how far a theme runs through the sequence", () => {
    expect(themeThreadPhrase([true, false, true, true])).toBe("on 3 of 4 tracks");
    expect(themeThreadPhrase([true, true])).toBe("on every track");
    expect(themeThreadPhrase([true])).toBe("on its 1 track");
    expect(themeThreadPhrase([false, false])).toBe("on no track yet");
  });
});

describe("themeStripPaths", () => {
  it("draws one square per carrying track and one dot per other track, a pitch apart", () => {
    const { on, off, width } = themeStripPaths([true, false, true]);
    expect(width).toBe(3 * THEME_STRIP_PITCH);
    expect(on).toBe("M2 2h4v4h-4zM18 2h4v4h-4z");
    expect(off).toBe("M11 3h2v2h-2z");
  });

  it("draws nothing for an album without tracks", () => {
    expect(themeStripPaths([])).toEqual({ on: "", off: "", width: 0 });
  });
});
