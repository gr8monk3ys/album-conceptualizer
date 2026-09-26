import { describe, expect, it } from "vitest";

import { forkAlbumJson } from "@/server/album-fork";
import { AlbumJsonSchema } from "@/server/album-json";

const source = AlbumJsonSchema.parse({
  title: "Tide Tables",
  artist: "Mara Vale",
  songs: [{ title: "Low Water", track_number: 1, sections: [{ section_type: "verse", order: 0 }] }],
});

describe("forkAlbumJson", () => {
  it("credits the remix to the remixer and keeps the original artist as provenance", () => {
    const remix = forkAlbumJson(source, { titleSuffix: " (Remix)", remixerName: " Theo " });
    expect(remix.artist).toBe("Theo");
    expect(remix.title).toBe("Tide Tables (Remix)");
    expect((remix as { remixed_from?: unknown }).remixed_from).toEqual({
      album_id: null,
      title: "Tide Tables",
      artist: "Mara Vale",
    });
  });

  it("records the original album's id, so the remix can link back to it", () => {
    const remix = forkAlbumJson(source, { remixerName: "Theo", sourceAlbumId: "album-123" });
    expect((remix as { remixed_from?: unknown }).remixed_from).toEqual({
      album_id: "album-123",
      title: "Tide Tables",
      artist: "Mara Vale",
    });
  });

  it("replaces a remix's own provenance with the album it was remixed from", () => {
    const first = forkAlbumJson(source, { remixerName: "Theo", sourceAlbumId: "album-1" });
    const second = forkAlbumJson(AlbumJsonSchema.parse(first), { remixerName: "Ana", sourceAlbumId: "album-2" });
    expect((second as { remixed_from?: unknown }).remixed_from).toEqual({
      album_id: "album-2",
      title: "Tide Tables",
      artist: "Theo",
    });
  });

  it("leaves the artist blank when the remixer's name isn't known", () => {
    expect(forkAlbumJson(source, { remixerName: null }).artist).toBeNull();
    expect(forkAlbumJson(source, { remixerName: "   " }).artist).toBeNull();
    expect(forkAlbumJson(source).artist).toBeNull();
  });

  it("gives the copy fresh ids", () => {
    const remix = forkAlbumJson(source);
    expect(remix.id).not.toBe(source.id);
    expect(remix.songs[0].id).not.toBe(source.songs[0].id);
    expect(remix.songs[0].sections[0].id).not.toBe(source.songs[0].sections[0].id);
  });

  it("leaves the owner's private working material behind", () => {
    const owned = AlbumJsonSchema.parse({
      title: "Tide Tables",
      artist: "Mara Vale",
      concept_summary: "A harbour town counts the tides.",
      central_themes: ["distance"],
      private_scratch: "don't share",
      rough_demos: [
        {
          title: "Voice memo",
          source_kind: "voice_memo",
          external_url: "https://dropbox.example/private/draft.m4a",
          capture_notes: "rough take, the neighbour's dog barks at 0:40",
          local_file: { name: "draft-final-FINAL.m4a" },
        },
      ],
      style_bible: { lead_voice: "Close and dry", sonic_palette: ["tape hiss"], owner_memo: "secret" },
      songs: [
        {
          title: "Low Water",
          track_number: 1,
          narrative_summary: "She waits on the pier.",
          production_notes: "ask Sam about the studio rate",
          song_memo: "private",
          sections: [
            {
              section_type: "verse",
              order: 0,
              lyrics: "The water goes out",
              chord_progression: ["Am", "F"],
              notes: "this line is about my ex",
              section_memo: "private",
            },
          ],
        },
      ],
    });
    const remix = forkAlbumJson(owned, { remixerName: "Theo" }) as Record<string, unknown>;

    expect(remix.rough_demos).toEqual([]);
    expect(remix.private_scratch).toBeUndefined();
    expect(remix.style_bible).toMatchObject({ lead_voice: "Close and dry", sonic_palette: ["tape hiss"] });
    expect(remix.style_bible).not.toHaveProperty("owner_memo");
    const song = (remix as { songs: Array<Record<string, unknown>> }).songs[0]!;
    expect(song.production_notes).toBeUndefined();
    expect(song.song_memo).toBeUndefined();
    expect(song.narrative_summary).toBe("She waits on the pier.");
    const section = (song.sections as Array<Record<string, unknown>>)[0]!;
    expect(section.notes).toBeUndefined();
    expect(section.section_memo).toBeUndefined();
    expect(section).toMatchObject({ section_type: "verse", order: 0, lyrics: "The water goes out", chord_progression: ["Am", "F"] });
    // What the album shows others comes along, and the copy is still a valid album.
    expect(remix.concept_summary).toBe("A harbour town counts the tides.");
    expect(remix.central_themes).toEqual(["distance"]);
    expect(AlbumJsonSchema.safeParse(remix).success).toBe(true);
  });
});
