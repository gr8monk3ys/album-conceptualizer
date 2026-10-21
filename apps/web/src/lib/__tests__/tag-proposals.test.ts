import { describe, expect, it } from "vitest";

import { countTags, describeAddedTags } from "@/lib/tag-proposals";

const none = { themes: [], motifs: [], characters: [] };

describe("describeAddedTags", () => {
  it("names each tag and its track, in track order", () => {
    expect(
      describeAddedTags([
        { ...none, trackNumber: 5, themes: ["signal"], motifs: ["static"] },
        { ...none, trackNumber: 4, themes: ["tide"] },
      ]),
    ).toBe("Added tide to 04, signal and static to 05.");
  });

  it("counts instead of naming past six tags", () => {
    const many = { ...none, trackNumber: 7, themes: ["a", "b", "c", "d"] };
    expect(describeAddedTags([many, { ...none, trackNumber: 4, motifs: ["e", "f", "g"] }])).toBe(
      "Added 7 tags on tracks 04 and 07.",
    );
  });

  it("says when nothing was added", () => {
    expect(describeAddedTags([{ ...none, trackNumber: 1 }])).toMatch(/^No tags were added/);
  });

  it("counts every kind", () => {
    expect(countTags([{ trackNumber: 1, themes: ["a"], motifs: ["b"], characters: ["Mara"] }])).toBe(3);
  });
});
