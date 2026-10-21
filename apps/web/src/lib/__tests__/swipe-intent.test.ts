import { describe, expect, it } from "vitest";

import { SWIPE_INTENT_PX, rangeValueAt, sliderPointerStart, swipeIntent } from "@/lib/swipe-intent";

describe("swipeIntent", () => {
  it("is undecided until the finger has travelled the threshold", () => {
    expect(swipeIntent(0, 0)).toBe("undecided");
    expect(swipeIntent(SWIPE_INTENT_PX - 1, -(SWIPE_INTENT_PX - 1))).toBe("undecided");
  });

  it("calls a mostly sideways move horizontal", () => {
    expect(swipeIntent(12, 3)).toBe("horizontal");
    expect(swipeIntent(-20, 10)).toBe("horizontal");
  });

  it("calls a mostly vertical move (a scroll) vertical, and a diagonal too", () => {
    expect(swipeIntent(2, 40)).toBe("vertical");
    expect(swipeIntent(3, -9)).toBe("vertical");
    expect(swipeIntent(10, 10)).toBe("vertical");
  });
});

describe("rangeValueAt", () => {
  // A 216px track from x=100, a 16px thumb: the thumb's centre runs 108…308.
  const track = { left: 100, width: 216 };

  it("maps the thumb's travel onto min…max", () => {
    expect(rangeValueAt(108, track, 3, 23)).toBe(3);
    expect(rangeValueAt(308, track, 3, 23)).toBe(23);
    expect(rangeValueAt(208, track, 3, 23)).toBe(13);
  });

  it("clamps outside the track and rounds to whole steps", () => {
    expect(rangeValueAt(0, track, 3, 23)).toBe(3);
    expect(rangeValueAt(900, track, 3, 23)).toBe(23);
    expect(Number.isInteger(rangeValueAt(151, track, 3, 23))).toBe(true);
  });
});

describe("sliderPointerStart", () => {
  it("leaves a pointer the input itself took to the input", () => {
    expect(sliderPointerStart("mouse", true)).toBe("native");
    expect(sliderPointerStart("touch", true)).toBe("native");
  });

  it("waits for a touch to go sideways before it moves the slider", () => {
    expect(sliderPointerStart("touch", false)).toBe("swipe");
  });

  it("drags at once for a mouse or pen where the input takes no pointer events (a touch-first device)", () => {
    // The input ignores pointers when the primary one is coarse; a trackpad or a stylus there
    // reaches only the wrapper, which used to ignore a mouse, so the slider couldn't be used.
    expect(sliderPointerStart("mouse", false)).toBe("drag");
    expect(sliderPointerStart("pen", false)).toBe("drag");
  });
});
