import { describe, expect, it } from "vitest";

import { menuLeftOffset } from "@/components/studio/menu-position";

describe("menuLeftOffset", () => {
  it("hangs the menu from the trigger's right edge when it fits", () => {
    // Trigger ends at 1000 in a 1440 viewport; wrapper starts at 900.
    expect(menuLeftOffset({ triggerRight: 1000, wrapperLeft: 900, menuWidth: 240, viewportWidth: 1440 })).toBe(-140);
  });

  it("keeps 8px from the right edge on a phone (the 390px overflow)", () => {
    // Wrapper at 169, trigger 169–260: hanging leftward fits, and the menu ends at the trigger.
    const left = menuLeftOffset({ triggerRight: 260, wrapperLeft: 169, menuWidth: 240, viewportWidth: 390 });
    expect(169 + left).toBeGreaterThanOrEqual(8);
    expect(169 + left + 240).toBeLessThanOrEqual(390 - 8);
  });

  it("keeps 8px from the left edge when the trigger sits near it", () => {
    const left = menuLeftOffset({ triggerRight: 90, wrapperLeft: 16, menuWidth: 240, viewportWidth: 390 });
    expect(16 + left).toBe(8);
  });

  it("stays inside [8, viewport − 8 − width] across a 320px screen", () => {
    for (let triggerRight = 40; triggerRight <= 320; triggerRight += 20) {
      const wrapperLeft = triggerRight - 80;
      const left = wrapperLeft + menuLeftOffset({ triggerRight, wrapperLeft, menuWidth: 224, viewportWidth: 320 });
      expect(left).toBeGreaterThanOrEqual(8);
      expect(left + 224).toBeLessThanOrEqual(312);
    }
  });

  it("starts at the left gap when the menu is wider than the room", () => {
    expect(menuLeftOffset({ triggerRight: 300, wrapperLeft: 200, menuWidth: 400, viewportWidth: 320 })).toBe(-192);
  });
});
