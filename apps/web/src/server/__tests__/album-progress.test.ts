import { describe, expect, it } from "vitest";

import { albumProgress } from "@/server/album-progress";
import { analyzeAlbumCoherence } from "@/server/coherence";

function song(index: number, verse: string) {
  return {
    title: `Track ${index + 1}`,
    track_number: index + 1,
    key: "C",
    tempo: 100 + index * 7,
    narrative_summary: `What happens in track ${index + 1}.`,
    narrative_position: index === 0 ? "Opening" : "Rising",
    themes: ["distance"],
    motifs: ["headlights"],
    characters: [],
    sections: [
      { section_type: "verse", order: 1, lyrics: verse, chord_progression: ["Am", "F", "C", "G"] },
      {
        section_type: "chorus",
        order: 2,
        lyrics: "[Chorus line 1]\n[Chorus line 2]",
        chord_progression: ["Am", "F", "C", "G"],
      },
    ],
  };
}

function album(written: number, total: number) {
  return {
    title: "City Lights",
    artist: "Arc Runner",
    concept_summary: "A record about false exits and trying to reconnect.",
    narrative_structure: "linear",
    central_themes: ["distance", "return"],
    recurring_motifs: ["headlights"],
    reference_albums: [],
    songs: Array.from({ length: total }, (_, index) =>
      song(index, index < written ? `The lights go out on street number ${index + 1}` : "[Verse line 1]"),
    ),
  };
}

describe("albumProgress", () => {
  it("counts tracks with any written Section, never placeholders", () => {
    expect(albumProgress(album(3, 8))).toMatchObject({ tracks: 8, lyricsWritten: 3 });
    expect(albumProgress(album(0, 4))).toMatchObject({ tracks: 4, lyricsWritten: 0 });
  });

  it("shows the Coherence report's own verdict label", () => {
    for (const data of [album(0, 4), album(3, 8), album(5, 5)]) {
      expect(albumProgress(data).verdict).toBe(analyzeAlbumCoherence(data).verdict.label);
    }
    expect(albumProgress(album(3, 8)).verdict).toBe("Unfinished");
  });

  it("reads an unreadable snapshot as nothing written, not scored", () => {
    expect(albumProgress(null)).toEqual({ tracks: 0, lyricsWritten: 0, verdict: "Not scored yet" });
  });
});
