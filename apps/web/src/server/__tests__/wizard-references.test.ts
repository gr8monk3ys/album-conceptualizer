import { describe, expect, it } from "vitest";

import { AlbumJsonSchema } from "@/server/album-json";
import { MAX_WIZARD_REFERENCES, wizardReferenceRows } from "@/server/wizard-references";

describe("wizardReferenceRows", () => {
  it("turns each wizard reference into a whole-album reference, in the order typed", () => {
    const rows = wizardReferenceRows("album-1", ["Blonde — Frank Ocean", "  OK Computer  "]);
    expect(rows).toEqual([
      {
        albumId: "album-1",
        songId: null,
        songTrackNumber: null,
        songTitle: null,
        title: "Blonde",
        artist: "Frank Ocean",
        moodTags: [],
        arrangementTags: [],
      },
      {
        albumId: "album-1",
        songId: null,
        songTrackNumber: null,
        songTitle: null,
        title: "OK Computer",
        artist: null,
        moodTags: [],
        arrangementTags: [],
      },
    ]);
  });

  it("reads each line as title and artist, as the wizard's preview shows it", () => {
    const rows = wizardReferenceRows("a", ["Blonde, Frank Ocean", "Hey, Soul Sister, Train", "Stand by Me by Ben E. King"]);
    expect(rows.map(({ title, artist }) => ({ title, artist }))).toEqual([
      { title: "Blonde", artist: "Frank Ocean" },
      { title: "Hey, Soul Sister", artist: "Train" },
      { title: "Stand by Me", artist: "Ben E. King" },
    ]);
  });

  it("keeps the same title by two artists, and drops a repeat of both", () => {
    const rows = wizardReferenceRows("a", ["Hurt — Nine Inch Nails", "Hurt — Johnny Cash", "hurt - johnny cash"]);
    expect(rows.map((row) => row.artist)).toEqual(["Nine Inch Nails", "Johnny Cash"]);
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
