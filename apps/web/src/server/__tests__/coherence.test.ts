import { describe, expect, it } from "vitest";

import {
  analyzeAlbumCoherence,
  coherenceFixHref,
  dimensionsWeakestFirst,
  weakestDimension,
  formatTrackList,
  formatTrackRuns,
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
    const lyrics = report.issues.find((issue) => issue.id === "missing_lyrics");
    expect(lyrics?.detail).toContain("Placeholder lines");
  });

  it("does not give harmony any credit for the copied starter loop", () => {
    expect(report.stats.songsWithChords).toBe(0);
    expect(report.stats.songsWithStarterChords).toBe(6);
    expect(breakdown(report, "harmony").score).toBe(0);
    const chords = report.issues.find((issue) => issue.id === "missing_chords");
    expect(chords?.title).toBe("No track has chords of its own yet");
    expect(chords?.detail).toContain("starter loop");
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
      fix: { focus: "lyrics", trackNumber: 1 },
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
    // Four tracks are still unwritten, so the summary leads with progress, then the written
    // tracks' score, and the capped overall second.
    expect(report.summary).toMatch(/^2 of 6 tracks written\. The written tracks score \d+; the whole album scores \d+\/100/);
    expect(report.writtenScore).not.toBeNull();
  });

  it("never counts the starter loop, even once lyrics exist", () => {
    const report = analyzeAlbumCoherence(
      album([scaffoldSong(0, { verse: "Real words" }), scaffoldSong(1, { chorus: "More words" })]),
    );
    expect(report.stats.songsWithChords).toBe(0);
    expect(report.stats.songsWithStarterChords).toBe(2);
    expect(breakdown(report, "harmony").score).toBe(0);
    expect(breakdown(report, "harmony").summary).toContain("0 of 2 tracks have chords of their own");
  });

  it("counts a starter loop once one chord of it changes", () => {
    const report = analyzeAlbumCoherence(
      album([scaffoldSong(0, { verse: "Words", verseChords: ["C", "G", "Am", "Em"] }), scaffoldSong(1, { verse: "Words" })]),
    );
    expect(report.stats.songsWithChords).toBe(1);
    expect(report.issues.find((issue) => issue.id === "missing_chords")?.title).toBe(
      "Track 2 has no chords of its own yet",
    );
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
    expect(callbacks?.suggestion).toContain("“phone”");
  });

  it("offers callback tracks as a sorted suggestion, not as problem tracks", () => {
    const seven = analyzeAlbumCoherence(
      album(
        Array.from({ length: 7 }, (_, index) =>
          scaffoldSong(index, { verse: "Words", motifs: index === 1 ? ["phone"] : [] }),
        ),
      ),
    );
    const callbacks = seven.issues.find((issue) => issue.id === "missing_callbacks");
    expect(callbacks?.relatedTracks).toBeUndefined();
    expect(callbacks?.suggestedTracks).toEqual([1, 4, 7]);
    expect(formatTrackList(callbacks?.suggestedTracks ?? [])).toBe("1, 4 and 7");
  });

  it("sends story-note findings to the Story note, never the Role", () => {
    const story = report.issues.find((issue) => issue.id === "missing_narrative_summaries");
    expect(story?.trackFocus).toBe("story");
    expect(coherenceFixHref("a1", story?.fix)).toBe("/app/albums/a1/studio?song=1&focus=story");
  });

  it("sends missing lyrics to the first unwritten lyrics", () => {
    const pending = analyzeAlbumCoherence(album([scaffoldSong(0, { verse: "Words" }), scaffoldSong(1)]));
    expect(pending.issues.find((issue) => issue.id === "missing_lyrics")).toMatchObject({
      trackFocus: "lyrics",
      fix: { focus: "lyrics", trackNumber: 2 },
    });
    expect(coherenceFixHref("a1", { focus: "lyrics", trackNumber: 2 })).toBe(
      "/app/albums/a1/studio?song=2&focus=lyrics",
    );
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
      // One term per concept: "Story note" and "Role", never the field names.
      expect(text).not.toMatch(/narrative summar|narrative position|narrative role/i);
    }
    expect(report.issues.find((issue) => issue.id === "missing_lyrics")).toMatchObject({
      title: "All 4 tracks still need lyrics",
      detail: expect.stringMatching(/^All 4 tracks have only placeholders or no lyrics\./),
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
      detail: "1 of 2 tracks has no story note, so its place in the arc can't be checked.",
      relatedTracks: [2],
      trackFocus: "story",
    });
  });
});

/** The critique's album: 7 tracks, lyrics on 3, everything else tagged and in place. */
function partlyWrittenAlbum(written = 3, total = 7) {
  return album(
    Array.from({ length: total }, (_, index) =>
      scaffoldSong(index, {
        verse: index < written ? "Streetlights hum the same four notes" : undefined,
        verseChords: ["Am", "G", "F", "E"],
        themes: ["distance"],
        motifs: ["phone"],
        narrative: "She leaves, then calls.",
      }),
    ),
    { recurring_motifs: ["phone"] },
  );
}

describe("honest signals on a half-written album", () => {
  const report = analyzeAlbumCoherence(partlyWrittenAlbum());
  const lyrics = () => report.issues.find((issue) => issue.id === "missing_lyrics");

  it("scores it, but calls it Unfinished with the count, never Needs polish", () => {
    expect(report.insufficient).toBe(false);
    expect(report.verdict.label).toBe("Unfinished");
    expect(report.verdict.detail).toBe("3 of 7 tracks written");
    expect(report.summary.startsWith("3 of 7 tracks written.")).toBe(true);
    expect(report.summary).not.toMatch(/Needs polish/);
  });

  it("frames the unwritten tracks as progress: ink, not the warning colour", () => {
    expect(report.verdict.tone).toBe("neutral");
    expect(lyrics()?.progress).toBe(true);
  });

  it("scores the written tracks on their own, and never below the capped overall", () => {
    expect(report.writtenScore).not.toBeNull();
    expect(report.writtenScore ?? 0).toBeGreaterThanOrEqual(report.score);
    expect(report.summary).toContain(`The written tracks score ${report.writtenScore}`);
    expect(report.summary).toContain(`the whole album scores ${report.score}/100`);
  });

  it("keeps real contradictions as problems, not progress", () => {
    const songs = partlyWrittenAlbum().songs as Array<Record<string, unknown>>;
    songs[1] = { ...songs[1], track_number: 1 };
    const duplicate = analyzeAlbumCoherence(album(songs));
    expect(duplicate.issues.find((issue) => issue.id === "duplicate_track_numbers")?.progress).toBeUndefined();
  });

  it("rates 4 empty tracks of 7 as an error and ranks it first", () => {
    expect(lyrics()).toMatchObject({
      severity: "error",
      title: "4 of 7 tracks still need lyrics",
      relatedTracks: [4, 5, 6, 7],
    });
    expect(report.issues[0].id).toBe("missing_lyrics");
    expect(report.nextActions[0].id).toBe("action-missing_lyrics");
  });

  it("caps every dimension at the share of written tracks", () => {
    expect(report.scoreCap).toBe(43);
    for (const item of report.breakdown) expect(item.score).toBeLessThanOrEqual(43);
    expect(breakdown(report, "lyrics").score).toBeLessThanOrEqual(43);
    expect(breakdown(report, "lyrics").heldBecause).toBe("only 3 of 7 tracks are written");
    expect(report.score).toBeLessThanOrEqual(43);
  });

  it("ranks missing lyrics first even above another error", () => {
    const songs = partlyWrittenAlbum().songs as Array<Record<string, unknown>>;
    songs[1] = { ...songs[1], track_number: 1 };
    const duplicate = analyzeAlbumCoherence(album(songs));
    expect(duplicate.issues.map((issue) => issue.id).slice(0, 2)).toEqual([
      "missing_lyrics",
      "duplicate_track_numbers",
    ]);
  });

  it("treats one empty track of a short album as an error", () => {
    const short = analyzeAlbumCoherence(partlyWrittenAlbum(2, 3));
    expect(short.issues[0]).toMatchObject({ id: "missing_lyrics", severity: "error", title: "Track 3 still needs lyrics" });
    expect(short.verdict.label).toBe("Unfinished");
  });

  it("keeps one empty track of a long album a warning, still first", () => {
    const long = analyzeAlbumCoherence(partlyWrittenAlbum(6, 7));
    expect(long.issues[0]).toMatchObject({ id: "missing_lyrics", severity: "warning" });
    expect(long.verdict.label).toBe("Unfinished");
  });

  it("uses the score bands only once every track is written", () => {
    const done = analyzeAlbumCoherence(partlyWrittenAlbum(7, 7));
    expect(done.issues.find((issue) => issue.id === "missing_lyrics")).toBeUndefined();
    expect(done.scoreCap).toBe(100);
    expect(["Tight", "Solid", "Needs polish", "Loose"]).toContain(done.verdict.label);
    expect(done.writtenScore).toBeNull();
  });
});

/**
 * The critique's case: 3 of 8 tracks written, so the cap holds every dimension at 38. The
 * written tracks have chords of their own but no story notes, so Narrative is the weak spot.
 */
function cappedAlbum() {
  return album(
    Array.from({ length: 8 }, (_, index) =>
      index < 3
        ? scaffoldSong(index, {
            verse: "Streetlights hum the same four notes",
            verseChords: ["Am", "G", "F", "E"],
            chorusChords: ["F", "G", "Am", "E"],
            themes: ["distance"],
            motifs: ["phone"],
          })
        : scaffoldSong(index, { themes: ["distance"], motifs: ["phone"] }),
    ),
    { recurring_motifs: ["phone"] },
  );
}

describe("each dimension's own signal while the cap holds", () => {
  const report = analyzeAlbumCoherence(cappedAlbum());

  it("keeps the cap: every dimension reads 38", () => {
    expect(report.scoreCap).toBe(38);
    for (const item of report.breakdown) {
      expect(item.score).toBe(38);
      expect(item.heldBecause).toBe("only 3 of 8 tracks are written");
    }
  });

  it("measures the uncapped value on the written tracks alone", () => {
    expect(breakdown(report, "harmony").uncapped).toBe(100);
    expect(breakdown(report, "harmony").signal).toBe("3 of 3 written tracks have chords of their own");
    expect(breakdown(report, "narrative").uncapped).toBe(82);
    expect(breakdown(report, "narrative").signal).toBe("0 of 3 written tracks have a story note");
    // Its three written tracks have verses only: the empty choruses don't count.
    expect(breakdown(report, "lyrics").signal).toBe("0 of 3 written tracks have a written chorus");
    expect(breakdown(report, "motifs").signal).toBe("1 motif comes back on a second track");
  });

  it("orders dimensions weakest first by their own value, ties in report order", () => {
    expect(dimensionsWeakestFirst(report.breakdown).map((item) => item.key)).toEqual([
      "narrative",
      "lyrics",
      "sequence",
      "motifs",
      "harmony",
    ]);
    expect(weakestDimension(report).key).toBe("narrative");
    // The report itself keeps its fixed order; pages sort.
    expect(report.breakdown.map((item) => item.key)).toEqual(["narrative", "lyrics", "harmony", "sequence", "motifs"]);
  });

  it("names the weak spot in the summary", () => {
    expect(report.summary).toContain("On the written ones, Narrative is weakest");
  });

  it("measures the whole album, with no hold, once every track is written", () => {
    const songs = (cappedAlbum().songs as Array<ReturnType<typeof scaffoldSong>>).map((song, index) =>
      scaffoldSong(index, {
        verse: "Words of its own",
        verseChords: ["Am", "G", "F", "E"],
        chorusChords: ["F", "G", "Am", "E"],
        themes: song.themes,
        motifs: song.motifs,
        narrative: "Something happens.",
      }),
    );
    const done = analyzeAlbumCoherence(album(songs, { recurring_motifs: ["phone"] }));
    for (const item of done.breakdown) {
      expect(item.heldBecause).toBeUndefined();
      expect(item.uncapped).toBe(item.score);
    }
    expect(breakdown(done, "harmony").signal).toBe("8 of 8 tracks have chords of their own");
  });

  it("says a starter-loop track has no chords of its own in the whole-album signal", () => {
    const songs = partlyWrittenAlbum(7, 7).songs as Array<Record<string, unknown>>;
    songs[6] = scaffoldSong(6, { verse: "Words", themes: ["distance"], motifs: ["phone"], narrative: "x" });
    const report = analyzeAlbumCoherence(album(songs, { recurring_motifs: ["phone"] }));
    const harmony = breakdown(report, "harmony");
    expect(harmony.signal).toBe("6 of 7 tracks have chords of their own");
    // Harmony scores no higher than its own chord share, so nothing holds it and nothing disagrees.
    expect(harmony.score).toBeLessThanOrEqual(86);
    expect(harmony.heldBecause).toBeUndefined();
    expect(harmony.lever).toBe("Change the starter loop on track 7 to lift Harmony.");
  });

  it("names the lever for a dimension held by the unwritten tracks", () => {
    for (const item of report.breakdown) {
      expect(item.lever).toBe("Write lyrics on 5 more tracks (4–8) to lift this.");
    }
  });

  it("names no lever for an unscored report", () => {
    const fresh = analyzeAlbumCoherence(scaffoldAlbum());
    for (const item of fresh.breakdown) expect(item.lever).toBeUndefined();
  });
});

// The critique's case (run 5): 3 of 8 tracks written, every one still on the starter loop.
// The row read "0 of 3 written tracks have chords of their own. Held at 0 because only 0 of 8
// tracks… · 55 on the written tracks alone".
describe("harmony while the written tracks still have the starter loop", () => {
  const report = analyzeAlbumCoherence(
    album(
      Array.from({ length: 8 }, (_, index) =>
        index < 3
          ? scaffoldSong(index, { verse: "Words of its own", themes: ["distance"], motifs: ["phone"] })
          : scaffoldSong(index, { themes: ["distance"], motifs: ["phone"] }),
      ),
      { recurring_motifs: ["phone"] },
    ),
  );
  const harmony = breakdown(report, "harmony");

  it("scores 0 on the written tracks too, agreeing with its signal", () => {
    expect(harmony.signal).toBe("0 of 3 written tracks have chords of their own");
    expect(harmony.score).toBe(0);
    expect(harmony.uncapped).toBe(0);
  });

  it("isn't held (the number is already its own) and names the lever in one sentence", () => {
    expect(harmony.heldBecause).toBeUndefined();
    expect(harmony.lever).toBe("Change the starter loop on tracks 1–3 to score Harmony.");
  });

  it("names the starter loop as the lever once one written track has chords", () => {
    const songs = Array.from({ length: 8 }, (_, index) =>
      index === 0
        ? scaffoldSong(index, { verse: "Words", verseChords: ["Am", "G", "F", "E"], chorusChords: ["F", "G", "Am", "E"] })
        : index < 4
          ? scaffoldSong(index, { verse: "Words of its own" })
          : scaffoldSong(index),
    );
    const partly = breakdown(analyzeAlbumCoherence(album(songs)), "harmony");
    expect(partly.signal).toBe("1 of 4 written tracks have chords of their own");
    expect(partly.uncapped).toBeLessThanOrEqual(25);
    expect(partly.score).toBeLessThanOrEqual(13);
    expect(partly.heldBecause).toBe("only 1 of 8 tracks has chords of its own");
    expect(partly.lever).toBe("Change the starter loop on tracks 2–4 to lift Harmony.");
  });
});

describe("formatTrackRuns", () => {
  it("collapses runs of three or more and keeps pairs", () => {
    expect(formatTrackRuns([1, 2, 3])).toBe("1–3");
    expect(formatTrackRuns([5, 1, 2, 3])).toBe("1–3 and 5");
    expect(formatTrackRuns([4, 5])).toBe("4 and 5");
    expect(formatTrackRuns([2, 4, 6])).toBe("2, 4 and 6");
    expect(formatTrackRuns([7])).toBe("7");
  });
});

describe("motifs read one source", () => {
  it("counts album motifs even before any track is tagged", () => {
    const report = analyzeAlbumCoherence(
      album([scaffoldSong(0, { verse: "Words" }), scaffoldSong(1, { verse: "Words" })], {
        recurring_motifs: ["static", "the phone"],
      }),
    );
    expect(report.stats.uniqueMotifs).toBe(2);
    expect(report.issues.find((issue) => issue.id === "no_motifs")).toBeUndefined();
    const callbacks = report.issues.find((issue) => issue.id === "missing_callbacks");
    expect(callbacks?.title).toBe("The album's motifs aren't on any track yet");
    expect(callbacks?.detail).toContain("“static”");
  });

  it("counts a motif as a callback when two tracks carry it, album-level or not", () => {
    const report = analyzeAlbumCoherence(
      album([
        scaffoldSong(0, { verse: "Words", motifs: ["Static"] }),
        scaffoldSong(1, { verse: "Words", motifs: ["static"] }),
      ]),
    );
    expect(report.stats.callbackMotifs).toBe(1);
    expect(report.issues.find((issue) => issue.id === "missing_callbacks")).toBeUndefined();
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

describe("a chorus counts once its lyrics are written", () => {
  // Every track starts with an empty chorus; a verse alone must not make the chorus "done".
  const versesOnly = album(
    Array.from({ length: 4 }, (_, index) =>
      scaffoldSong(index, { verse: `A written verse for track ${index + 1}\nand its second line` }),
    ),
  );

  it("doesn't count an empty or placeholder chorus", () => {
    const report = analyzeAlbumCoherence(versesOnly);
    expect(breakdown(report, "lyrics").signal).toBe("0 of 4 tracks have a written chorus");
  });

  it("counts it once the chorus has words", () => {
    const withChorus = album(
      Array.from({ length: 4 }, (_, index) =>
        scaffoldSong(index, {
          verse: `A written verse for track ${index + 1}`,
          chorus: index === 0 ? "A chorus that is really written" : undefined,
        }),
      ),
    );
    expect(breakdown(analyzeAlbumCoherence(withChorus), "lyrics").signal).toBe(
      "1 of 4 tracks have a written chorus",
    );
  });
});
