import { describe, expect, it } from "vitest";

import { albumFocusTarget } from "@/components/studio/album-details";
import {
  albumFrameKey,
  buildNewSong,
  carriedThemes,
  firstUnwrittenSection,
  moveItem,
  moveTrack,
  nextToWrite,
  parseInitialAlbum,
  toggleTheme,
} from "@/components/studio/studio-model";

const songs = (titles: string[]) => titles.map((title, i) => ({ title, track_number: i + 1 }));

describe("moveItem", () => {
  it("moves an item and leaves the input untouched", () => {
    const list = ["a", "b", "c", "d"];
    expect(moveItem(list, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(list, 3, 1)).toEqual(["a", "d", "b", "c"]);
    expect(list).toEqual(["a", "b", "c", "d"]);
  });

  it("returns null for no-ops and out-of-range moves", () => {
    expect(moveItem(["a", "b"], 0, 0)).toBeNull();
    expect(moveItem(["a", "b"], 0, -1)).toBeNull();
    expect(moveItem(["a", "b"], 1, 2)).toBeNull();
    expect(moveItem([], 0, 1)).toBeNull();
  });
});

describe("moveTrack", () => {
  it("swaps neighbours and renumbers the whole album 1…n", () => {
    const moved = moveTrack(songs(["Intro", "Signal", "Static"]), 2, -1);
    expect(moved?.map((s) => [s.track_number, s.title])).toEqual([
      [1, "Intro"],
      [2, "Static"],
      [3, "Signal"],
    ]);
  });

  it("renumbers even when the input numbering had gaps", () => {
    const gappy = [
      { title: "A", track_number: 3 },
      { title: "B", track_number: 7 },
    ];
    expect(moveTrack(gappy, 0, 1)?.map((s) => [s.track_number, s.title])).toEqual([
      [1, "B"],
      [2, "A"],
    ]);
  });

  it("refuses to move the first track up or the last one down", () => {
    expect(moveTrack(songs(["A", "B"]), 0, -1)).toBeNull();
    expect(moveTrack(songs(["A", "B"]), 1, 1)).toBeNull();
  });
});

describe("toggleTheme", () => {
  it("adds a theme a track doesn't carry, in the album's casing", () => {
    expect(toggleTheme(["loss"], " Memory ")).toEqual(["loss", "Memory"]);
    expect(toggleTheme(null, "memory")).toEqual(["memory"]);
  });

  it("removes a theme the track carries, whatever its casing", () => {
    expect(toggleTheme(["memory", "Loss"], "loss")).toEqual(["memory"]);
    expect(toggleTheme(["MEMORY"], "memory")).toEqual([]);
  });

  it("ignores a blank theme", () => {
    expect(toggleTheme(["memory"], "  ")).toEqual(["memory"]);
  });
});

describe("carriedThemes", () => {
  it("lists the album themes a track carries, in album order", () => {
    expect(carriedThemes(["signal", "MEMORY", "other"], ["memory", "loss", "signal"])).toEqual(["memory", "signal"]);
  });
});

describe("firstUnwrittenSection / nextToWrite", () => {
  const written = { lyrics: "Salt on the glass" };
  const empty = { lyrics: "" };
  const placeholder = { lyrics: "[Verse line 1]" };

  it("finds the first section without written lyrics; placeholders don't count", () => {
    expect(firstUnwrittenSection([written, placeholder, empty])).toBe(1);
    expect(firstUnwrittenSection([written])).toBe(-1);
    expect(firstUnwrittenSection(null)).toBe(-1);
  });

  it("points to the next unwritten section after the current one, across tracks", () => {
    const album = [{ sections: [written, empty] }, { sections: [written, placeholder] }];
    expect(nextToWrite(album, 0, 0)).toEqual({ song: 0, section: 1 });
    expect(nextToWrite(album, 0, 1)).toEqual({ song: 1, section: 1 });
  });

  it("wraps round to earlier sections and never returns the current one", () => {
    const album = [{ sections: [empty, written] }, { sections: [empty] }];
    expect(nextToWrite(album, 1, 0)).toEqual({ song: 0, section: 0 });
    expect(nextToWrite([{ sections: [empty] }], 0, 0)).toBeNull();
  });

  it("is null when everything else is written or there are no sections", () => {
    expect(nextToWrite([{ sections: [written, written] }], 0, 0)).toBeNull();
    expect(nextToWrite([{ sections: [] }], 0, 0)).toBeNull();
  });
});

describe("albumFrameKey", () => {
  const base = parseInitialAlbum({ title: "Night Radio", songs: [buildNewSong(1), buildNewSong(2)] }).album;

  it("changes when the track count, order or a title changes", () => {
    const key = albumFrameKey(base);
    expect(albumFrameKey({ ...base, songs: base.songs.slice(1) })).not.toBe(key);
    expect(albumFrameKey({ ...base, songs: [...base.songs].reverse() })).not.toBe(key);
    expect(albumFrameKey({ ...base, songs: base.songs.map((s, i) => (i ? s : { ...s, title: "Static" })) })).not.toBe(key);
  });

  it("changes when a section's lyrics become written, not on every keystroke after", () => {
    const withLyrics = (lyrics: string) => ({
      ...base,
      songs: base.songs.map((s, i) => (i ? s : { ...s, sections: s.sections.map((sec) => ({ ...sec, lyrics })) })),
    });
    expect(albumFrameKey(withLyrics("Salt"))).not.toBe(albumFrameKey(base));
    expect(albumFrameKey(withLyrics("Salt on the glass"))).toBe(albumFrameKey(withLyrics("Salt")));
  });
});

describe("albumFocusTarget", () => {
  it("lands on the first empty album field: concept, then central themes, else the title", () => {
    expect(albumFocusTarget({ concept_summary: null, central_themes: [] })).toBe("album-concept");
    expect(albumFocusTarget({ concept_summary: "Radio at night", central_themes: [" "] })).toBe("album-central-themes");
    expect(albumFocusTarget({ concept_summary: "Radio at night", central_themes: ["memory"] })).toBe("album-title");
  });
});
