import { describe, expect, it } from "vitest";

import { REFERENCE_BPM_RULE } from "@/lib/reference-bpm";
import { ApiError } from "@/server/api-error";
import { parseReferenceBody } from "@/server/references";

function rejection(value: unknown): ApiError {
  try {
    parseReferenceBody(value);
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("expected a 400");
}

describe("parseReferenceBody", () => {
  it("returns a valid body", () => {
    expect(parseReferenceBody({ title: " Pink Moon ", bpm: 118 })).toMatchObject({
      title: "Pink Moon",
      bpm: 118,
    });
  });

  it("names BPM and its range instead of a bare 'Invalid payload.'", () => {
    for (const bpm of [400, 10, 118.5, "fast"]) {
      const error = rejection({ title: "Pink Moon", bpm });
      expect(error.status).toBe(400);
      expect(error.message).toBe(REFERENCE_BPM_RULE);
      expect(error.details).toEqual([REFERENCE_BPM_RULE]);
    }
  });

  it("lists every broken field once, in order", () => {
    const error = rejection({ title: "", bpm: 12, moodTags: ["a".repeat(41), "b".repeat(41)] });
    expect(error.message).toBe("Reference title is required, up to 200 characters.");
    expect(error.details).toEqual([
      "Reference title is required, up to 200 characters.",
      REFERENCE_BPM_RULE,
      "Mood tags: up to 12, each up to 40 characters.",
    ]);
  });

  it("says plainly when the body isn't a reference at all", () => {
    const error = rejection(null);
    expect(error.status).toBe(400);
    expect(error.message).toBe("The reference couldn't be read. Reload the page and try again.");
  });
});
