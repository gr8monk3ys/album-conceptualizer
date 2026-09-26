import { describe, expect, it } from "vitest";

import { buildAlbumBible } from "@/server/bible";
import { buildBibleMarkdown } from "@/server/bible-markdown";
import { buildHandoffPackMarkdown, STYLE_BIBLE_EMPTY_LINE } from "@/server/handoff-pack";

/** What the setup writes: placeholder lyrics, the starter loop, no Sound bible. */
function freshAlbum(count = 3, extra: Record<string, unknown> = {}) {
  return {
    title: "City Lights",
    artist: "Arc Runner",
    concept_summary: "A record about false exits and trying to reconnect.",
    narrative_structure: "",
    central_themes: [],
    recurring_motifs: [],
    reference_albums: [],
    songs: Array.from({ length: count }, (_, index) => ({
      title: `Track ${index + 1}`,
      track_number: index + 1,
      key: "C",
      tempo: 120,
      narrative_summary: null,
      themes: [],
      motifs: [],
      characters: [],
      sections: [
        { section_type: "verse", order: 1, lyrics: "[Verse line 1]", chord_progression: ["C", "G", "Am", "F"] },
        { section_type: "chorus", order: 2, lyrics: "[Chorus line 1]", chord_progression: ["C", "G", "Am", "F"] },
      ],
    })),
    ...extra,
  };
}

function reference(extra: { title: string; artist: string; songTrackNumber?: number }) {
  return {
    id: extra.title,
    songId: null,
    songTrackNumber: extra.songTrackNumber ?? null,
    songTitle: null,
    title: extra.title,
    artist: extra.artist,
    sourceUrl: null,
    notes: null,
    targetRole: null,
    bpm: null,
    key: null,
    moodTags: [],
    arrangementTags: [],
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

const PLACEHOLDERS = /_none_|_missing_|_unset_|_unspecified_|_No /;

describe("handoff packs", () => {
  for (const target of ["suno", "udio", "daw"] as const) {
    it(`never prints a placeholder for an unset field (${target})`, () => {
      const pack = buildHandoffPackMarkdown({ albumData: freshAlbum(), references: [], target });
      expect(pack).not.toMatch(PLACEHOLDERS);
      expect(pack).not.toMatch(/\bproject\b/i);
    });
  }

  it("says the empty Sound bible in one plain line", () => {
    const pack = buildHandoffPackMarkdown({ albumData: freshAlbum(), references: [], target: "suno" });
    const style = pack.split("## Sound bible")[1]?.split("\n## ")[0] ?? "";
    expect(style.trim()).toBe(STYLE_BIBLE_EMPTY_LINE);
    expect(pack).not.toContain("**Lead voice:**");
    expect(pack).not.toContain("Avoid / negative prompt");
  });

  it("prints only the Sound bible fields that are set", () => {
    const pack = buildHandoffPackMarkdown({
      albumData: freshAlbum(2, {
        style_bible: { lead_voice: "Close-mic alto", sonic_palette: ["chorused guitars"], avoid_list: ["trap hats"] },
      }),
      references: [],
      target: "suno",
    });
    expect(pack).toContain("- **Lead voice:** Close-mic alto");
    expect(pack).toContain("- **Sonic palette:** chorused guitars");
    expect(pack).toContain("**Avoid / negative prompt:** trap hats");
    expect(pack).not.toContain("**Mix priorities:**");
    expect(pack).not.toContain(STYLE_BIBLE_EMPTY_LINE);
  });

  it("says what is actually written and marks the starter loop", () => {
    const album = freshAlbum(3);
    album.songs[0].sections[0].lyrics = "Streetlights hum the same four notes";
    const pack = buildHandoffPackMarkdown({ albumData: album, references: [], target: "daw" });
    expect(pack).toContain("- **Lyrics written:** 1 of 3 tracks");
    expect(pack).toContain("- **Chords of their own:** 0 of 3 tracks (the rest are the starter loop or empty)");
    expect(pack).toContain("chords: C - G - Am - F (starter loop)");
    expect(pack).toContain("- **Still open:** no lyrics yet; starter chords or none");
    expect(pack).toMatch(/- \*\*Coherence:\*\* \d+ of \d+ tracks? written · Not scored yet/);
  });

  it("uses Story note and Role for a track's narrative fields", () => {
    const album = freshAlbum(1);
    Object.assign(album.songs[0], { narrative_summary: "She leaves.", narrative_position: "Inciting incident" });
    const pack = buildHandoffPackMarkdown({ albumData: album, references: [], target: "suno" });
    expect(pack).toContain("- **Story note:** She leaves.");
    expect(pack).toContain("- **Role:** Inciting incident");
    expect(pack).not.toMatch(/Narrative summary/i);
  });

  it("keeps artist names out of the prompt line and lists references apart (critique run 5)", () => {
    const album = freshAlbum(1, { central_themes: ["the sea", "duty"] });
    Object.assign(album.songs[0], {
      narrative_summary: "The first warning comes over the radio; she decides to keep counting.",
      themes: ["the sea", "duty"],
    });
    const references = [
      reference({ title: "Carrie & Lowell", artist: "Sufjan Stevens" }),
      reference({ title: "For Emma, Forever Ago", artist: "Bon Iver" }),
    ];
    for (const target of ["suno", "udio"] as const) {
      const pack = buildHandoffPackMarkdown({ albumData: album, references, target });
      const prompt = pack.split("#### Prompt line")[1]?.split("\n####")[0] ?? "";
      expect(prompt).not.toMatch(/Sufjan|Bon Iver|references:/);
      expect(prompt.replace(/\s+/g, " ")).toContain("keep counting. themes: the sea, duty.");
      expect(prompt).not.toContain("..");
      const listen = pack.split("#### References (for you, not the prompt)")[1]?.split("\n####")[0] ?? "";
      expect(listen).toContain("- Carrie & Lowell — Sufjan Stevens");
      expect(listen).toContain("- For Emma, Forever Ago — Bon Iver");
    }
  });

  it("doesn't add a second full stop after a question", () => {
    const album = freshAlbum(1);
    Object.assign(album.songs[0], { narrative_summary: "Will she stay?", themes: ["duty"] });
    const pack = buildHandoffPackMarkdown({ albumData: album, references: [], target: "suno" });
    expect(pack).toContain("Will she stay? themes: duty.");
    expect(pack).not.toContain("#### References (for you, not the prompt)");
  });

  it("dates the pack the way a person reads a date", () => {
    const pack = buildHandoffPackMarkdown({
      albumData: freshAlbum(1),
      references: [],
      target: "suno",
      generatedAt: new Date("2026-09-23T22:21:09.739Z"),
    });
    expect(pack).toContain("**Generated:** 23 September 2026");
    expect(pack).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(pack).toContain("## Sound bible");
    expect(pack).not.toMatch(/Voice \/ Sound bible/);
  });

  it("explains an unreadable album plainly", () => {
    const pack = buildHandoffPackMarkdown({ albumData: { title: 5 }, references: [], target: "suno" });
    expect(pack).toContain("couldn't be read");
    expect(pack).not.toMatch(/project|invalid/i);
  });
});

describe("the Bible as Markdown", () => {
  it("never prints a placeholder and says an empty Sound bible in one line", () => {
    const md = buildBibleMarkdown(buildAlbumBible(freshAlbum()), new Date("2026-09-23T10:00:00Z"));
    expect(md).not.toMatch(PLACEHOLDERS);
    expect(md).toContain("**Generated:** 23 September 2026");
    const style = md.split("## Sound bible")[1]?.split("\n## ")[0] ?? "";
    expect(style.trim()).toBe("Not set yet — add it in the Sound bible.");
    expect(md).not.toMatch(/Narrative summary|role:/i);
  });

  it("lists album motifs and track motif tags together", () => {
    const album = freshAlbum(2, { recurring_motifs: ["static"] });
    album.songs[1].motifs = ["the phone" as never];
    const md = buildBibleMarkdown(buildAlbumBible(album));
    expect(md).toContain("- **static** (album motif): on no track yet");
    expect(md).toContain("- **the phone**: track 2");
  });

  it("numbers sections from 1", () => {
    const md = buildBibleMarkdown(buildAlbumBible(freshAlbum(1)));
    expect(md).toContain("- verse #1");
    expect(md).toContain("- chorus #2");
  });
});
