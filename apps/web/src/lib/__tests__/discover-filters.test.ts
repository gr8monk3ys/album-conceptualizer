import { describe, expect, it } from "vitest";

import { discoverFilterSummary, hasActiveDiscoverFilters } from "@/lib/discover-filters";

describe("discoverFilterSummary", () => {
  it("always names the sort, then only the filters that narrow the list", () => {
    expect(discoverFilterSummary({ sort: "newest", show: "all", genre: null })).toEqual(["Newest"]);
    expect(discoverFilterSummary({ sort: "newest", show: "finished", genre: null })).toEqual([
      "Newest",
      "Finished only",
    ]);
    expect(discoverFilterSummary({ sort: "liked", show: "finished", genre: "Folk" })).toEqual([
      "Most liked",
      "Finished only",
      "Folk",
    ]);
    expect(discoverFilterSummary({ sort: "written", show: "all", genre: "  " })).toEqual(["Most written"]);
  });
});

describe("hasActiveDiscoverFilters", () => {
  it("is false only for the plain view", () => {
    expect(hasActiveDiscoverFilters({ sort: "newest", show: "all", genre: null })).toBe(false);
    expect(hasActiveDiscoverFilters({ sort: "written", show: "all", genre: null })).toBe(true);
    expect(hasActiveDiscoverFilters({ sort: "newest", show: "finished", genre: null })).toBe(true);
    expect(hasActiveDiscoverFilters({ sort: "newest", show: "all", genre: "folk" })).toBe(true);
  });
});
