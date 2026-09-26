import { describe, expect, it } from "vitest";

import { chipAddedMessage } from "@/components/studio/chip-list-editor";

describe("chipAddedMessage", () => {
  it("names the one chip added", () => {
    expect(chipAddedMessage("theme", ["tide"])).toBe("Added theme “tide”.");
    expect(chipAddedMessage("central theme", ["salt"])).toBe("Added central theme “salt”.");
  });

  it("counts a comma batch", () => {
    expect(chipAddedMessage("theme", ["tide", "salt"])).toBe("Added 2 themes.");
    expect(chipAddedMessage("album motif", ["a", "b", "c"])).toBe("Added 3 album motifs.");
  });

  it("says nothing when nothing was added (a duplicate, or a full list)", () => {
    expect(chipAddedMessage("theme", [])).toBeNull();
  });
});
