import { describe, expect, it } from "vitest";

import { applyAcceptedTags, proposeTagsFromLyrics, stem } from "@/server/autotag";

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
    expect((first?.themes ?? []).map((tag) => tag.toLowerCase())).not.toContain("tide");
    expect((first?.motifs ?? []).map((tag) => tag.toLowerCase())).not.toContain("static");
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

// The critique's album (run 5): a lighthouse keeper counting the last year. Before, "Tag from
// lyrics" proposed "down" as a theme, "count down" and "down count" as motifs, and ticked them.
describe("proposeTagsFromLyrics on the Salt Year lyrics", () => {
  const STORM =
    "The radio says the storm will turn\nbut the keeper knows the sound\nof water learning where we live\nand how to pull us down";
  const STORM_CHORUS = "Count it down, count it down\nevery wave a year\nI keep the light for no one now\nbut I am staying here";
  const LEDGER =
    "Ledger lines in salted ink\nthe names of those who left\nI tally boats and tally graves\nand tally what is kept";
  const COUNTING_HOUSE = "Memory is a counting house\nwe pay in what we lose";
  const CHOIR =
    "At low tide the bells ring up\nfrom churches underwater\nthe choir is all our grandmothers\nsinging to their daughters";

  function twoSections(trackNumber: number, first: string, second: string, extra: Record<string, unknown> = {}) {
    return {
      ...song(trackNumber, first, extra),
      sections: [
        { section_type: "verse", order: 1, lyrics: first, chord_progression: [] },
        { section_type: "chorus", order: 2, lyrics: second, chord_progression: [] },
      ],
    };
  }

  const saltYear = album(
    [
      twoSections(1, STORM, STORM_CHORUS, { themes: ["the sea", "duty"] }),
      twoSections(2, LEDGER, COUNTING_HOUSE),
      song(3, CHOIR, { themes: ["memory", "the sea"], motifs: ["lighthouse beam"] }),
    ],
    {
      title: "Salt Year",
      central_themes: ["memory", "erosion", "duty", "the sea"],
      recurring_motifs: ["count down", "lighthouse beam"],
    },
  );
  const result = proposeTagsFromLyrics(saltYear);
  const track = (n: number) => result?.proposals.find((proposal) => proposal.trackNumber === n);

  it("never proposes a function word or a reversed duplicate phrase", () => {
    const everything = (result?.proposals ?? []).flatMap((p) => [...p.themes, ...p.motifs, ...p.characters]);
    for (const junk of ["down", "down count", "count", "here", "now", "Count", "Memory"]) {
      expect(everything).not.toContain(junk);
    }
  });

  it("finds the album's own motif in the lyrics and ticks it", () => {
    expect(track(1)?.motifs).toEqual(["count down"]);
    expect(track(1)?.fromAlbum.motifs).toEqual(["count down"]);
    expect(track(1)?.themes).toEqual([]);
  });

  it("finds an album theme by stem, ranks it first, and leaves a new word unticked", () => {
    expect(track(2)?.themes).toEqual(["memory", "tally"]);
    expect(track(2)?.fromAlbum.themes).toEqual(["memory"]);
    // "counting" is not "count down": the phrase needs both words, near each other.
    expect(track(2)?.motifs).toEqual([]);
  });

  it("leaves out a track whose lyrics only repeat what it already carries", () => {
    expect(track(3)).toBeUndefined();
  });

  it("matches an album term by its content words only: \"the sea\" by sea, seas", () => {
    const data = album([song(1, "Seas of glass and a season of rain")], { central_themes: ["the sea"], recurring_motifs: [] });
    expect(proposeTagsFromLyrics(data)?.proposals[0]?.fromAlbum.themes).toEqual(["the sea"]);
    const noMatch = album([song(1, "A season of rain, a season of rain, a season of rain")], {
      central_themes: ["the sea"],
      recurring_motifs: [],
    });
    expect(proposeTagsFromLyrics(noMatch)?.proposals[0]?.fromAlbum.themes ?? []).toEqual([]);
  });

  it("proposes names only when they're capitalised mid-line, never the first word of a line", () => {
    const data = album(
      [song(1, "Harbour lights and Nell is waiting\nHarbour lights, I call for Nell\nHarbour bells")],
      { central_themes: [], recurring_motifs: [] },
    );
    const first = proposeTagsFromLyrics(data)?.proposals[0];
    expect(first?.characters).toEqual(["Nell"]);
    expect(first?.fromAlbum.characters).toEqual([]);
    // "harbour" repeats three times, but inside a phrase that repeats: the phrase is offered once.
    expect(first?.motifs).toEqual(["harbour lights"]);
    expect(first?.themes).toEqual([]);
  });

  it("names a character the album already has as a match", () => {
    const data = album(
      [song(1, "I wrote to Nell"), song(2, "the letter", { characters: ["Nell"] })],
      { central_themes: [], recurring_motifs: [] },
    );
    const first = proposeTagsFromLyrics(data)?.proposals[0];
    expect(first?.characters).toEqual(["Nell"]);
    expect(first?.fromAlbum.characters).toEqual(["Nell"]);
  });
});

describe("stem", () => {
  it("hears plurals and -ing forms as one word, without synonyms", () => {
    expect(stem("tides")).toBe(stem("tide"));
    expect(stem("counting")).toBe(stem("count"));
    expect(stem("memories")).toBe(stem("memory"));
    expect(stem("seas")).toBe(stem("sea"));
    expect(stem("season")).not.toBe(stem("sea"));
    expect(stem("water")).not.toBe(stem("sea"));
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
