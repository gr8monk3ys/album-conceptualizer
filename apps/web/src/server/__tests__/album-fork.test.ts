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
});
