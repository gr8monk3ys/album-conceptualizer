import { describe, expect, it } from "vitest";

import { openingTrackTitle, trackTitlesByPosition } from "@/components/quickstart-track-names";

describe("trackTitlesByPosition", () => {
  it("keeps a blank line as an untitled track in its place", () => {
    const titles = trackTitlesByPosition("Lamp Room\n\nFog Horn", 5);
    expect(titles).toEqual(["Lamp Room", "", "Fog Horn"]);
    expect([0, 1, 2, 3, 4].map((index) => openingTrackTitle(titles, index))).toEqual([
      "Lamp Room",
      "Track 2",
      "Fog Horn",
      "Track 4",
      "Track 5",
    ]);
  });

  it("keeps leading and whitespace-only lines as positions too", () => {
    expect(trackTitlesByPosition("\n   \nSignal", 4)).toEqual(["", "", "Signal"]);
  });

  it("drops blank lines after the last title", () => {
    expect(trackTitlesByPosition("Lamp Room\nFog Horn\n\n\n", 8)).toEqual(["Lamp Room", "Fog Horn"]);
    expect(trackTitlesByPosition("\n\n", 8)).toEqual([]);
    expect(trackTitlesByPosition("", 8)).toEqual([]);
  });

  it("ignores lines past the track count", () => {
    expect(trackTitlesByPosition("One\n\nThree\nFour", 3)).toEqual(["One", "", "Three"]);
  });

  it("trims titles, keeps commas inside one, and reads Windows line endings", () => {
    expect(trackTitlesByPosition("  Blonde, Again \r\n\r\nLast", 3)).toEqual(["Blonde, Again", "", "Last"]);
  });
});
