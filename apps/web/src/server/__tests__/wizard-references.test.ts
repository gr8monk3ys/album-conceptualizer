import { describe, expect, it } from "vitest";

import { AlbumJsonSchema } from "@/server/album-json";
import { MAX_WIZARD_REFERENCES, wizardReferenceRows } from "@/server/wizard-references";

describe("wizardReferenceRows", () => {
  it("turns each wizard reference into a whole-album reference, in the order typed", () => {
    const rows = wizardReferenceRows("album-1", ["Blonde, Frank Ocean", "  OK Computer  "]);
    expect(rows).toEqual([
      {
        albumId: "album-1",
        songId: null,
        songTrackNumber: null,
        songTitle: null,
        title: "Blonde, Frank Ocean",
        moodTags: [],
        arrangementTags: [],
      },
      {
        albumId: "album-1",
        songId: null,
        songTrackNumber: null,
        songTitle: null,
        title: "OK Computer",
        moodTags: [],
        arrangementTags: [],
      },
    ]);
  });

  it("creates nothing for an album set up without references", () => {
    expect(wizardReferenceRows("album-1", [])).toEqual([]);
    expect(wizardReferenceRows("album-1", undefined)).toEqual([]);
    // A snapshot parsed without the field still defaults to no references.
    const album = AlbumJsonSchema.parse({ title: "Plain", songs: [] });
    expect(wizardReferenceRows("album-1", album.reference_albums)).toEqual([]);
  });

  it("drops blanks and repeats, collapses spacing and caps the title at the form's length", () => {
    const long = "x".repeat(250);
    const rows = wizardReferenceRows("a", ["", "   ", "Kid  A", "kid a", "KID A ", long]);
    expect(rows.map((row) => row.title)).toEqual(["Kid A", "x".repeat(200)]);
  });

  it("stops at a sensible number, so a pasted list can't flood the collection", () => {
    const many = Array.from({ length: 40 }, (_, index) => `Record ${index + 1}`);
    const rows = wizardReferenceRows("a", many);
    expect(rows).toHaveLength(MAX_WIZARD_REFERENCES);
    expect(rows[0].title).toBe("Record 1");
  });
});
