import { describe, expect, it } from "vitest";

import { readCreditMeter } from "@/lib/credit-meter";

describe("readCreditMeter", () => {
  it("reads a balance inside the monthly grant as a fraction", () => {
    const reading = readCreditMeter({ remaining: 45, total: 50 });
    expect(reading.caption).toBe("/ 50");
    expect(reading.extra).toBe(0);
    expect(reading.ratio).toBeCloseTo(0.9);
    expect(reading.valueText).toBe("45 of 50 monthly credits left");
  });

  it("never shows a balance past its frame: splits it into monthly plus extra and caps the meter", () => {
    const reading = readCreditMeter({ remaining: 53, total: 50 });
    expect(reading.caption).toBe("50 monthly + 3 extra");
    expect(reading.caption).not.toContain("/");
    expect(reading.extra).toBe(3);
    expect(reading.ratio).toBe(1);
    expect(reading.valueText).toBe("53 credits left: 50 monthly plus 3 extra");
  });

  it("reads exactly the grant as full, with no extra", () => {
    const reading = readCreditMeter({ remaining: 50, total: 50 });
    expect(reading.caption).toBe("/ 50");
    expect(reading.ratio).toBe(1);
  });

  it("handles a plan with no monthly grant", () => {
    expect(readCreditMeter({ remaining: 0, total: 0 })).toMatchObject({ ratio: 0, caption: "/ 0" });
    expect(readCreditMeter({ remaining: 3, total: 0 })).toMatchObject({ ratio: 1, caption: "3 extra" });
    expect(readCreditMeter(undefined)).toMatchObject({ remaining: 0, total: 0, ratio: 0 });
  });
});
