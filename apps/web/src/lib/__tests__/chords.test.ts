import { describe, expect, it } from "vitest";

import {
  STARTER_PROGRESSIONS,
  invalidChords,
  isChordSymbol,
  isWrittenProgression,
  parseProgression,
  trackHasWrittenHarmony,
  isScaffoldSection,
} from "@/lib/chords";

describe("chord symbols", () => {
  it.each(["C", "Am", "F#m7b5", "Bbmaj7", "G/B", "Dsus4", "E7#9", "Cadd9", "A5", "Gm6", "C7sus4", "Ebdim7", "Faug"])(
    "reads %s",
    (token) => expect(isChordSymbol(token)).toBe(true),
  );

  it.each(["banana", "Xq7", "H##", "c", "Am7x", "C/", "", "C#/H"])("rejects %s", (token) =>
    expect(isChordSymbol(token)).toBe(false),
  );

  it("splits typed chords on spaces, commas and bars, keeping order", () => {
    expect(parseProgression("Am7, D7 | Gmaj7  banana Xq7")).toEqual({
      chords: ["Am7", "D7", "Gmaj7"],
      invalid: ["banana", "Xq7"],
    });
  });
});

describe("written harmony", () => {
  it("never counts a starter loop", () => {
    for (const { chords } of STARTER_PROGRESSIONS) expect(isWrittenProgression([...chords])).toBe(false);
  });

  it("counts the artist's own readable chords", () => {
    expect(isWrittenProgression(["Am7", "D7", "Gmaj7"])).toBe(true);
  });

  it("doesn't count a progression the exports can't read", () => {
    expect(invalidChords(["Xq7", "H##", "banana"])).toEqual(["Xq7", "H##", "banana"]);
    expect(isWrittenProgression(["Am7", "banana"])).toBe(false);
    expect(trackHasWrittenHarmony([{ chord_progression: ["Xq7", "H##", "banana"] }])).toBe(false);
  });

  it("counts a starter loop the artist moved onto another section as their own", () => {
    // The setup writes one loop on every section; rotating the verse's loop is an edit.
    const sections = [
      { chord_progression: ["Am", "F", "C", "G"] },
      { chord_progression: ["C", "G", "Am", "F"] },
    ];
    expect(trackHasWrittenHarmony(sections)).toBe(true);
    expect(isScaffoldSection(sections, 0)).toBe(false);
  });

  it("keeps an untouched seeded track as scaffolding", () => {
    const sections = [
      { chord_progression: ["C", "G", "Am", "F"] },
      { chord_progression: ["C", "G", "Am", "F"] },
    ];
    expect(trackHasWrittenHarmony(sections)).toBe(false);
    expect(isScaffoldSection(sections, 1)).toBe(true);
  });
});

