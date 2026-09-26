import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChordField } from "@/components/studio/musical-fields";
import { lyricFraction } from "@/components/studio/track-list";

describe("lyricFraction", () => {
  it("is always plain tabular figures, never a fraction glyph", () => {
    expect(lyricFraction({ written: 1, total: 2 })).toBe("1/2");
    expect(lyricFraction({ written: 0, total: 2 })).toBe("0/2");
    expect(lyricFraction({ written: 3, total: 4 })).toBe("3/4");
    expect(lyricFraction({ written: 2, total: 2 })).toBe("2/2");
  });

  it("is a dash for a track with no sections", () => {
    expect(lyricFraction({ written: 0, total: 0 })).toBe("—");
  });
});

describe("ChordField starter-loop hint", () => {
  const render = (starterLoop: boolean) =>
    renderToStaticMarkup(
      h(ChordField, { id: "section-chords", value: ["C", "G", "Am", "F"], onChange: () => {}, starterLoop }),
    );

  it("explains the rule at the field, tied to it as its hint", () => {
    const html = render(true);
    expect(html).toContain("Still the starter loop — change a chord to make it this track’s own.");
    expect(html).toContain('aria-describedby="section-chords-hint"');
    expect(html).toContain("text-warn");
  });

  it("says nothing about it once the chords are the track's own", () => {
    expect(render(false)).not.toContain("starter loop");
  });
});
