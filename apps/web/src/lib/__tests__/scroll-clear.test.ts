import { describe, expect, it } from "vitest";

import { fadeClearScrollLeft } from "@/lib/scroll-clear";

// A 300px region over a 600px table, with a 24px fade.
const base = { viewport: 300, content: 600, margin: 24 };

describe("fadeClearScrollLeft", () => {
  it("leaves an item that is already clear of both fades where it is", () => {
    expect(fadeClearScrollLeft({ ...base, scrollLeft: 100, start: 50, width: 100 })).toBe(100);
  });

  it("scrolls an item under the end fade fully clear of it", () => {
    // The item runs from 250 to 290: under the fade that starts at 276.
    const left = fadeClearScrollLeft({ ...base, scrollLeft: 0, start: 250, width: 40 });
    expect(left).toBe(14);
    expect(250 - (left - 0) + 40).toBeLessThanOrEqual(300 - 24);
  });

  it("scrolls an item under the start fade back clear of it", () => {
    expect(fadeClearScrollLeft({ ...base, scrollLeft: 200, start: 10, width: 40 })).toBe(186);
  });

  it("needs no margin at the very ends of the table, where there is no fade", () => {
    expect(fadeClearScrollLeft({ ...base, scrollLeft: 0, start: 0, width: 40 })).toBe(0);
    expect(fadeClearScrollLeft({ ...base, scrollLeft: 300, start: 260, width: 40 })).toBe(300);
  });

  it("lines up an item too wide to fit at the start margin", () => {
    expect(fadeClearScrollLeft({ ...base, scrollLeft: 0, start: 100, width: 290 })).toBe(76);
  });

  it("keeps a focused cell clear of a sticky first column as well as the fade", () => {
    // Scrolled 300px in; a 150px sticky column covers the start; the item starts 100px in,
    // under it. It scrolls back so the item begins past the column and the fade.
    const left = fadeClearScrollLeft({
      scrollLeft: 300,
      viewport: 400,
      content: 1200,
      start: 100,
      width: 60,
      margin: 24,
      stickyStart: 150,
    });
    expect(left).toBe(300 + 100 - 150 - 24);
  });
});
