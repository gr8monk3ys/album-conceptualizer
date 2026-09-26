import { describe, expect, it } from "vitest";

import { sharedLever } from "@/lib/shared-lever";

const lyrics = "Write lyrics on 6 more tracks (3 and 5–9) to lift this.";

describe("sharedLever", () => {
  it("says a lever shared by several dimensions once, naming them", () => {
    const shared = sharedLever([
      { key: "arc", label: "Arc", lever: lyrics },
      { key: "themes", label: "Themes", lever: lyrics },
      { key: "harmony", label: "Harmony", lever: "Change the starter loop on tracks 1–3 to score Harmony." },
      { key: "lyrics", label: "Lyrics", lever: lyrics },
    ]);
    expect(shared?.sentence).toBe("Write lyrics on 6 more tracks (3 and 5–9) to lift Arc, Themes and Lyrics.");
    expect([...(shared?.keys ?? [])]).toEqual(["arc", "themes", "lyrics"]);
  });

  it("says 'every dimension' when all of them share it", () => {
    const shared = sharedLever([
      { key: "arc", label: "Arc", lever: lyrics },
      { key: "themes", label: "Themes", lever: lyrics },
    ]);
    expect(shared?.sentence).toBe("Write lyrics on 6 more tracks (3 and 5–9) to lift every dimension.");
  });

  it("leaves a lever on its row when only one dimension has it", () => {
    expect(
      sharedLever([
        { key: "arc", label: "Arc", lever: lyrics },
        { key: "themes", label: "Themes" },
        { key: "harmony", label: "Harmony", lever: "Write chords on track 2 to score Harmony." },
      ]),
    ).toBeNull();
  });
});
