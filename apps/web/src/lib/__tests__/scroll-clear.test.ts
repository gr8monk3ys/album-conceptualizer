import { describe, expect, it } from "vitest";

import { edgeFade } from "@/lib/edge-fade";
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

  it("scrolls fully to the end when the item lies within the fade's width of it", () => {
    // The Theme map's last track head: it ends 4px before the table does. Stopping 4px short
    // of the end left the end fade on over it; it scrolls all the way, so the fade goes.
    const table = { viewport: 300, content: 684, margin: 24 };
    const left = fadeClearScrollLeft({ ...table, scrollLeft: 0, start: 636, width: 44 });
    expect(left).toBe(384);
    expect(edgeFade(left, 300, 684)).toBe("start");
  });

  it("scrolls fully to the start when the item lies within the fade's width of it", () => {
    expect(fadeClearScrollLeft({ ...base, scrollLeft: 200, start: -190, width: 40 })).toBe(0);
    // The first column after a sticky one counts as the start.
    expect(
      fadeClearScrollLeft({ ...base, scrollLeft: 120, start: 30, width: 40, stickyStart: 150 }),
    ).toBe(0);
  });

  it("shows a last item whole at the end when no position clears it of every fade", () => {
    // A 256px region, a 160px sticky column, a 48px fade and an 88px last head: aligning it
    // at the start margin would run it off the end, under the end fade.
    const left = fadeClearScrollLeft({
      scrollLeft: 0,
      viewport: 256,
      content: 1120,
      start: 1028,
      width: 88,
      margin: 48,
      stickyStart: 160,
    });
    expect(left).toBe(864);
  });

  it("counts a position within a pixel of the end as the end, as the fade does", () => {
    const table = { viewport: 300, content: 684, margin: 24 };
    expect(fadeClearScrollLeft({ ...table, scrollLeft: 383, start: 253, width: 44 })).toBe(383);
    expect(edgeFade(383, 300, 684)).toBe("start");
  });

  it("never leaves a focused item that fits under the fade it shows", () => {
    const viewport = 300;
    const content = 700;
    const margin = 24;
    for (const scrollLeft of [0, 1, 37, 200, 396, 399, 400]) {
      for (let itemStart = 0; itemStart + 40 <= content; itemStart += 7) {
        for (const width of [40, 120]) {
          if (itemStart + width > content) continue;
          const left = fadeClearScrollLeft({
            scrollLeft,
            viewport,
            content,
            start: itemStart - scrollLeft,
            width,
            margin,
          });
          const fade = edgeFade(left, viewport, content);
          const from = itemStart - left;
          const to = from + width;
          expect(from).toBeGreaterThanOrEqual(fade === "start" || fade === "both" ? margin - 0.5 : -0.5);
          expect(to).toBeLessThanOrEqual(fade === "end" || fade === "both" ? viewport - margin + 0.5 : viewport + 0.5);
        }
      }
    }
  });
});
