import { describe, expect, it } from "vitest";

import { albumStatusLabel } from "@/components/album-card";
import { albumCatalogStatus, albumSkipLabel, appSkipTarget } from "@/lib/album-skip";

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

describe("appSkipTarget", () => {
  it("is one link per page, named for where it lands", () => {
    expect(appSkipTarget("/app")).toEqual({ label: "Skip to content", targetId: "app-main-content", studio: false });
    expect(appSkipTarget("/app/albums/a1")).toEqual({ label: "Skip to the Overview", targetId: "album-page", studio: false });
    expect(appSkipTarget("/app/albums/a1/coherence")).toMatchObject({ label: "Skip to the Coherence report", targetId: "album-page" });
    expect(appSkipTarget("/app/albums/a1/studio")).toEqual({ label: "Skip to the lyrics", targetId: "studio-editor", studio: true });
    expect(appSkipTarget("/app/discover/a1")).toMatchObject({ label: "Skip to content" });
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
