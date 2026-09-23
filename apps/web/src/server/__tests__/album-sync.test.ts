import { describe, expect, it } from "vitest";

import { AlbumJsonSchema } from "@/server/album-json";
import { buildAlbumMutationData } from "@/server/album-sync";

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
