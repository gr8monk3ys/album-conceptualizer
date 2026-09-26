import { describe, expect, it } from "vitest";

import { placeFor, sectionPlaceLine, sectionPlacePhrase, sectionPlaces } from "@/lib/section-place";

// Critique run 12: comments were named by position ("Track 1 · Section 1 · Verse", "Resolved the
// comment on Track 1, section 1.") while every other surface names the track by its title.
const songs = [
  {
    track_number: 1,
    title: "Low Tide Leaving",
    sections: [
      { id: "s1", section_type: "verse" },
      { id: "s2", section_type: "chorus" },
      { id: "s3", section_type: "verse" },
    ],
  },
  { track_number: 2, title: "Harbour Lights", sections: [{ id: "s4", section_type: "pre_chorus" }] },
];

describe("section places", () => {
  const places = sectionPlaces(songs);

  it("names a section by track number, title and the Studio's label", () => {
    expect(sectionPlaceLine(places.get("s3")!)).toBe("01 · Low Tide Leaving · Verse 2");
    expect(sectionPlaceLine(places.get("s4")!)).toBe("02 · Harbour Lights · Pre-chorus 1");
    expect(sectionPlacePhrase(places.get("s2")!)).toBe("Low Tide Leaving, Chorus 1");
  });

  it("leaves out a blank title", () => {
    expect(sectionPlaceLine({ trackNumber: 3, songTitle: " ", sectionLabel: "Verse 1" })).toBe("03 · Verse 1");
    expect(sectionPlacePhrase({ trackNumber: 3, songTitle: null, sectionLabel: "Verse 1" })).toBe("track 3, Verse 1");
  });

  it("finds a section where it is now, whatever track number the comment recorded", () => {
    expect(placeFor(places, songs, { sectionId: "s4", songTrackNumber: 5, sectionType: "verse" })).toEqual({
      trackNumber: 2,
      songTitle: "Harbour Lights",
      sectionLabel: "Pre-chorus 1",
    });
  });

  it("falls back to what the comment recorded when its section is gone, and to the album with no track", () => {
    expect(placeFor(places, songs, { sectionId: "gone", songTrackNumber: 1, sectionType: "bridge" })).toEqual({
      trackNumber: 1,
      songTitle: "Low Tide Leaving",
      sectionLabel: "Bridge",
    });
    expect(placeFor(places, songs, { sectionId: null, songTrackNumber: null, sectionType: null })).toBeNull();
  });
});
