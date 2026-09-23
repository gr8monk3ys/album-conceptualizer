import { describe, expect, it } from "vitest";

import { lyricExcerpt, lyricExcerptsByTrack, writtenSummaryLine } from "@/lib/discover";

const album = {
  songs: [
    {
      track_number: 2,
      title: "Tide",
      sections: [
        { order: 1, lyrics: "second verse line\nanother" },
        { order: 0, lyrics: "[Verse line 1]\n  first   line  \n\n[Hook]" },
      ],
    },
    { track_number: 1, title: "Tower", sections: [{ order: 0, lyrics: "[Verse line 1]" }] },
    { track_number: 3, title: "Static", sections: [] },
    { title: "Unnumbered", sections: [{ lyrics: "written" }] },
  ],
};

describe("writtenSummaryLine", () => {
  it("reads as a catalog line", () => {
    expect(writtenSummaryLine({ tracks: 7, withLyrics: 5 })).toBe("7 tracks · lyrics on 5");
    expect(writtenSummaryLine({ tracks: 1, withLyrics: 1 })).toBe("1 track · lyrics on all");
    expect(writtenSummaryLine({ tracks: 3, withLyrics: 0 })).toBe("3 tracks · no lyrics yet");
    expect(writtenSummaryLine({ tracks: 0, withLyrics: 0 })).toBe("0 tracks");
  });
});

describe("lyricExcerpt", () => {
  it("takes the first written lines in section order, without placeholders", () => {
    expect(lyricExcerpt(album.songs[0].sections)).toEqual(["first line", "second verse line"]);
    expect(lyricExcerpt(album.songs[0].sections, 3)).toEqual([
      "first line",
      "second verse line",
      "another",
    ]);
  });

  it("is empty when nothing is written", () => {
    expect(lyricExcerpt(album.songs[1].sections)).toEqual([]);
    expect(lyricExcerpt(undefined)).toEqual([]);
  });

  it("clips very long lines", () => {
    const [line] = lyricExcerpt([{ order: 0, lyrics: "word ".repeat(40) }]);
    expect(line.endsWith("…")).toBe(true);
    expect(line.length).toBeLessThanOrEqual(91);
  });

  it("maps excerpts by track number", () => {
    const map = lyricExcerptsByTrack(album);
    expect(map.get(2)).toEqual(["first line", "second verse line"]);
    expect(map.get(1)).toEqual([]);
    expect(map.size).toBe(3);
  });
});
