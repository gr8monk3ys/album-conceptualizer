import { describe, expect, it } from "vitest";

import {
  analyzeAlbumCoherence,
  coherenceFixHref,
  isWrittenLyrics,
  type CoherenceReport,
} from "@/server/coherence";

const PROGRESSIONS = [
  { key: "C", chords: ["C", "G", "Am", "F"] },
  { key: "A minor", chords: ["Am", "F", "C", "G"] },
  { key: "G", chords: ["G", "D", "Em", "C"] },
  { key: "D minor", chords: ["Dm", "Bb", "F", "C"] },
];

type SongOverrides = {
  verse?: string;
  chorus?: string;
  verseChords?: string[];
  chorusChords?: string[];
  themes?: string[];
  motifs?: string[];
  narrative?: string | null;
};

/** The same shape the Create wizard writes: placeholder lyrics, one loop on both sections. */
function scaffoldSong(index: number, overrides: SongOverrides = {}) {
  const progression = PROGRESSIONS[index % PROGRESSIONS.length];
  return {
    title: `Track ${index + 1}`,
    track_number: index + 1,
    key: progression.key,
    tempo: 120,
    narrative_summary: overrides.narrative ?? null,
    themes: overrides.themes ?? [],
    motifs: overrides.motifs ?? [],
    characters: [],
    sections: [
      {
        section_type: "verse",
        order: 1,
        lyrics: overrides.verse ?? "[Verse line 1]\n[Verse line 2]\n[Verse line 3]\n[Verse line 4]",
        chord_progression: overrides.verseChords ?? progression.chords,
      },
      {
        section_type: "chorus",
        order: 2,
        lyrics: overrides.chorus ?? "[Chorus line 1]\n[Chorus line 2]\n[Chorus line 3]\n[Chorus line 4]",
        chord_progression: overrides.chorusChords ?? progression.chords,
      },
    ],
  };
}

function album(songs: unknown[], extra: Record<string, unknown> = {}) {
  return {
    title: "City Lights",
    artist: "Arc Runner",
    concept_summary: "A record about false exits and trying to reconnect.",
    narrative_structure: "linear",
    central_themes: ["distance", "return"],
    recurring_motifs: [],
    reference_albums: [],
    songs,
    ...extra,
  };
}

function scaffoldAlbum(count = 6) {
  return album(Array.from({ length: count }, (_, index) => scaffoldSong(index)));
}

function breakdown(report: CoherenceReport, key: string) {
  const item = report.breakdown.find((entry) => entry.key === key);
  if (!item) throw new Error(`missing breakdown ${key}`);
  return item;
}

describe("isWrittenLyrics", () => {
  it.each([
    ["[Verse line 1]\n[Verse line 2]", false],
    ["  [Chorus]  \n\n [Add lyrics here] ", false],
    ["", false],
    [null, false],
    [undefined, false],
    ["[Verse]\nThe lights go out on Fifth", true],
    ["no brackets at all", true],
  ])("%j → %s", (lyrics, expected) => {
    expect(isWrittenLyrics(lyrics as string | null | undefined)).toBe(expected);
  });
});

describe("analyzeAlbumCoherence on a template scaffold", () => {
  const report = analyzeAlbumCoherence(scaffoldAlbum());

  it("treats bracketed placeholders as unwritten", () => {
    expect(report.stats.songsWithLyrics).toBe(0);
    expect(report.issues.map((issue) => issue.id)).toContain("placeholder_lyrics");
  });

  it("does not give harmony full marks for the copied starting loop", () => {
    expect(report.stats.songsWithChords).toBe(0);
    expect(breakdown(report, "harmony").score).toBeLessThan(70);
    const chords = report.issues.find((issue) => issue.id === "missing_chords");
    expect(chords?.detail).toContain("starting loop");
  });

  it("flags the report as insufficient instead of praising it", () => {
    expect(report.insufficient).toBe(true);
    expect(report.summary).toBe(
      "Not enough material yet — write lyrics for two tracks to get a score.",
    );
    expect(report.summary).not.toMatch(/\/100/);
  });

  it("lists the missing pieces with where to fix them", () => {
    const ids = report.missing.map((piece) => piece.id);
    expect(ids).toEqual(["lyrics", "themes", "narrative"]);
    expect(report.missing[0]).toMatchObject({
      label: "Lyrics on 2 more tracks (0 of 2 written)",
      fix: { focus: "song", trackNumber: 1 },
    });
    expect(report.missing[1].fix).toEqual({ focus: "song-themes", trackNumber: 1 });
  });

  it("keeps the existing report shape for other callers", () => {
    expect(typeof report.score).toBe("number");
    expect(report.breakdown.map((item) => item.label)).toEqual([
      "Narrative",
      "Lyrics",
      "Harmony",
      "Sequence",
      "Motifs",
    ]);
    expect(report.nextActions.length).toBeGreaterThan(0);
  });
});

describe("analyzeAlbumCoherence with written material", () => {
  it("scores once two tracks have lyrics", () => {
    const songs = Array.from({ length: 6 }, (_, index) =>
      index < 2
        ? scaffoldSong(index, { verse: "[Verse]\nStreetlights hum the same four notes", themes: ["distance"] })
        : scaffoldSong(index),
    );
    const report = analyzeAlbumCoherence(album(songs));
    expect(report.stats.songsWithLyrics).toBe(2);
    expect(report.insufficient).toBe(false);
    expect(report.missing).toEqual([]);
    expect(report.summary).toMatch(/^\d+\/100 overall/);
  });

  it("still counts one loop on every section once lyrics exist", () => {
    const report = analyzeAlbumCoherence(
      album([scaffoldSong(0, { verse: "Real words" }), scaffoldSong(1, { chorus: "More words" })]),
    );
    expect(report.stats.songsWithChords).toBe(2);
  });

  it("counts distinct progressions written before lyrics", () => {
    const report = analyzeAlbumCoherence(
      album([scaffoldSong(0, { verseChords: ["Am", "G"], chorusChords: ["F", "C", "G"] })]),
    );
    expect(report.stats.songsWithChords).toBe(1);
  });

  it("asks a one-track album for that one track only", () => {
    const pending = analyzeAlbumCoherence(album([scaffoldSong(0)]));
    expect(pending.insufficient).toBe(true);
    expect(pending.missing[0].label).toBe("Lyrics on one more track (0 of 1 written)");

    const written = analyzeAlbumCoherence(album([scaffoldSong(0, { verse: "Words" })]));
    expect(written.insufficient).toBe(false);
  });
});

describe("where coherence issues are fixed", () => {
  const songs = [
    scaffoldSong(0, { verse: "Words", themes: ["neon"], motifs: ["phone"] }),
    scaffoldSong(1, { verse: "Words", themes: ["neon"] }),
    scaffoldSong(2, { verse: "Words", narrative: "She leaves." }),
    scaffoldSong(3, { verse: "Words" }),
  ];
  const report = analyzeAlbumCoherence(album(songs));
  const fixOf = (id: string) => report.issues.find((issue) => issue.id === id)?.fix;

  it("sends theme drift to the theme tags of the first track lacking an album theme", () => {
    expect(fixOf("theme_drift")).toEqual({ focus: "song-themes", trackNumber: 1 });
    const drift = report.issues.find((issue) => issue.id === "theme_drift");
    expect(drift?.relatedTracks).toEqual([1, 2, 3, 4]);
    expect(drift?.trackFocus).toBe("song-themes");
    expect(drift?.detail).toBe("No track carries one of the album's themes yet.");
  });

  it("sends missing story notes to the first track without one", () => {
    expect(fixOf("missing_narrative_summaries")).toEqual({ focus: "story", trackNumber: 1 });
  });

  it("sends a motif that never returns to the closer's motif tags", () => {
    expect(fixOf("missing_callbacks")).toEqual({ focus: "motifs", trackNumber: 4 });
    const callbacks = report.issues.find((issue) => issue.id === "missing_callbacks");
    expect(callbacks?.relatedTracks).toEqual([4, 3]);
    expect(callbacks?.suggestion).toContain("“phone”");
  });

  it("sends an album without motifs to the album's motifs", () => {
    const bare = analyzeAlbumCoherence(album([scaffoldSong(0, { verse: "Words" })]));
    expect(bare.issues.find((issue) => issue.id === "no_motifs")?.fix).toEqual({ focus: "album-motifs" });
  });

  it("carries the fix onto next actions", () => {
    for (const action of report.nextActions) {
      expect(action.fix).toBeDefined();
      expect(action.target).toBe("studio");
    }
  });

  it("builds Studio links from a fix", () => {
    expect(coherenceFixHref("a1", { focus: "story", trackNumber: 3 })).toBe(
      "/app/albums/a1/studio?song=3&focus=story",
    );
    expect(coherenceFixHref("a1", { focus: "album" })).toBe("/app/albums/a1/studio?focus=album");
    expect(coherenceFixHref("a1", { focus: "song", trackNumber: 2 })).toBe(
      "/app/albums/a1/studio?song=2",
    );
    expect(coherenceFixHref("a1", { focus: "style" })).toBe("/app/albums/a1/style");
    expect(coherenceFixHref("a1", { focus: "song-themes", trackNumber: 4 })).toBe(
      "/app/albums/a1/studio?song=4&focus=song-themes",
    );
    expect(coherenceFixHref("a1", { focus: "motifs", trackNumber: 1 })).toBe(
      "/app/albums/a1/studio?song=1&focus=motifs",
    );
    expect(coherenceFixHref("a1", { focus: "album-motifs" })).toBe("/app/albums/a1/studio?focus=album-motifs");
    expect(coherenceFixHref("a1", undefined)).toBe("/app/albums/a1/studio");
  });
});

describe("coherence copy", () => {
  it("says the album, never the project, and pluralises track counts", () => {
    const report = analyzeAlbumCoherence(scaffoldAlbum(4));
    for (const issue of report.issues) {
      const text = `${issue.title} ${issue.detail} ${issue.suggestion ?? ""}`;
      expect(text).not.toMatch(/\bproject\b/i);
      expect(text).not.toMatch(/\(s\)/);
      expect(text).not.toMatch(/\d+\/\d+ tracks/);
    }
    expect(report.issues.find((issue) => issue.id === "missing_lyrics")).toMatchObject({
      title: "4 tracks still need lyrics",
      detail: "All 4 tracks have only placeholders or no lyrics.",
    });
  });

  it("names a shared tempo instead of a zero spread", () => {
    const report = analyzeAlbumCoherence(scaffoldAlbum(4));
    const energy = report.issues.find((issue) => issue.id === "repeated_energy_profile");
    expect(energy?.detail).toContain("Every track has the same tempo (120 BPM).");
    expect(energy?.detail).not.toMatch(/spread|\b0 BPM/);
  });

  it("says what is missing when no tempo is set", () => {
    const songs = Array.from({ length: 4 }, (_, index) => ({ ...scaffoldSong(index), tempo: null }));
    const energy = analyzeAlbumCoherence(album(songs)).issues.find(
      (issue) => issue.id === "repeated_energy_profile",
    );
    expect(energy?.detail).toContain("No track has a tempo yet");
  });

  it("uses the singular for one track", () => {
    const songs = [
      scaffoldSong(0, { verse: "Words", narrative: "She leaves." }),
      scaffoldSong(1, { verse: "Words" }),
    ];
    const missing = analyzeAlbumCoherence(album(songs)).issues.find(
      (issue) => issue.id === "missing_narrative_summaries",
    );
    expect(missing).toMatchObject({
      title: "One track has no story note",
      detail: "1 of 2 tracks has no narrative summary, so its place in the arc can't be checked.",
      relatedTracks: [2],
      trackFocus: "story",
    });
  });
});

describe("an unreadable album", () => {
  it("is insufficient and says so plainly", () => {
    const report = analyzeAlbumCoherence({ title: 5 });
    expect(report.insufficient).toBe(true);
    expect(report.score).toBe(0);
    expect(report.summary).not.toMatch(/schema|json|payload/i);
  });
});
