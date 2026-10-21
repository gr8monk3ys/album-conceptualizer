import { describe, expect, it } from "vitest";

import { albumProblem, albumProblemField, parseInitialAlbum, studioDocumentTitle } from "@/components/studio/studio-model";

const album = (title: string, tracks: string[]) =>
  parseInitialAlbum({ title, songs: tracks.map((t, i) => ({ title: t, track_number: i + 1 })) }).album;

describe("albumProblemField", () => {
  it("points at the untitled track's title, the one albumProblem names", () => {
    const untitled = album("Harbour Lights", ["Intro", "Signal", "  "]);
    expect(albumProblem(untitled)).toBe("Give track 3 a title before saving.");
    expect(albumProblemField(untitled)).toEqual({ field: "track-title", index: 2 });
  });

  it("points at the album's title first", () => {
    expect(albumProblemField(album("", ["", "B"]))).toEqual({ field: "album-title" });
  });

  it("has nothing to point at when the album can be saved", () => {
    expect(albumProblemField(album("Harbour Lights", ["Intro"]))).toBeNull();
  });
});

describe("studioDocumentTitle", () => {
  it("names the selected track, then the album, in the root template's order", () => {
    expect(studioDocumentTitle({ title: "Harbour Wall", track_number: 3 }, "Salt Year")).toBe(
      "Studio · Harbour Wall · Salt Year · Album Conceptualizer",
    );
  });

  it("names an untitled track by its number", () => {
    expect(studioDocumentTitle({ title: "  ", track_number: 4 }, "Salt Year")).toBe(
      "Studio · Track 4 · Salt Year · Album Conceptualizer",
    );
  });

  it("leaves the track out when there is none", () => {
    expect(studioDocumentTitle(undefined, "Salt Year")).toBe("Studio · Salt Year · Album Conceptualizer");
  });
});
