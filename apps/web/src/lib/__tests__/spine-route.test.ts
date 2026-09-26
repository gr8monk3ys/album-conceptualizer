import { describe, expect, it } from "vitest";

import { albumPageSegment, spineShowsThemes } from "@/lib/spine-route";

describe("albumPageSegment", () => {
  it("names the album page a pathname opens", () => {
    expect(albumPageSegment("/app/albums/abc")).toBe("");
    expect(albumPageSegment("/app/albums/abc/")).toBe("");
    expect(albumPageSegment("/app/albums/abc/bible")).toBe("bible");
    expect(albumPageSegment("/app/albums/abc/coherence?song=2")).toBe("coherence");
    expect(albumPageSegment("/app/albums/abc/style/extra")).toBe("style");
  });

  it("is null off an album", () => {
    expect(albumPageSegment("/app/library")).toBeNull();
    expect(albumPageSegment(null)).toBeNull();
    expect(albumPageSegment(undefined)).toBeNull();
  });
});

describe("spineShowsThemes", () => {
  it("leaves the theme columns to the Theme map on the Story bible", () => {
    expect(spineShowsThemes("/app/albums/abc/bible")).toBe(false);
    expect(spineShowsThemes("/app/albums/abc/bible/")).toBe(false);
  });

  it("shows them on every other album page", () => {
    for (const page of ["", "/coherence", "/style", "/export", "/versions", "/inbox"]) {
      expect(spineShowsThemes(`/app/albums/abc${page}`)).toBe(true);
    }
    // Not yet known (before the router has a pathname): the full spine.
    expect(spineShowsThemes(null)).toBe(true);
  });
});
