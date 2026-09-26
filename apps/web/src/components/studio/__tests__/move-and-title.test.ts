import { describe, expect, it } from "vitest";

import { positionOptions } from "@/components/studio/move-track-form";
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
