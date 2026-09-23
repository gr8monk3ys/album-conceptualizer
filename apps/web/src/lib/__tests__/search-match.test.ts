import { describe, expect, it } from "vitest";

import { findTagMatches, searchSnippet } from "@/lib/search-match";

const album = {
  id: "a1",
  title: "Coastline",
  data: {
    central_themes: ["Signal loss", "memory", "memory"],
    recurring_motifs: ["radio static"],
    songs: [
      { track_number: 3, title: "Static", themes: ["signal loss"], motifs: ["Radio static", ""] },
      { track_number: 1, title: "Tower", themes: ["Signal loss", "distance"], motifs: [] },
      { track_number: 2, title: "Tide", themes: ["memory"] },
      { title: "No number", themes: ["signal"] },
    ],
  },
};

describe("findTagMatches", () => {
  it("finds album themes and track themes, album first then sequence order", () => {
    const matches = findTagMatches([album], "signal");
    expect(matches.map((m) => [m.kind, m.tag, m.track?.number ?? null])).toEqual([
      ["theme", "Signal loss", null],
      ["theme", "Signal loss", 1],
      ["theme", "signal loss", 3],
    ]);
  });

  it("finds album motifs and track motifs, case insensitively", () => {
    const matches = findTagMatches([album], "STATIC");
    expect(matches.map((m) => [m.kind, m.tag, m.track?.title ?? null])).toEqual([
      ["motif", "radio static", null],
      ["motif", "Radio static", "Static"],
    ]);
  });

  it("drops duplicate tags on the same owner and ignores empty queries and bad data", () => {
    expect(findTagMatches([album], "memory")).toHaveLength(2);
    expect(findTagMatches([album], "  ")).toEqual([]);
    expect(findTagMatches([{ id: "x", title: "X", data: null }], "signal")).toEqual([]);
    expect(findTagMatches([{ id: "x", title: "X", data: { songs: "nope" } }], "signal")).toEqual([]);
  });
});

describe("searchSnippet", () => {
  it("keeps line breaks visible as a slash", () => {
    expect(searchSnippet("the signal fades\nInland the towers hum", "inland")).toBe(
      "the signal fades / Inland the towers hum",
    );
  });

  it("drops blank lines and collapses spaces", () => {
    expect(searchSnippet("one   two\n\n\nthree", "two")).toBe("one two / three");
  });

  it("trims around the match with ellipses on long text", () => {
    const text = `${"a ".repeat(60)}needle${" b".repeat(80)}`;
    const out = searchSnippet(text, "needle");
    expect(out.startsWith("…")).toBe(true);
    expect(out.endsWith("…")).toBe(true);
    expect(out).toContain("needle");
  });

  it("falls back to the opening when the query isn't in the text", () => {
    expect(searchSnippet("short line", "zzz")).toBe("short line");
    expect(searchSnippet("x".repeat(200), "zzz")).toHaveLength(141);
    expect(searchSnippet("   \n ", "a")).toBe("");
  });
});
