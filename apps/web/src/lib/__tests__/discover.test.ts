import { describe, expect, it } from "vitest";

import {
  DEFAULT_DISCOVER_VIEW,
  arrangeDiscoverAlbums,
  discoverCountLine,
  discoverHref,
  genreOptions,
  isFinishedAlbum,
  isNarrowedView,
  lyricExcerpt,
  lyricExcerptsByTrack,
  parseDiscoverView,
  writtenSummaryLine,
} from "@/lib/discover";

const album = {
  songs: [
    {
      track_number: 2,
      title: "Tide",
      sections: [
        { order: 1, lyrics: "second verse line\nanother" },
        { order: 0, lyrics: "[Verse line 1]\n  first   line  \n\n[Hook]" },
      ],
    },
    { track_number: 1, title: "Tower", sections: [{ order: 0, lyrics: "[Verse line 1]" }] },
    { track_number: 3, title: "Static", sections: [] },
    { title: "Unnumbered", sections: [{ lyrics: "written" }] },
  ],
};

describe("writtenSummaryLine", () => {
  it("reads as a catalog line", () => {
    expect(writtenSummaryLine({ tracks: 7, withLyrics: 5 })).toBe("7 tracks · lyrics on 5");
    expect(writtenSummaryLine({ tracks: 1, withLyrics: 1 })).toBe("1 track · lyrics on all");
    expect(writtenSummaryLine({ tracks: 3, withLyrics: 0 })).toBe("3 tracks · no lyrics yet");
    expect(writtenSummaryLine({ tracks: 0, withLyrics: 0 })).toBe("0 tracks");
  });
});

describe("lyricExcerpt", () => {
  it("takes the first written lines in section order, without placeholders", () => {
    expect(lyricExcerpt(album.songs[0].sections)).toEqual(["first line", "second verse line"]);
    expect(lyricExcerpt(album.songs[0].sections, 3)).toEqual([
      "first line",
      "second verse line",
      "another",
    ]);
  });

  it("is empty when nothing is written", () => {
    expect(lyricExcerpt(album.songs[1].sections)).toEqual([]);
    expect(lyricExcerpt(undefined)).toEqual([]);
  });

  it("clips very long lines", () => {
    const [line] = lyricExcerpt([{ order: 0, lyrics: "word ".repeat(40) }]);
    expect(line.endsWith("…")).toBe(true);
    expect(line.length).toBeLessThanOrEqual(91);
  });

  it("maps excerpts by track number", () => {
    const map = lyricExcerptsByTrack(album);
    expect(map.get(2)).toEqual(["first line", "second verse line"]);
    expect(map.get(1)).toEqual([]);
    expect(map.size).toBe(3);
  });
});

describe("Discover view (sort and filter)", () => {
  const albums = [
    { id: "old-finished", tracks: 4, withLyrics: 4, likes: 1, publishedAt: "2026-01-01T00:00:00Z", primaryGenre: "Folk" },
    { id: "new-half", tracks: 8, withLyrics: 4, likes: 9, publishedAt: "2026-09-01T00:00:00Z", primaryGenre: "folk " },
    { id: "mid-most", tracks: 10, withLyrics: 7, likes: 3, publishedAt: "2026-05-01T00:00:00Z", primaryGenre: "Synth-pop" },
    { id: "empty", tracks: 0, withLyrics: 0, likes: 0, publishedAt: null, primaryGenre: null },
  ];
  const ids = (list: Array<{ id: string }>) => list.map((album) => album.id);

  it("reads a view from the URL, falling back to the defaults", () => {
    expect(parseDiscoverView({})).toEqual(DEFAULT_DISCOVER_VIEW);
    expect(parseDiscoverView({ q: " tide ", sort: "liked", show: "finished", genre: " Folk " })).toEqual({
      q: "tide",
      sort: "liked",
      show: "finished",
      genre: "Folk",
    });
    expect(parseDiscoverView({ sort: "loudest", show: "some", genre: "" })).toEqual(DEFAULT_DISCOVER_VIEW);
    expect(parseDiscoverView({ sort: ["written", "liked"] }).sort).toBe("written");
  });

  it("writes a view back to a linkable URL, leaving defaults out", () => {
    expect(discoverHref({})).toBe("/app/discover");
    expect(discoverHref({ sort: "newest", show: "all" })).toBe("/app/discover");
    expect(discoverHref({ q: "tide", sort: "written", show: "finished", genre: "Synth-pop" })).toBe(
      "/app/discover?q=tide&sort=written&show=finished&genre=Synth-pop",
    );
    const round = parseDiscoverView(Object.fromEntries(new URLSearchParams("sort=liked&genre=folk")));
    expect(discoverHref(round)).toBe("/app/discover?sort=liked&genre=folk");
  });

  it("sorts newest first, by tracks written, or by likes", () => {
    const all = { show: "all", genre: null } as const;
    expect(ids(arrangeDiscoverAlbums(albums, { ...all, sort: "newest" }))).toEqual([
      "new-half",
      "mid-most",
      "old-finished",
      "empty",
    ]);
    // 7 written beats 4; between two albums with 4 written, the finished one (a higher share) wins.
    expect(ids(arrangeDiscoverAlbums(albums, { ...all, sort: "written" }))).toEqual([
      "mid-most",
      "old-finished",
      "new-half",
      "empty",
    ]);
    expect(ids(arrangeDiscoverAlbums(albums, { ...all, sort: "liked" }))).toEqual([
      "new-half",
      "mid-most",
      "old-finished",
      "empty",
    ]);
  });

  it("breaks ties newest first, and keeps the input order when even that ties", () => {
    const tied = [
      { id: "a", tracks: 2, withLyrics: 1, likes: 2, publishedAt: "2026-02-01T00:00:00Z", primaryGenre: null },
      { id: "b", tracks: 2, withLyrics: 1, likes: 2, publishedAt: "2026-03-01T00:00:00Z", primaryGenre: null },
      { id: "c", tracks: 2, withLyrics: 1, likes: 2, publishedAt: "2026-03-01T00:00:00Z", primaryGenre: null },
    ];
    expect(ids(arrangeDiscoverAlbums(tied, { sort: "liked", show: "all", genre: null }))).toEqual(["b", "c", "a"]);
  });

  it("filters to finished albums (every track written) and to one genre, ignoring case", () => {
    expect(isFinishedAlbum({ tracks: 4, withLyrics: 4 })).toBe(true);
    expect(isFinishedAlbum({ tracks: 8, withLyrics: 4 })).toBe(false);
    expect(isFinishedAlbum({ tracks: 0, withLyrics: 0 })).toBe(false);
    expect(ids(arrangeDiscoverAlbums(albums, { sort: "newest", show: "finished", genre: null }))).toEqual([
      "old-finished",
    ]);
    expect(ids(arrangeDiscoverAlbums(albums, { sort: "newest", show: "all", genre: "FOLK" }))).toEqual([
      "new-half",
      "old-finished",
    ]);
    expect(ids(arrangeDiscoverAlbums(albums, { sort: "newest", show: "finished", genre: "synth-pop" }))).toEqual([]);
  });

  it("offers each genre once, alphabetically", () => {
    expect(genreOptions(["folk", "Folk ", null, "", "Ambient", undefined, "Synth-pop"])).toEqual([
      "Ambient",
      "folk",
      "Synth-pop",
    ]);
  });

  it("says what the list shows", () => {
    expect(discoverCountLine(12, DEFAULT_DISCOVER_VIEW)).toBe("12 published albums");
    expect(discoverCountLine(1, { ...DEFAULT_DISCOVER_VIEW, show: "finished" })).toBe("1 finished album");
    expect(discoverCountLine(3, { ...DEFAULT_DISCOVER_VIEW, show: "finished", genre: "folk" })).toBe(
      "3 finished albums in folk",
    );
    expect(discoverCountLine(2, { ...DEFAULT_DISCOVER_VIEW, q: "tide", show: "finished" })).toBe(
      "2 matches for “tide” · finished only",
    );
    expect(discoverCountLine(1, { ...DEFAULT_DISCOVER_VIEW, q: "tide" })).toBe("1 match for “tide”");
    expect(isNarrowedView(DEFAULT_DISCOVER_VIEW)).toBe(false);
    expect(isNarrowedView({ ...DEFAULT_DISCOVER_VIEW, sort: "liked" })).toBe(false);
    expect(isNarrowedView({ ...DEFAULT_DISCOVER_VIEW, genre: "folk" })).toBe(true);
  });
});
