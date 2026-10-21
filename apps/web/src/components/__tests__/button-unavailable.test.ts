import { describe, expect, it } from "vitest";

import { buttonClass } from "@/components/ui";

describe("buttonClass, unavailable", () => {
  it("gives an unavailable primary the Raised surface and Ash Ink at full opacity, not faded saffron", () => {
    const primary = buttonClass("primary").split(" ");
    for (const state of ["disabled", "aria-disabled"]) {
      expect(primary).toContain(`${state}:bg-raised`);
      expect(primary).toContain(`${state}:text-ink-3`);
      expect(primary).toContain(`${state}:border-line-strong`);
      expect(primary).toContain(`${state}:opacity-100`);
      expect(primary).not.toContain(`${state}:opacity-50`);
      // Hovering an unavailable primary doesn't light it up.
      expect(primary).toContain(`${state}:hover:bg-raised`);
    }
  });

  it("keeps the other tones at 50%", () => {
    for (const tone of ["secondary", "ghost", "danger"] as const) {
      const classes = buttonClass(tone).split(" ");
      expect(classes).toContain("disabled:opacity-50");
      expect(classes).toContain("aria-disabled:opacity-50");
      expect(classes).not.toContain("disabled:bg-raised");
    }
  });

  it("draws unavailable buttons in GrayText in forced colors, aria-disabled ones too", () => {
    for (const tone of ["primary", "secondary", "ghost", "danger"] as const) {
      const classes = buttonClass(tone).split(" ");
      for (const state of ["disabled", "aria-disabled"]) {
        expect(classes).toContain(`${state}:forced-colors:text-[GrayText]`);
        expect(classes).toContain(`${state}:forced-colors:border-[GrayText]`);
      }
    }
  });
});
