import { describe, expect, it } from "vitest";

import { applyAcceptedTags, proposeTagsFromLyrics } from "@/server/autotag";

function song(trackNumber: number, lyrics: string, extra: Record<string, unknown> = {}) {
  return {
    title: `Song ${trackNumber}`,
    track_number: trackNumber,
    themes: [],
    motifs: [],
    characters: [],
    sections: [{ section_type: "verse", order: 1, lyrics, chord_progression: [] }],
    ...extra,
  };
}

function album(songs: unknown[], extra: Record<string, unknown> = {}) {
  return {
    title: "Lighthouse",
    artist: "Mara Vale",
    concept_summary: "A keeper alone with a signal.",
    central_themes: ["tide", "signal"],
    recurring_motifs: ["static"],
    reference_albums: [],
    songs,
    ...extra,
  };
}

const TIDE = "The tide comes in, the tide goes out\nStatic on the line tonight\nThe tide, the tide, it keeps the time";

describe("proposeTagsFromLyrics", () => {
  it("proposes album themes and motifs that appear in the lyrics, per track", () => {
    const result = proposeTagsFromLyrics(album([song(1, TIDE), song(2, "Signal fires across the bay")]));
    expect(result?.writtenTracks).toBe(2);
    const first = result?.proposals.find((proposal) => proposal.trackNumber === 1);
    expect(first?.title).toBe("Song 1");
    expect(first?.themes).toContain("tide");
    expect(first?.motifs).toContain("static");
    expect(result?.proposals.find((proposal) => proposal.trackNumber === 2)?.themes).toEqual(["signal"]);
  });

  it("never proposes a tag the track already carries, whatever its case", () => {
    const result = proposeTagsFromLyrics(album([song(1, TIDE, { themes: ["Tide"], motifs: ["STATIC"] })]));
    const first = result?.proposals[0];
    expect(first?.themes.map((tag) => tag.toLowerCase())).not.toContain("tide");
    expect(first?.motifs.map((tag) => tag.toLowerCase())).not.toContain("static");
  });

  it("reads only written lyrics: placeholder lines propose nothing", () => {
    const result = proposeTagsFromLyrics(
      album([song(1, "[Verse line 1]\n[Verse line 2]\n[Verse line 3]\n[Verse line 1]\n[Verse line 2]")]),
    );
    expect(result).toEqual({ proposals: [], writtenTracks: 0 });
  });

  it("leaves out tracks with nothing to add", () => {
    const result = proposeTagsFromLyrics(album([song(1, TIDE), song(2, "Quiet words here")]));
    expect(result?.proposals.map((proposal) => proposal.trackNumber)).toEqual([1]);
  });

  it("returns null for an album it can't read", () => {
    expect(proposeTagsFromLyrics({ title: 5 })).toBeNull();
  });
});

describe("applyAcceptedTags", () => {
  const data = album([song(1, TIDE, { themes: ["memory"] }), song(2, "Signal fires")]);

  it("adds only the accepted tags and says exactly what it added", () => {
    const result = applyAcceptedTags(data, [
      { trackNumber: 1, themes: ["tide", "Memory"], motifs: [], characters: [] },
      { trackNumber: 2, themes: [], motifs: ["static"], characters: [] },
    ]);
    expect(result?.album.songs[0].themes).toEqual(["memory", "tide"]);
    expect(result?.album.songs[1].motifs).toEqual(["static"]);
    expect(result?.added).toEqual([
      { trackNumber: 1, themes: ["tide"], motifs: [], characters: [] },
      { trackNumber: 2, themes: [], motifs: ["static"], characters: [] },
    ]);
  });

  it("changes nothing for tracks that don't exist or tags already there", () => {
    const result = applyAcceptedTags(data, [
      { trackNumber: 9, themes: ["tide"], motifs: [], characters: [] },
      { trackNumber: 1, themes: ["MEMORY"], motifs: [], characters: [] },
    ]);
    expect(result?.added).toEqual([]);
    expect(result?.album.songs[0].themes).toEqual(["memory"]);
  });
});
