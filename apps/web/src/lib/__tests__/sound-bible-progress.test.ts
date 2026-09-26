import { describe, expect, it } from "vitest";

import { soundBibleFieldsSet } from "@/lib/sound-bible-progress";

describe("soundBibleFieldsSet", () => {
  it("says how many Sound bible fields are set, in one wording", () => {
    expect(soundBibleFieldsSet(0, 9)).toBe("0 of 9 fields set");
    expect(soundBibleFieldsSet(3, 9)).toBe("3 of 9 fields set");
    expect(soundBibleFieldsSet(9, 9)).toBe("9 of 9 fields set");
  });
});
