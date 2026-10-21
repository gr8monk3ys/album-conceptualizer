import { describe, expect, it } from "vitest";

import { REMIX_ARRIVAL_PARAM, remixArrivalHref } from "@/lib/remix-arrival";

describe("remixArrivalHref", () => {
  it("opens the new album's Studio marked as a fresh remix", () => {
    expect(remixArrivalHref("abc123")).toBe("/app/albums/abc123/studio?remixed=1");
    expect(new URL(remixArrivalHref("abc"), "http://x").searchParams.get(REMIX_ARRIVAL_PARAM)).toBe("1");
  });

  it("keeps an odd id inside its path segment", () => {
    expect(remixArrivalHref("a/b")).toBe("/app/albums/a%2Fb/studio?remixed=1");
  });
});
