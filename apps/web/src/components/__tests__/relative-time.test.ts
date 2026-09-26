import { describe, expect, it } from "vitest";

import { englishRelative } from "@/components/relative-time";

// The English fast path has to say exactly what Intl would, in every English locale, for the
// values formatRelative produces (a whole count of at least one unit).
const UNITS: Intl.RelativeTimeFormatUnit[] = ["year", "month", "week", "day", "hour", "minute"];
const LOCALES = ["en", "en-US", "en-GB", "en-AU", "en-CA", "en-IN", "en-NZ", "en-IE", "en-ZA", "en-SG", "en-001"];

describe("englishRelative", () => {
  it.each(LOCALES)("matches Intl.RelativeTimeFormat for %s", (locale) => {
    const intl = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    for (const unit of UNITS) {
      for (let value = -120; value <= 120; value += 1) {
        if (value === 0) continue;
        expect(englishRelative(value, unit)).toBe(intl.format(value, unit));
      }
    }
  });

  it("leaves what it doesn't cover to Intl", () => {
    expect(englishRelative(0, "day")).toBeNull();
    expect(englishRelative(1.5, "day")).toBeNull();
    expect(englishRelative(-1000, "year")).toBeNull();
  });
});
