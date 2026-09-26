import { describe, expect, it } from "vitest";

import { buildAlbumBible, looseThreadsSummary, themeArc, themeTracksPhrase } from "@/server/bible";

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

  it("reads early threads as next steps, and loose ones only once the album is written", () => {
    expect(looseThreadsSummary({ warnings: 2, writtenTracks: 3, totalTracks: 8 })).toBe(
      "2 threads to pick up as you write the other 5 tracks. Each opens where it's done.",
    );
    expect(looseThreadsSummary({ warnings: 1, writtenTracks: 0, totalTracks: 8 })).toBe(
      "1 thread to pick up as you write the tracks. Each opens where it's done.",
    );
    expect(looseThreadsSummary({ warnings: 2, writtenTracks: 8, totalTracks: 8 })).toBe(
      "2 threads don't hold across the album yet. Each links to where it's fixed.",
    );
  });
});

describe("buildAlbumBible threads", () => {
  function album(lyrics: [string, string]) {
    return {
      title: "Lighthouse Frequencies",
      central_themes: ["isolation", "signal"],
      songs: [
        { title: "Last Ferry", track_number: 1, themes: ["isolation"], characters: ["Mara"], sections: [{ section_type: "verse", order: 0, lyrics: lyrics[0] }] },
        { title: "Lamp Room", track_number: 2, themes: [], sections: [{ section_type: "verse", order: 0, lyrics: lyrics[1] }] },
      ],
    };
  }
  const titles = (data: unknown) =>
    buildAlbumBible(data)
      .issues.filter((issue) => issue.scope === "structure")
      .map((issue) => ({ title: issue.title, progress: Boolean(issue.progress) }));

  it("phrases a one-track theme or character as the next step while a track is unwritten", () => {
    expect(titles(album(["Salt on the glass", "[Verse line 1]"]))).toEqual([
      { title: "Bring “isolation” into another track", progress: true },
      { title: "Tag “signal” on the tracks that carry it", progress: true },
      { title: "Bring “Mara” back on another track", progress: true },
    ]);
  });

  it("names a loose thread, curly-quoted and with a two-figure track, once every track is written", () => {
    expect(titles(album(["Salt on the glass", "The lamp turns"]))).toEqual([
      { title: "Theme “isolation” only appears on track 01", progress: false },
      { title: "Theme “signal” isn't on any track", progress: false },
      { title: "Character “Mara” only appears once", progress: false },
    ]);
  });
});
