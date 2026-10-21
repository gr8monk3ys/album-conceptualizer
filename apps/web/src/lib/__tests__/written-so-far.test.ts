import { describe, expect, it } from "vitest";

import { trackCode, trackCodes } from "@/lib/track-number";
import { albumSoFar, writtenSoFar, type WrittenRow } from "@/lib/written-so-far";

function row(trackNumber: number, over: Partial<WrittenRow> = {}): WrittenRow {
  return {
    trackNumber,
    title: `Track ${trackNumber}`,
    lyricSections: 0,
    themeKeys: [],
    hasNarrative: false,
    writtenHarmony: false,
    ...over,
  };
}

const THEMES = ["Isolation", "signal", "tide", "memory"];

describe("writtenSoFar", () => {
  it("names nothing while no track is written", () => {
    expect(writtenSoFar([row(1), row(2)], THEMES)).toBeNull();
  });

  it("celebrates one written track: its number, title, what it holds and the themes it carries", () => {
    const rows = [
      row(1, {
        title: "Last Ferry",
        lyricSections: 2,
        writtenHarmony: true,
        hasNarrative: true,
        themeKeys: ["tide", "isolation"],
      }),
      row(2),
    ];
    expect(writtenSoFar(rows, THEMES)).toBe(
      "Track 01, Last Ferry, is written, with chords of its own and a story note, and carries Isolation and tide.",
    );
  });

  it("leaves out a setup title and the parts a track doesn't have", () => {
    expect(writtenSoFar([row(3, { lyricSections: 1 })], THEMES)).toBe("Track 03 is written.");
    expect(writtenSoFar([row(3, { lyricSections: 1, themeKeys: ["memory"] })], THEMES)).toBe(
      "Track 03 is written and carries memory.",
    );
  });

  it("sums up several written tracks", () => {
    const rows = [
      row(1, { lyricSections: 1, writtenHarmony: true, themeKeys: ["signal"] }),
      row(4, { lyricSections: 1, themeKeys: ["tide", "not an album theme"] }),
      row(5),
    ];
    expect(writtenSoFar(rows, THEMES)).toBe(
      "Tracks 01 and 04 are written, one with chords of its own; between them they carry signal and tide.",
    );
  });
});

describe("albumSoFar", () => {
  it("names the setup's sequence until a track is written, then the written tracks", () => {
    expect(albumSoFar([row(1), row(2)], ["tide", "signal"])).toBe("The sequence is set: 2 tracks, on tide and signal.");
    expect(albumSoFar([row(1, { lyricSections: 1 })], [])).toBe("Track 01 is written.");
    expect(albumSoFar([], ["tide"])).toBeNull();
  });
});

describe("track numbers", () => {
  it("are two figures, in lists too", () => {
    expect(trackCode(2)).toBe("02");
    expect(trackCode(12)).toBe("12");
    expect(trackCodes([2, 3, 11])).toBe("02, 03, and 11");
  });
});
