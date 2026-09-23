import { describe, expect, it } from "vitest";

import { looseThreadsSummary, themeTracksPhrase } from "@/server/bible";

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
