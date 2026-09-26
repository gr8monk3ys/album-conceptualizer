import { describe, expect, it } from "vitest";

import { positionOptions } from "@/components/studio/move-track-form";
import { sectionMoveAnnouncement, sectionMoveUndoLabel } from "@/components/studio/studio-model";
import { STUDIO_GRID_COLUMNS, THEME_NAME_ROOM_REM, themeColumnClasses } from "@/components/studio/track-list";
import { themeHeadLines } from "@/lib/theme-keys";
import { singleLineTitle } from "@/components/studio/track-title";

describe("positionOptions", () => {
  it("offers every place, naming the track there now and marking the track's own", () => {
    const songs = [{ title: "Intro" }, { title: "Signal" }, { title: " " }];
    expect(positionOptions(songs, 1)).toEqual([
      { value: 0, label: "01 · now “Intro”" },
      { value: 1, label: "02 · where it is now" },
      { value: 2, label: "03 · now “Untitled”" },
    ]);
  });
});

describe("singleLineTitle", () => {
  it("turns typed or pasted line breaks into spaces", () => {
    expect(singleLineTitle("Storm\nWarning")).toBe("Storm Warning");
    expect(singleLineTitle("Storm\r\n\nWarning")).toBe("Storm Warning");
    expect(singleLineTitle("Storm Warning ")).toBe("Storm Warning ");
  });
});

describe("section moves", () => {
  it("name the section by its label, bare, and its new label when the move changes it", () => {
    expect(sectionMoveAnnouncement("Chorus 1", "Chorus 1", 0, 2)).toBe("Moved Chorus 1 to section 1 of 2.");
    expect(sectionMoveAnnouncement("Verse 2", "Verse 1", 0, 3)).toBe("Moved Verse 2 to section 1 of 3, now Verse 1.");
    expect(sectionMoveUndoLabel("Chorus 1", "Chorus 1", 1, 0)).toBe("Moved Chorus 1 from section 2 to 1.");
    expect(sectionMoveUndoLabel("Verse 2", "Verse 1", 1, 0)).toBe("Moved Verse 2 (now Verse 1) from section 2 to 1.");
  });
});

describe("theme columns", () => {
  it("head up to four themes by name in 3.5rem slots, and five or six by key until 80rem", () => {
    expect(themeColumnClasses(4)).toMatchObject({ slot: "w-14", key: "hidden", name: "block" });
    expect(themeColumnClasses(5).slot).toBe("w-11 @7xl:w-14");
    expect(themeColumnClasses(6).name).toBe("hidden @7xl:block");
  });

  it("hold a six-letter name whole and hyphenate a longer one", () => {
    expect(themeHeadLines("memory", THEME_NAME_ROOM_REM)).toEqual({ lines: ["memory"], truncated: false });
    expect(themeHeadLines("isolation", THEME_NAME_ROOM_REM).truncated).toBe(false);
    expect(themeHeadLines("isolation", THEME_NAME_ROOM_REM).lines).toHaveLength(2);
  });

  it("give the Sequence room for its named slots at every theme count", () => {
    // 14rem for number, title and lyrics, plus each theme's slot (@5xl), and 8rem more for Role (@7xl).
    const rem = (cls: string, at: string) => Number(new RegExp(`${at}:grid-cols-\\[([\\d.]+)rem`).exec(cls)?.[1]);
    for (let count = 1; count <= 4; count += 1) {
      expect(rem(STUDIO_GRID_COLUMNS[count], "@5xl")).toBe(14 + 3.5 * count);
    }
    for (let count = 1; count <= 6; count += 1) {
      expect(rem(STUDIO_GRID_COLUMNS[count], "@7xl")).toBe(22 + 3.5 * count);
    }
    expect(rem(STUDIO_GRID_COLUMNS[6], "@5xl")).toBe(14 + 2.75 * 6);
  });
});
