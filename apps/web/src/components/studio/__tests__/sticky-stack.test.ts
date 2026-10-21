import { describe, expect, it } from "vitest";

import { frameWithTarget, saveBarSticks, visibleBelowSticky } from "@/components/studio/sticky-stack";

describe("saveBarSticks", () => {
  it("sticks on a laptop at normal text size", () => {
    expect(saveBarSticks({ tallEnough: true, headerHeight: 69, barHeight: 50, viewportHeight: 800 })).toBe(true);
  });

  it("scrolls away once header and bar would cover 35% of the window or more", () => {
    // A 640px phone at 200% text: a 138px header and a 120px bar are 40% of it.
    expect(saveBarSticks({ tallEnough: true, headerHeight: 138, barHeight: 120, viewportHeight: 640 })).toBe(false);
    expect(saveBarSticks({ tallEnough: true, headerHeight: 0, barHeight: 350, viewportHeight: 1000 })).toBe(false);
  });

  it("counts the docked preview player: at 390×844 the three would cover half the window", () => {
    // Header 69px, save bar 141px, player 209px: 50% of 844px.
    expect(saveBarSticks({ tallEnough: true, headerHeight: 69, barHeight: 141, viewportHeight: 844 })).toBe(true);
    expect(
      saveBarSticks({ tallEnough: true, headerHeight: 69, barHeight: 141, playerHeight: 209, viewportHeight: 844 }),
    ).toBe(false);
    // A laptop keeps its bar with the player open (69 + 62 + 120 of 900).
    expect(
      saveBarSticks({ tallEnough: true, headerHeight: 69, barHeight: 62, playerHeight: 120, viewportHeight: 900 }),
    ).toBe(true);
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

describe("frameWithTarget", () => {
  // 1440×900: a 69px header and a 62px save bar, so the scroll padding is 131 + 16 = 147px.
  it("brings the track header under the save bar when it and the lyrics fit (1440×900)", () => {
    // Arriving from "Write track 1": the header sits at 180, the lyrics box ends at 920, past
    // the window; header to lyrics is 740px, within the 753px under the save bar.
    expect(frameWithTarget({ top: 180 }, { top: 640, bottom: 920 }, 147, 900)).toBe("frame");
    // Header hidden under the save bar after a centred scroll.
    expect(frameWithTarget({ top: 40 }, { top: 420, bottom: 760 }, 147, 900)).toBe("frame");
  });

  it("stays put when the header and the lyrics are both in view", () => {
    expect(frameWithTarget({ top: 160 }, { top: 480, bottom: 820 }, 147, 900)).toBe("stay");
  });

  it("keeps only the lyrics in view when the two don't fit together", () => {
    // 1024×768 at 200% text: the header alone is most of the room.
    expect(frameWithTarget({ top: 300 }, { top: 1200, bottom: 1600 }, 280, 768)).toBe("target");
    // Long lyrics: the box is taller than the room under the header.
    expect(frameWithTarget({ top: 200 }, { top: 500, bottom: 1400 }, 147, 900)).toBe("target");
  });

  it("falls back to the lyrics without a window height", () => {
    expect(frameWithTarget({ top: 0 }, { top: 10, bottom: 20 }, 0, 0)).toBe("target");
  });
});
