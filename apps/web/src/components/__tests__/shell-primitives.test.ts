import fs from "node:fs";
import path from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { lyricFraction } from "@/components/album-spine";
import { ConfirmSpend } from "@/components/confirm-spend";
import { PAGE_NOT_FOUND_TITLE, PageNotFoundTitle } from "@/components/page-not-found-title";
import { TableScroller } from "@/components/ui";

const read = (file: string) => fs.readFileSync(path.join(__dirname, "..", "..", file), "utf8");

describe("ConfirmSpend trigger", () => {
  const trigger = (props: Partial<Parameters<typeof ConfirmSpend>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(
        ConfirmSpend,
        // children arrive as createElement's third argument, so the props object omits them.
        { cost: 5, remaining: 40, actionLabel: "Remix", onConfirm: () => {}, ...props } as Parameters<
          typeof ConfirmSpend
        >[0],
        "Remix · 5 credits",
      ),
    );

  it("discloses a group, not a menu", () => {
    const html = trigger();
    expect(html).not.toContain("aria-haspopup");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toMatch(/aria-controls="[^"]+"/);
  });

  it("stays focusable while a spend runs: busy, never disabled", () => {
    const html = trigger({ busy: true });
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toMatch(/\sdisabled=""/);
  });

  it("is disabled only for a reason the page shows", () => {
    expect(trigger({ disabled: true })).toMatch(/\sdisabled=""/);
  });
});

describe("lyricFraction", () => {
  it("is a tabular fraction, never a vulgar-fraction glyph", () => {
    expect(lyricFraction(1, 2).visible).toBe("1/2");
    expect(lyricFraction(0, 2).visible).toBe("0/2");
    expect(lyricFraction(3, 4).visible).toBe("3/4");
    expect(lyricFraction(0, 0).visible).toBe("—");
    expect(lyricFraction(1, 2).spoken).toBe("Lyrics: 1 of 2 sections written");
  });
});

describe("TableScroller", () => {
  it("renders the same labelled region on the server, with no fade until it has measured", () => {
    const html = renderToStaticMarkup(createElement(TableScroller, { label: "Tracks" }, "table"));
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Tracks"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("relative");
    expect(html).not.toContain("data-edge-fade");
  });
});

describe("not-found title", () => {
  it("is the one the root template writes", () => {
    expect(PAGE_NOT_FOUND_TITLE).toBe("Page not found · Album Conceptualizer");
    expect(renderToStaticMarkup(createElement(PageNotFoundTitle))).toBe(`<title>${PAGE_NOT_FOUND_TITLE}</title>`);
  });

  it("is also the metadata of every address that only calls notFound()", () => {
    for (const file of ["app/app/[...missing]/page.tsx", "app/app/albums/[albumId]/[...missing]/page.tsx"]) {
      expect(read(file)).toMatch(/export const metadata[^=]*=\s*\{\s*title:\s*"Page not found"\s*\}/);
    }
  });
});

describe("sticky app header", () => {
  it("sticks only on screens taller than 31.3125em (501px at default text), and only then counts in the scroll padding", () => {
    const layout = read("app/app/layout.tsx");
    // In em, so enlarged text needs a taller window before the header sticks.
    expect(layout).toContain("[@media(min-height:31.3125em)]:sticky");
    expect(layout).not.toMatch(/min-height:\d+px/);
    expect(layout).not.toMatch(/className="sticky top-0/);
    const css = read("app/globals.css");
    expect(css).toMatch(/--header-offset:\s*0px/);
    expect(css).toMatch(/@media \(min-height: 31\.3125em\)\s*\{\s*:root\s*\{\s*--header-offset:\s*var\(--header-h\)/);
    expect(css).toContain("scroll-padding-top: calc(var(--sticky-offset, var(--header-offset)) + 1rem)");
  });
});
