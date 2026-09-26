import { describe, expect, it } from "vitest";

import { atScrollEnd, atScrollStart, edgeFade, edgeFadeClass } from "@/lib/edge-fade";

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

  it("counts a pixel from either end as that end", () => {
    expect(edgeFade(1, 300, 400)).toBe("end");
    expect(edgeFade(99, 300, 400)).toBe("start");
    expect(edgeFade(98, 300, 400)).toBe("both");
    expect(atScrollStart(1)).toBe(true);
    expect(atScrollEnd(99, 300, 400)).toBe(true);
    expect(atScrollEnd(98, 300, 400)).toBe(false);
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
    // Along x the start fade begins after a sticky first column (0 when there is none).
    expect(edgeFadeClass("start", "x")).toContain("var(--sticky-start,0px)");
    expect(edgeFadeClass("both", "x")).toContain("var(--sticky-start,0px)");
    expect(edgeFadeClass("end", "x")).not.toContain("sticky");
    // The fade is a transparency mask, never a colour laid over the content.
    for (const fade of ["start", "end", "both"] as const) {
      expect(edgeFadeClass(fade, "x")).toMatch(/^\[mask-image:linear-gradient\(/);
      expect(edgeFadeClass(fade, "y")).toMatch(/^\[mask-image:linear-gradient\(/);
    }
  });
});
