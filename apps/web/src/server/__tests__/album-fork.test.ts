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
      title: "Tide Tables",
      artist: "Mara Vale",
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
});
