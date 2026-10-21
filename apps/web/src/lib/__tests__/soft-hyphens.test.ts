import { describe, expect, it } from "vitest";

import { SOFT_HYPHEN, softHyphens } from "@/lib/soft-hyphens";

const shown = (text: string) => softHyphens(text).split(SOFT_HYPHEN).join("-");

describe("softHyphens", () => {
  it.each([
    ["Extraordinarily", "Extraor-dina-rily"],
    ["Semaphores", "Sema-phores"],
    ["Congregations", "Congre-gations"],
    ["production", "pro-duc-tion"],
    ["Transmission", "Transmis-sion"],
  ])("breaks %s between syllables", (word, expected) => {
    expect(shown(word)).toBe(expected);
  });

  it("leaves short words, sounded pairs and figures alone", () => {
    expect(softHyphens("Storm Warning")).toBe("Storm Warning");
    expect(softHyphens("Lighthouse")).toBe("Lighthouse");
    expect(softHyphens("Track 12")).toBe("Track 12");
  });

  it("reads the same without its break points, and is applied once", () => {
    const title = "Semaphore for the Drowned Congregation";
    expect(softHyphens(title).split(SOFT_HYPHEN).join("")).toBe(title);
    expect(softHyphens(softHyphens(title))).toBe(softHyphens(title));
  });
});
