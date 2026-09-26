import { describe, expect, it } from "vitest";

import { albumStatusLabel } from "@/components/album-card";
import { albumCatalogStatus, albumSkipLabel } from "@/lib/album-skip";

describe("albumSkipLabel", () => {
  it("names the page the album frame's skip link lands on", () => {
    expect(albumSkipLabel("")).toBe("Skip to the Overview");
    expect(albumSkipLabel("coherence")).toBe("Skip to the Coherence report");
    expect(albumSkipLabel("bible")).toBe("Skip to the Story bible");
    expect(albumSkipLabel("style")).toBe("Skip to the Sound bible");
    expect(albumSkipLabel("references")).toBe("Skip to References");
    expect(albumSkipLabel("inbox")).toBe("Skip to comments and tasks");
    expect(albumSkipLabel("versions")).toBe("Skip to Version history");
  });

  it("leaves the Studio to its own skip link", () => {
    expect(albumSkipLabel("studio")).toBeNull();
  });

  it("says the page under an address the album has no page for", () => {
    expect(albumSkipLabel("mix")).toBe("Skip to the page");
  });
});

describe("albumCatalogStatus", () => {
  it("says an album on Discover once", () => {
    expect(albumCatalogStatus({ status: "published", isPublic: true }, albumStatusLabel)).toBe("On Discover");
  });

  it("gives the status in words otherwise", () => {
    expect(albumCatalogStatus({ status: "draft", isPublic: false }, albumStatusLabel)).toBe("Draft");
    expect(albumCatalogStatus({ status: "published", isPublic: false }, albumStatusLabel)).toBe("Published");
  });
});
