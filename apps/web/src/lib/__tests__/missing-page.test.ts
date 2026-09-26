import { describe, expect, it } from "vitest";

import { missingAlbumPage } from "@/lib/missing-page";

describe("missingAlbumPage", () => {
  it("names the page asked for inside an album", () => {
    expect(missingAlbumPage("/app/albums/abc123/lyrics")).toEqual({ albumId: "abc123", page: "lyrics" });
  });

  it("keeps deeper paths and drops a trailing slash, query or hash", () => {
    expect(missingAlbumPage("/app/albums/abc/studio/extra/")).toEqual({ albumId: "abc", page: "studio/extra" });
    expect(missingAlbumPage("/app/albums/abc/mix?x=1")).toEqual({ albumId: "abc", page: "mix" });
  });

  it("decodes escapes, and shows a malformed one as typed", () => {
    expect(missingAlbumPage("/app/albums/abc/b%C3%A9a")?.page).toBe("béa");
    expect(missingAlbumPage("/app/albums/abc/%E0%A4%A")?.page).toBe("%E0%A4%A");
  });

  it("cuts a long path to 60 characters", () => {
    const page = missingAlbumPage(`/app/albums/abc/${"x".repeat(100)}`)?.page ?? "";
    expect(page).toHaveLength(60);
    expect(page.endsWith("…")).toBe(true);
  });

  it("is null outside an album page", () => {
    expect(missingAlbumPage("/app/albums/abc")).toBeNull();
    expect(missingAlbumPage("/app/library/x")).toBeNull();
  });
});
