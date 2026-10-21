import { describe, expect, it } from "vitest";

import { forkAlbumJson } from "@/server/album-fork";
import { remixSource, remixSourceHref } from "@/server/remix-source";

describe("remixSource", () => {
  it("reads what Remix records on the fork", () => {
    const fork = forkAlbumJson(
      {
        id: "a",
        title: "Harbour Lights",
        artist: "  The Keepers ",
        songs: [],
      } as unknown as Parameters<typeof forkAlbumJson>[0],
      { sourceAlbumId: "album_123", remixerName: "Sam" },
    );
    expect(remixSource(fork)).toEqual({ albumId: "album_123", title: "Harbour Lights", artist: "The Keepers" });
  });

  it("keeps an older remix without an album id as plain provenance", () => {
    expect(remixSource({ remixed_from: { title: "Night Radio", artist: null } })).toEqual({
      albumId: null,
      title: "Night Radio",
      artist: null,
    });
  });

  it("is null for an album that isn't a remix or has nothing to show", () => {
    expect(remixSource(null)).toBeNull();
    expect(remixSource({})).toBeNull();
    expect(remixSource({ remixed_from: "Night Radio" })).toBeNull();
    expect(remixSource({ remixed_from: { title: "   ", album_id: "x" } })).toBeNull();
  });
});

describe("remixSourceHref", () => {
  it("has no link without an original to point at", async () => {
    await expect(remixSourceHref(null)).resolves.toBeNull();
    await expect(remixSourceHref({ albumId: null, title: "Night Radio", artist: null })).resolves.toBeNull();
  });
});
