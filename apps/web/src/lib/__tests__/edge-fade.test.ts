import { describe, expect, it } from "vitest";

import { edgeFade, edgeFadeClass } from "@/lib/edge-fade";

describe("edgeFade", () => {
  it("shows no fade when the content fits", () => {
    expect(edgeFade(0, 300, 300)).toBe("none");
    // A pixel of sub-pixel rounding is not overflow.
    expect(edgeFade(0, 300, 301)).toBe("none");
  });

  it("fades the end while scrolled to the start", () => {
    expect(edgeFade(0, 300, 400)).toBe("end");
  });

  it("fades the start once scrolled to the end", () => {
    expect(edgeFade(100, 300, 400)).toBe("start");
    expect(edgeFade(99.5, 300, 400)).toBe("start");
  });

  it("fades both edges in between", () => {
    expect(edgeFade(40, 300, 400)).toBe("both");
  });
});

describe("edgeFadeClass", () => {
  it("is empty without a fade, and a mask along the axis with one", () => {
    expect(edgeFadeClass("none")).toBe("");
    expect(edgeFadeClass("end", "x")).toContain("to_right");
    expect(edgeFadeClass("end", "y")).toContain("to_bottom");
    // The fade is a transparency mask, never a colour laid over the content.
    for (const fade of ["start", "end", "both"] as const) {
      expect(edgeFadeClass(fade, "x")).toMatch(/^\[mask-image:linear-gradient\(/);
      expect(edgeFadeClass(fade, "y")).toMatch(/^\[mask-image:linear-gradient\(/);
    }
  });
});
