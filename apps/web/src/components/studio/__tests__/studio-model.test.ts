import { describe, expect, it } from "vitest";

import { albumFocusTarget } from "@/components/studio/album-details";
import {
  albumFrameKey,
  buildNewSong,
  carriedThemes,
  firstUnwrittenSection,
  moveItem,
  mergeRenames,
  moveTrackTo,
  moveUndoLabel,
  nextToWrite,
  normalizeKey,
  parseChordProgression,
  removeTrack,
  renumberTracks,
  restoreTrack,
  parseInitialAlbum,
  saveStatusParts,
  sharedTitleHint,
  toggleTheme,
  trackRenames,
  tracksSharingTitle,
  undoTrackMove,
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

describe("moveTrackTo one place", () => {
  it("swaps neighbours and renumbers the whole album 1…n", () => {
    const moved = moveTrackTo(songs(["Intro", "Signal", "Static"]), 2, 1);
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
    expect(moveTrackTo(gappy, 0, 1)?.map((s) => [s.track_number, s.title])).toEqual([
      [1, "B"],
      [2, "A"],
    ]);
  });

  it("refuses to move the first track up or the last one down", () => {
    expect(moveTrackTo(songs(["A", "B"]), 0, -1)).toBeNull();
    expect(moveTrackTo(songs(["A", "B"]), 1, 2)).toBeNull();
  });
});

describe("default track names follow their numbers", () => {
  const titles = (list: { track_number: number; title: string }[]) => list.map((s) => [s.track_number, s.title]);

  it("deleting the first track renames the default names after it, never a written one", () => {
    const album = songs(["Track 1", "Track 2", "Signal", "Track 4", " Track 5 ", "track 6"]);
    expect(titles(removeTrack(album, 0))).toEqual([
      [1, "Track 1"],
      [2, "Signal"],
      [3, "Track 3"],
      [4, "Track 4"],
      // "track 6" isn't the default (case-sensitive), so it keeps its name.
      [5, "track 6"],
    ]);
  });

  it("a default name only follows when it matched its old number", () => {
    // "Track 3" at position 2 is a name the artist chose (or a stale one): left as written.
    const album = [
      { title: "Intro", track_number: 1 },
      { title: "Track 3", track_number: 2 },
      { title: "Track 3", track_number: 3 },
    ];
    expect(titles(removeTrack(album, 0))).toEqual([
      [1, "Track 3"],
      [2, "Track 2"],
    ]);
  });

  it("moving a track up or down renames both default names", () => {
    const moved = moveTrackTo(songs(["Track 1", "Track 2", "Static"]), 1, 0);
    expect(moved && titles(moved)).toEqual([
      [1, "Track 1"],
      [2, "Track 2"],
      [3, "Static"],
    ]);
    const down = moveTrackTo(songs(["Signal", "Track 2", "Track 3"]), 0, 1);
    expect(down && titles(down)).toEqual([
      [1, "Track 1"],
      [2, "Signal"],
      [3, "Track 3"],
    ]);
  });

  it("Undo of a delete puts every name back", () => {
    const album = songs(["Track 1", "Track 2", "Signal", "Track 4"]);
    const deleted = album[0]!;
    const after = removeTrack(album, 0);
    expect(titles(restoreTrack(after, deleted, 0))).toEqual(titles(album));
  });

  it("an added track takes the default for its place; renumbering in place changes nothing", () => {
    const album = songs(["Track 1", "Signal"]);
    const added = renumberTracks([...album, buildNewSong(3)]);
    expect(titles(added)).toEqual([
      [1, "Track 1"],
      [2, "Signal"],
      [3, "Track 3"],
    ]);
    expect(renumberTracks(album)[0]).toBe(album[0]);
  });
});

describe("moving a track several places at once", () => {
  const withIds = (titles: string[]) => titles.map((title, i) => ({ id: `t${i}`, title, track_number: i + 1 }));
  const titles = (list: { track_number: number; title: string }[]) => list.map((s) => [s.track_number, s.title]);

  it("moves in one step, renumbering every default name between the two places", () => {
    const album = withIds(["Track 1", "Track 2", "Signal", "Track 4", "Track 5"]);
    const moved = moveTrackTo(album, 0, 3);
    expect(moved && titles(moved)).toEqual([
      [1, "Track 1"],
      [2, "Signal"],
      [3, "Track 3"],
      [4, "Track 4"],
      [5, "Track 5"],
    ]);
    // Which track is which: the moved one is now 04, and so named.
    expect(moved?.map((s) => s.id)).toEqual(["t1", "t2", "t3", "t0", "t4"]);
    expect(moveTrackTo(album, 4, 0)?.map((s) => s.id)).toEqual(["t4", "t0", "t1", "t2", "t3"]);
    expect(moveTrackTo(album, 1, 1)).toBeNull();
    expect(moveTrackTo(album, 1, 5)).toBeNull();
  });

  it("names the titles a move changed, and folds several moves into one", () => {
    const album = withIds(["Track 1", "Track 2", "Signal"]);
    const once = moveTrackTo(album, 0, 1)!;
    const renames = trackRenames(album, once);
    expect(renames).toEqual([
      { id: "t1", before: "Track 2", after: "Track 1" },
      { id: "t0", before: "Track 1", after: "Track 2" },
    ]);
    const twice = moveTrackTo(once, 1, 2)!;
    expect(mergeRenames(renames, trackRenames(once, twice))).toEqual([
      { id: "t1", before: "Track 2", after: "Track 1" },
      { id: "t0", before: "Track 1", after: "Track 3" },
    ]);
    // Moved back where it started: nothing is renamed any more.
    const back = moveTrackTo(once, 1, 0)!;
    expect(mergeRenames(renames, trackRenames(once, back))).toEqual([]);
  });

  it("Undo puts the track back where it was and every name as it was", () => {
    const album = withIds(["Track 1", "Track 2", "Signal", "Track 4"]);
    const moved = moveTrackTo(album, 0, 3)!;
    const undone = undoTrackMove(moved, "t0", 0, trackRenames(album, moved));
    expect(undone).toEqual(album);
  });

  it("Undo of several single steps restores the original place in one go", () => {
    const album = withIds(["Track 1", "Track 2", "Track 3", "Coda"]);
    let list = album;
    let renames: ReturnType<typeof trackRenames> = [];
    for (let i = 0; i < 3; i += 1) {
      const next = moveTrackTo(list, i, i + 1)!;
      renames = mergeRenames(renames, trackRenames(list, next));
      list = next;
    }
    expect(titles(list)).toEqual([
      [1, "Track 1"],
      [2, "Track 2"],
      [3, "Coda"],
      [4, "Track 4"],
    ]);
    expect(undoTrackMove(list, "t0", 0, renames)).toEqual(album);
  });

  it("Undo keeps a name the artist wrote since the move, and a stale default stays as it was", () => {
    // "Track 3" at 02 is a name the artist chose: a move never renames it, nor does Undo.
    const album = [
      { id: "a", title: "Intro", track_number: 1 },
      { id: "b", title: "Track 3", track_number: 2 },
      { id: "c", title: "Track 3", track_number: 3 },
    ];
    const moved = moveTrackTo(album, 0, 2)!;
    const renames = trackRenames(album, moved);
    expect(undoTrackMove(moved, "a", 0, renames)).toEqual(album);

    const defaults = withIds(["Track 1", "Signal"]);
    const swapped = moveTrackTo(defaults, 0, 1)!;
    const renamed = swapped.map((s) => (s.id === "t0" ? { ...s, title: "Lamp Oil" } : s));
    expect(titles(undoTrackMove(renamed, "t0", 0, trackRenames(defaults, swapped))!)).toEqual([
      [1, "Lamp Oil"],
      [2, "Signal"],
    ]);
    expect(undoTrackMove(renamed, "gone", 0, [])).toBeNull();
  });

  it("says the move from the first place to the last", () => {
    expect(moveUndoLabel("Track 1", "Track 2", 0, 1)).toBe("Moved “Track 1” (now “Track 2”) from 01 to 02.");
    expect(moveUndoLabel("Signal", "Signal", 0, 4)).toBe("Moved “Signal” from 01 to 05.");
    expect(moveUndoLabel(" ", "", 9, 2)).toBe("Moved “Untitled” from 10 to 03.");
  });
});

describe("tracks that share a title", () => {
  const album = [
    { title: "Signal", track_number: 1 },
    { title: " signal ", track_number: 2 },
    { title: "Static", track_number: 3 },
    { title: "SIGNAL", track_number: 7 },
    { title: "", track_number: 8 },
    { title: "  ", track_number: 9 },
  ];

  it("finds the others by trimmed, case-insensitive title; empty titles match nothing", () => {
    expect(tracksSharingTitle(album, 0)).toEqual([2, 7]);
    expect(tracksSharingTitle(album, 2)).toEqual([]);
    expect(tracksSharingTitle(album, 4)).toEqual([]);
    expect(tracksSharingTitle(album, 5)).toEqual([]);
    expect(tracksSharingTitle(album, 12)).toEqual([]);
  });

  it("names them in one line", () => {
    expect(sharedTitleHint([])).toBe("");
    expect(sharedTitleHint([3])).toBe("Track 03 is also called this.");
    expect(sharedTitleHint([3, 7])).toBe("Tracks 03 and 07 are also called this.");
    expect(sharedTitleHint([2, 5, 11])).toBe("Tracks 02, 05, and 11 are also called this.");
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

  it("picks the first unwritten section in order, never skipping an earlier empty Chorus", () => {
    // Verse 1 written, Chorus 1 empty, Verse 2 (current) being written, Chorus 2 empty.
    const track = { sections: [written, empty, written, empty] };
    expect(nextToWrite([track], 0, 2)).toEqual({ song: 0, section: 1 });
    // The current track comes first, then the album from its first track.
    const album = [{ sections: [empty] }, { sections: [written, written] }, { sections: [written, placeholder, empty] }];
    expect(nextToWrite(album, 2, 2)).toEqual({ song: 2, section: 1 });
    expect(nextToWrite(album, 1, 0)).toEqual({ song: 0, section: 0 });
    expect(nextToWrite(album, 0, 0)).toEqual({ song: 2, section: 1 });
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
