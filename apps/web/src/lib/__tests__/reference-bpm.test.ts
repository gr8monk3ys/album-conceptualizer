import { describe, expect, it } from "vitest";

import {
  REFERENCE_BPM_MAX,
  REFERENCE_BPM_MIN,
  REFERENCE_BPM_RULE,
  referenceBpmProblem,
} from "@/lib/reference-bpm";

describe("referenceBpmProblem", () => {
  it("names the range in the rule", () => {
    expect(REFERENCE_BPM_RULE).toBe(`BPM is a whole number from ${REFERENCE_BPM_MIN} to ${REFERENCE_BPM_MAX}.`);
    expect(REFERENCE_BPM_RULE).toBe("BPM is a whole number from 20 to 300.");
  });

  it("accepts an empty field (BPM is optional) and whole numbers in range", () => {
    for (const raw of ["", "  ", "20", "118", " 120 ", "300"]) {
      expect(referenceBpmProblem(raw, { complete: true })).toBeNull();
      expect(referenceBpmProblem(raw, { complete: false })).toBeNull();
    }
  });

  it("flags what more typing can't fix at once", () => {
    for (const raw of ["118.5", "fast", "-90", "1e2", "301", "400"]) {
      expect(referenceBpmProblem(raw, { complete: false })).toBe(REFERENCE_BPM_RULE);
      expect(referenceBpmProblem(raw, { complete: true })).toBe(REFERENCE_BPM_RULE);
    }
  });

  it("waits for a number below the range until the field is done", () => {
    for (const raw of ["0", "1", "11", "19"]) {
      expect(referenceBpmProblem(raw, { complete: false })).toBeNull();
      expect(referenceBpmProblem(raw, { complete: true })).toBe(REFERENCE_BPM_RULE);
    }
  });
});
