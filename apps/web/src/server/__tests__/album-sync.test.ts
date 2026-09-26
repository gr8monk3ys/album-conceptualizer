import { describe, expect, it } from "vitest";

import { AlbumJsonSchema } from "@/server/album-json";
import { buildAlbumMutationData, keepFieldsTheStudioDoesNotEdit } from "@/server/album-sync";

describe("buildAlbumMutationData", () => {
  it("keeps the snapshot verbatim but skips duplicates in the relational projection", () => {
    const album = AlbumJsonSchema.parse({
      title: "Doubles",
      songs: [
        {
          title: "One",
          track_number: 1,
          sections: [
            { section_type: "verse", order: 0 },
            { section_type: "verse", order: 0 },
            { section_type: "chorus", order: 1 },
          ],
        },
        { title: "One again", track_number: 1 },
        { title: "Two", track_number: 2 },
      ],
    });

    const mutation = buildAlbumMutationData(album);
    const songs = mutation.songs?.create ?? [];
    expect(songs.map((s) => s.trackNumber)).toEqual([1, 2]);
    expect(songs[0].sections?.create.map((s) => s.sectionType)).toEqual(["verse", "chorus"]);
    expect(mutation.trackCount).toBe(3);
    expect((mutation.data as { songs: unknown[] }).songs).toHaveLength(3);
  });
});

describe("keepFieldsTheStudioDoesNotEdit", () => {
  const studio = AlbumJsonSchema.parse({
    title: "Studio copy",
    songs: [{ title: "One", track_number: 1 }],
    style_bible: { lead_voice: "stale" },
    rough_demos: [{ title: "Deleted since", source_kind: "voice-memo" }],
  });

  it("keeps the stored Sound bible and demos over the Studio's copy", () => {
    const stored = {
      title: "Stored",
      songs: [],
      style_bible: { lead_voice: "fresh", sonic_palette: ["tape"] },
      rough_demos: [],
    };
    const merged = keepFieldsTheStudioDoesNotEdit(stored, studio);
    expect(merged.title).toBe("Studio copy");
    expect(merged.songs).toHaveLength(1);
    expect(merged.style_bible).toMatchObject({ lead_voice: "fresh", sonic_palette: ["tape"] });
    expect(merged.rough_demos).toEqual([]);
  });

  it("drops a Sound bible the stored album doesn't have", () => {
    const merged = keepFieldsTheStudioDoesNotEdit({ title: "Stored", songs: [] }, studio);
    expect(merged.style_bible).toBeUndefined();
    expect("style_bible" in merged).toBe(false);
  });

  it("falls back to the Studio's copy when the stored fields can't be read", () => {
    const merged = keepFieldsTheStudioDoesNotEdit({ style_bible: "garbage", rough_demos: 3 }, studio);
    expect(merged.style_bible).toMatchObject({ lead_voice: "stale" });
    expect(merged.rough_demos.map((demo) => demo.title)).toEqual(["Deleted since"]);
    expect(keepFieldsTheStudioDoesNotEdit(null, studio).rough_demos).toHaveLength(1);
  });
});
