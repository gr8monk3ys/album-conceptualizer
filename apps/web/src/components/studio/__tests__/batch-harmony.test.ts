import { describe, expect, it } from "vitest";

import {
  applyProgressionToType,
  batchChordsSummary,
  isStarterLoopSection,
  restoreProgressions,
  sameTypeTargets,
  sectionChordSummary,
  type StudioSection,
} from "@/components/studio/studio-model";

function section(id: string, section_type: string, chords: string[], order = 0): StudioSection {
  return { id, section_type, order, lyrics: "", chord_progression: chords, notes: "" };
}

const track = () => [
  section("v1", "verse", ["Am", "F", "C", "G"], 0),
  section("c1", "chorus", ["F", "G", "Am"], 1),
  section("v2", "verse", ["C", "G", "Am", "F"], 2),
  section("v3", "Verse", [], 3),
  section("v4", "verse", ["Am", "F", "C", "G"], 4),
];

describe("sameTypeTargets", () => {
  it("lists the other sections of the same type whose chords differ, any casing", () => {
    expect(sameTypeTargets(track(), 0)).toEqual([2, 3]);
  });

  it("is empty when every section of the type already has these chords", () => {
    expect(sameTypeTargets(track(), 1)).toEqual([]);
  });

  it("never spreads an empty or unreadable progression", () => {
    const sections = track();
    expect(sameTypeTargets(sections, 3)).toEqual([]);
    sections[0] = section("v1", "verse", ["Am", "banana"], 0);
    expect(sameTypeTargets(sections, 0)).toEqual([]);
  });

  it("is empty for an index out of range", () => {
    expect(sameTypeTargets(track(), 9)).toEqual([]);
  });
});

describe("applyProgressionToType", () => {
  it("copies the chords onto every other section of the type and records what they held", () => {
    const before = track();
    const result = applyProgressionToType(before, 0);
    expect(result?.changed).toEqual([2, 3]);
    expect(result?.previous).toEqual([
      { id: "v2", chords: ["C", "G", "Am", "F"] },
      { id: "v3", chords: [] },
    ]);
    expect(result?.sections.map((s) => s.chord_progression)).toEqual([
      ["Am", "F", "C", "G"],
      ["F", "G", "Am"],
      ["Am", "F", "C", "G"],
      ["Am", "F", "C", "G"],
      ["Am", "F", "C", "G"],
    ]);
    // Pure: the input is untouched, and the copies don't share the source's array.
    expect(before[2]?.chord_progression).toEqual(["C", "G", "Am", "F"]);
    expect(result?.sections[2]?.chord_progression).not.toBe(before[0]?.chord_progression);
  });

  it("returns null when nothing would change", () => {
    expect(applyProgressionToType(track(), 1)).toBeNull();
  });

  it("is undone exactly by restoreProgressions", () => {
    const before = track();
    const result = applyProgressionToType(before, 0);
    expect(result).not.toBeNull();
    expect(restoreProgressions(result!.sections, result!.previous)).toEqual(before);
  });
});

describe("restoreProgressions", () => {
  it("only touches the snapshotted sections, found by id after a reorder", () => {
    const sections = [section("b", "verse", ["D"]), section("a", "verse", ["E"])];
    expect(restoreProgressions(sections, [{ id: "a", chords: ["F", "G"] }]).map((s) => s.chord_progression)).toEqual([
      ["D"],
      ["F", "G"],
    ]);
  });
});

describe("batchChordsSummary", () => {
  it("names the sections and the chords", () => {
    expect(batchChordsSummary(["Verse 2"], ["Am", "F"])).toBe("Set Verse 2 to Am F.");
    expect(batchChordsSummary(["Verse 2", "Verse 3"], ["Am", "F", "C", "G"])).toBe(
      "Set Verse 2 and Verse 3 to Am F C G.",
    );
  });
});

describe("sectionChordSummary", () => {
  const starter = () => [section("a", "verse", ["C", "G", "Am", "F"]), section("b", "chorus", ["C", "G", "Am", "F"])];

  it("says starter loop while the track's harmony is still the setup's", () => {
    expect(sectionChordSummary(starter(), 0)).toBe("starter loop");
    expect(isStarterLoopSection(starter(), 0)).toBe(true);
  });

  it("counts chords once the track's harmony is the artist's own, starter rotations included", () => {
    const sections = starter();
    sections[1] = section("b", "chorus", ["Am", "F", "C", "G"]);
    expect(sectionChordSummary(sections, 0)).toBe("4 chords");
    expect(isStarterLoopSection(sections, 0)).toBe(false);
  });

  it("says no chords for an empty section, and it is not a starter loop", () => {
    const sections = [section("a", "verse", [])];
    expect(sectionChordSummary(sections, 0)).toBe("no chords");
    expect(isStarterLoopSection(sections, 0)).toBe(false);
  });

  it("doesn't count unreadable tokens as chords, and names them", () => {
    expect(sectionChordSummary([section("a", "verse", ["Am", "banana", "F"])], 0)).toBe("2 chords · 1 unreadable");
    expect(sectionChordSummary([section("a", "verse", ["Dm7"])], 0)).toBe("1 chord");
    expect(sectionChordSummary([section("a", "verse", ["???"])], 0)).toBe("1 unreadable chord");
  });
});
