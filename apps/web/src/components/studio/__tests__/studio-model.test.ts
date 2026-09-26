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
  normalizeKey,
  parseChordProgression,
  parseInitialAlbum,
  saveStatusParts,
  toggleTheme,
  unreadableChordsOnAlbum,
  unreadableChordsStatus,
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

describe("normalizeKey", () => {
  it("spells shorthand keys the way the Key select does", () => {
    expect(normalizeKey("C")).toBe("C major");
    expect(normalizeKey("G")).toBe("G major");
    expect(normalizeKey("Am")).toBe("A minor");
    expect(normalizeKey("A minor")).toBe("A minor");
    expect(normalizeKey("a min")).toBe("A minor");
    expect(normalizeKey("F#m")).toBe("F# minor");
    expect(normalizeKey("Bb")).toBe("Bb major");
    expect(normalizeKey("bbm")).toBe("Bb minor");
    expect(normalizeKey("E♭ Major")).toBe("Eb major");
    expect(normalizeKey("CM")).toBe("C major");
    expect(normalizeKey("Cmaj")).toBe("C major");
  });

  it("keeps other values as written and drops empty ones", () => {
    expect(normalizeKey("D dorian")).toBe("D dorian");
    expect(normalizeKey("  ")).toBeNull();
    expect(normalizeKey(null)).toBeNull();
    expect(normalizeKey(5)).toBeNull();
  });

  it("is applied when the Studio reads the album, so the select and catalog line agree", () => {
    const { album } = parseInitialAlbum({
      title: "Night Radio",
      songs: [
        { ...buildNewSong(1), key: "C" },
        { ...buildNewSong(2), key: "Am" },
        { ...buildNewSong(3), key: null },
      ],
    });
    expect(album.songs.map((s) => s.key)).toEqual(["C major", "A minor", null]);
  });
});

describe("parseChordProgression", () => {
  it("keeps every typed token in order, readable or not", () => {
    expect(parseChordProgression("Am, banana | F#m7\nG/B")).toEqual(["Am", "banana", "F#m7", "G/B"]);
    expect(parseChordProgression("  ")).toEqual([]);
  });
});

describe("saveStatusParts", () => {
  const idle = { saving: false, mode: "auto" as const, error: null, flash: null, dirty: false, lastSavedAt: null };

  it("announces a save the artist asked for, and its result", () => {
    expect(saveStatusParts({ ...idle, saving: true, mode: "manual" })).toEqual({ live: "Saving…", quiet: null });
    expect(saveStatusParts({ ...idle, flash: "Saved." })).toEqual({ live: "Saved.", quiet: null });
    expect(saveStatusParts({ ...idle, error: "The server can't be reached." })).toEqual({
      live: "Couldn't save — The server can't be reached.",
      quiet: null,
    });
  });

  it("keeps autosave and the ticking time out of the live region", () => {
    expect(saveStatusParts({ ...idle, saving: true })).toEqual({ live: "", quiet: "saving" });
    expect(saveStatusParts({ ...idle, dirty: true })).toEqual({ live: "", quiet: "unsaved" });
    expect(saveStatusParts({ ...idle, lastSavedAt: "2026-09-23T10:00:00Z" })).toEqual({ live: "", quiet: "saved-at" });
    expect(saveStatusParts(idle)).toEqual({ live: "", quiet: "no-changes" });
  });
});

describe("unreadableChordsOnAlbum", () => {
  it("counts every unreadable chord on the album and points at the first section that has one", () => {
    const songs = [
      { sections: [{ chord_progression: ["C", "G"] }] },
      { sections: [{ chord_progression: ["Am"] }, { chord_progression: ["banana", "F", "zz"] }] },
      { sections: [{ chord_progression: ["qq"] }] },
    ];
    expect(unreadableChordsOnAlbum(songs)).toEqual({ count: 3, first: { song: 1, section: 1 } });
  });

  it("is nothing when every chord reads", () => {
    expect(unreadableChordsOnAlbum([{ sections: [{ chord_progression: ["C", "Am7", "G/B"] }] }, { sections: null }])).toEqual({
      count: 0,
      first: null,
    });
  });

  it("says it in the save status with the right plural", () => {
    expect(unreadableChordsStatus(1)).toBe("1 chord won’t export");
    expect(unreadableChordsStatus(2)).toBe("2 chords won’t export");
  });
});
