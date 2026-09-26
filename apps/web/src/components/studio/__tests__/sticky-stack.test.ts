import { describe, expect, it } from "vitest";

import { saveBarSticks, visibleBelowSticky } from "@/components/studio/sticky-stack";

describe("saveBarSticks", () => {
  it("sticks on a laptop at normal text size", () => {
    expect(saveBarSticks({ tallEnough: true, headerHeight: 69, barHeight: 50, viewportHeight: 800 })).toBe(true);
  });

  it("scrolls away once header and bar would cover 35% of the window or more", () => {
    // A 640px phone at 200% text: a 138px header and a 120px bar are 40% of it.
    expect(saveBarSticks({ tallEnough: true, headerHeight: 138, barHeight: 120, viewportHeight: 640 })).toBe(false);
    expect(saveBarSticks({ tallEnough: true, headerHeight: 0, barHeight: 350, viewportHeight: 1000 })).toBe(false);
  });

  it("never sticks on a window too short for sticky layers", () => {
    expect(saveBarSticks({ tallEnough: false, headerHeight: 0, barHeight: 40, viewportHeight: 400 })).toBe(false);
    expect(saveBarSticks({ tallEnough: true, headerHeight: 0, barHeight: 40, viewportHeight: 0 })).toBe(false);
  });
});

describe("visibleBelowSticky", () => {
  it("is visible when its top is under the sticky layers and its first line is in the window", () => {
    expect(visibleBelowSticky({ top: 200, bottom: 500 }, 150, 640)).toBe(true);
  });

  it("is hidden under the sticky layers", () => {
    expect(visibleBelowSticky({ top: 100, bottom: 400 }, 150, 640)).toBe(false);
  });

  it("is hidden below the window (the skip link's lyrics at 320×640, 200% text)", () => {
    expect(visibleBelowSticky({ top: 700, bottom: 1100 }, 0, 640)).toBe(false);
    expect(visibleBelowSticky({ top: 620, bottom: 1000 }, 0, 640)).toBe(false);
  });
});
