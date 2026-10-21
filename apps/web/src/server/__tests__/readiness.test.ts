import { describe, expect, it } from "vitest";

import { albumMotifIndex } from "@/lib/motifs";
import { nextAlbumStep } from "@/server/album-songs";
import { getAlbumReadiness } from "@/server/readiness";

function song(trackNumber: number, { lyrics, chords }: { lyrics?: string; chords?: string[] } = {}) {
  return {
    title: `Track ${trackNumber}`,
    track_number: trackNumber,
    themes: ["distance"],
    motifs: [],
    narrative_summary: "Something happens.",
    sections: [
      {
        section_type: "verse",
        order: 1,
        lyrics: lyrics ?? "[Verse line 1]",
        chord_progression: chords ?? ["C", "G", "Am", "F"],
      },
    ],
  };
}

describe("getAlbumReadiness", () => {
  it("counts written tracks, starter chords and Sound bible fields, each linked to its fix", () => {
    const readiness = getAlbumReadiness("a1", {
      songs: [song(1, { lyrics: "Words" }), song(2), song(3), song(4, { lyrics: "More", chords: ["Am", "E"] })],
    });
    expect(readiness.items.map((item) => [item.label, item.done, item.href])).toEqual([
      ["2 of 4 tracks written", false, "/app/albums/a1/studio?song=2&focus=lyrics"],
      ["Starter chords on 3 tracks", false, "/app/albums/a1/studio?song=1"],
      ["Sound bible 0 of 9 fields set", false, "/app/albums/a1/style"],
    ]);
    expect(readiness.ready).toBe(false);
    expect(readiness.question).toBe("Publish with 2 of 4 tracks written?");
  });

  it("is ready once every track is written with its own chords and the Sound bible is set", () => {
    const readiness = getAlbumReadiness("a1", {
      title: "City Lights",
      concept_summary: "A record about false exits.",
      songs: [{ ...song(1, { lyrics: "Words", chords: ["Am", "E"] }), characters: [] }],
      style_bible: { lead_voice: "Alto", sonic_palette: ["tape"], mix_priorities: ["vocal forward"] },
    });
    expect(readiness.ready).toBe(true);
    expect(readiness.items[0].label).toBe("1 of 1 track written");
  });

  it("names tracks with no chords at all apart from the starter loop", () => {
    const readiness = getAlbumReadiness("a1", { songs: [song(1, { chords: [] }), song(2)] });
    expect(readiness.items[1].label).toBe("No chords of their own on 2 tracks");
  });
});

describe("nextAlbumStep", () => {
  it("sends an unwritten track to its lyrics", () => {
    expect(nextAlbumStep("a1", { songs: [song(1)] }).href).toBe("/app/albums/a1/studio?song=1&focus=lyrics");
  });

  it("finishes a half-written track before starting the next empty one", () => {
    const half = {
      ...song(3, { lyrics: "Words" }),
      sections: [
        { section_type: "verse", order: 1, lyrics: "Words", chord_progression: [] },
        { section_type: "chorus", order: 2, lyrics: "[Chorus line 1]", chord_progression: [] },
      ],
    };
    const step = nextAlbumStep("a1", {
      songs: [song(1, { lyrics: "Words" }), song(2, { lyrics: "Words" }), half, song(4)],
    });
    expect(step.action).toBe("Finish track 3");
    expect(step.statement).toBe("Track 3 has 1 of 2 sections written");
    expect(step.href).toBe("/app/albums/a1/studio?song=3&focus=lyrics");
  });

  it("writes the empty track when it comes before the half-written one", () => {
    const half = {
      ...song(3),
      sections: [
        { section_type: "verse", order: 1, lyrics: "Words", chord_progression: [] },
        { section_type: "chorus", order: 2, lyrics: "", chord_progression: [] },
      ],
    };
    expect(nextAlbumStep("a1", { songs: [song(1, { lyrics: "Words" }), song(2), half] }).action).toBe("Write track 2");
  });

  it("asks for chords once lyrics, themes and story notes are in, since the starter loop doesn't count", () => {
    const step = nextAlbumStep("a1", { songs: [song(1, { lyrics: "Words" })] });
    expect(step.statement).toBe("Track 1 still has the starter chords");
    expect(step.action).toBe("Write chords for track 1");
  });
});

describe("albumMotifIndex", () => {
  it("merges album motifs and track tags case-insensitively", () => {
    const index = albumMotifIndex({
      recurring_motifs: ["Static", "the phone"],
      songs: [
        { track_number: 2, motifs: ["static"] },
        { track_number: 1, motifs: ["STATIC", "rain"] },
      ],
    });
    expect(index).toEqual([
      { name: "Static", albumLevel: true, trackNumbers: [1, 2] },
      { name: "rain", albumLevel: false, trackNumbers: [1] },
      { name: "the phone", albumLevel: true, trackNumbers: [] },
    ]);
  });
});
