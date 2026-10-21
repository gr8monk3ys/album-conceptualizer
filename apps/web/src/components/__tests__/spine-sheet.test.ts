import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SpineSheet } from "@/components/album-spine";
import type { SpineRow } from "@/server/album-songs";

function row(trackNumber: number, themeKeys: string[]): SpineRow {
  return {
    trackNumber,
    title: `Track ${trackNumber}`,
    sections: 2,
    lyricSections: 1,
    themes: themeKeys.length,
    themeKeys,
    hasNarrative: false,
    writtenHarmony: false,
    narrativePosition: null,
  };
}

const render = (themes: string[]) =>
  renderToStaticMarkup(
    createElement(SpineSheet, {
      rows: [row(1, ["isolation"]), row(2, ["memory", "tide"])],
      themes,
      rowHref: () => null,
      caption: "Tracks in sequence",
      legendId: "spine-test-keys",
    }),
  );

describe("SpineSheet theme heads", () => {
  it("gives long names a wide layout of their own, scoped to this sheet", () => {
    const html = render(["isolation", "signal", "tide", "memory"]);
    expect(html).toContain('data-theme-heads="spine-test-keys"');
    expect(html).toContain("<style>");
    expect(html).toContain('[data-theme-heads="spine-test-keys"] .theme-slot-0{width:');
    // Every column, head and marks alike, carries its slot class, so the widths line up.
    expect(html.match(/theme-slot-0/g)?.length).toBeGreaterThanOrEqual(3);
    // The 3rem head and each wide one, all hidden from screen readers.
    expect(html).toContain("theme-head-narrow");
    expect(html).toContain("theme-head-w0");
    expect(html).toContain("theme-legend");
  });

  it("writes no rules when every name is already whole in its 3rem slot", () => {
    const html = render(["tide", "salt"]);
    expect(html).not.toContain("<style>");
    expect(html).not.toContain("data-theme-heads");
    expect(html).not.toContain("theme-slot-");
  });

  it("still gives a screen reader one phrase a row, and the themes once in the head", () => {
    const html = render(["isolation", "signal", "tide", "memory"]);
    expect(html).toContain("Album themes: isolation, signal, tide, memory");
    expect(html).toContain("Carries isolation</span>");
    expect(html).toContain("Carries tide and memory</span>");
  });

  it("lets only the title column stretch: the others are as narrow as their heads", () => {
    const html = render(["isolation", "memory"]);
    const heads = html.match(/<th scope="col" class="[^"]*"/g) ?? [];
    expect(heads).toHaveLength(5);
    expect(heads[1]).not.toContain("w-px");
    for (const index of [2, 3, 4]) expect(heads[index]).toContain("w-px");
  });
});
