import { describe, expect, it } from "vitest";

import { recordedRemixId, remixRowLink } from "../remix-links";

describe("remixRowLink", () => {
  it("leads to the remix on Discover while it is published", () => {
    expect(remixRowLink("remix-1", "/app/albums/original")).toEqual({
      href: "/app/discover/remix-1",
      onDiscover: true,
    });
  });

  it("falls back to the album that was remixed", () => {
    expect(remixRowLink(null, "/app/albums/original")).toEqual({ href: "/app/albums/original", onDiscover: false });
    expect(remixRowLink(null, null)).toBeNull();
  });
});

describe("recordedRemixId", () => {
  it("reads the remix's id when the notification recorded it", () => {
    expect(recordedRemixId({ remixAlbumId: " abc " })).toBe("abc");
  });

  it("ignores anything else", () => {
    expect(recordedRemixId(null)).toBeNull();
    expect(recordedRemixId([])).toBeNull();
    expect(recordedRemixId({ remixAlbumId: "" })).toBeNull();
    expect(recordedRemixId({ other: "x" })).toBeNull();
  });
});
