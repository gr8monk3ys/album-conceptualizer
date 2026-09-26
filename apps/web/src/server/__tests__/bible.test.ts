import { describe, expect, it } from "vitest";

import { looseThreadsSummary, themeArc, themeTracksPhrase } from "@/server/bible";

describe("themeTracksPhrase", () => {
  it.each([
    [[3], 8, "on track 3"],
    [[1, 2, 7], 8, "on tracks 1, 2 and 7"],
    [[1, 2, 3], 3, "on all 3 tracks"],
    [[], 8, "on no track yet"],
  ])("%j of %i → %s", (tracks, total, expected) => {
    expect(themeTracksPhrase(tracks, total)).toBe(expected);
  });
});

describe("themeArc", () => {
  const eight = [1, 2, 3, 4, 5, 6, 7, 8];
  it.each([
    [[2, 3, 6, 7], eight, "first on 02, last on 07, missing from 04–05"],
    [[1, 3, 5], eight, "first on 01, last on 05, missing from 02 and 04"],
    [[2, 3, 4], eight, "first on 02, last on 04, unbroken"],
    [[3], eight, "only on 03"],
    [eight, eight, "on every track"],
    [[], eight, ""],
  ])("%j → %s", (tracks, sequence, expected) => {
    expect(themeArc(tracks, sequence)).toBe(expected);
  });

  it("reads along the map's order, such as the story order", () => {
    expect(themeArc([5, 1], [5, 3, 1, 2, 4])).toBe("first on 05, last on 01, missing from 03");
  });
});

describe("looseThreadsSummary", () => {
  it("never claims completeness over unwritten tracks", () => {
    expect(looseThreadsSummary({ warnings: 0, writtenTracks: 3, totalTracks: 8 })).toBe(
      "Nothing loose on the 3 written tracks; 5 tracks aren't written yet.",
    );
    expect(looseThreadsSummary({ warnings: 0, writtenTracks: 7, totalTracks: 8 })).toBe(
      "Nothing loose on the 7 written tracks; 1 track isn't written yet.",
    );
    expect(looseThreadsSummary({ warnings: 0, writtenTracks: 0, totalTracks: 8 })).toMatch(/no track is written yet/);
  });

  it("says the album holds once every track is written", () => {
    expect(looseThreadsSummary({ warnings: 0, writtenTracks: 8, totalTracks: 8 })).toBe(
      "Every theme, character and story order holds across the album.",
    );
  });

  it("counts loose threads and still notes unwritten tracks", () => {
    expect(looseThreadsSummary({ warnings: 2, writtenTracks: 3, totalTracks: 8 })).toBe(
      "2 threads don't hold across the album yet, and 5 tracks aren't written yet. Each links to where it's fixed.",
    );
  });
});
