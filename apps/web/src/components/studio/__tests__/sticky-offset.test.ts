import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The Studio's sticky stack (header + save bar) is cleared by ONE mechanism: html's
// scroll-padding-top in globals.css, which reads --sticky-offset. A scroll margin on the
// Studio's fields as well doubles the offset (focus landed below a 768px viewport at 200%
// text), so no Studio file may add one.
const root = path.resolve(__dirname, "../..");
const files = [
  path.join(root, "album-studio.tsx"),
  ...readdirSync(path.join(root, "studio"))
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => path.join(root, "studio", name)),
];

describe("Studio sticky offset", () => {
  it("is never applied as a scroll margin on top of the page's scroll padding", () => {
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, path.basename(file)).not.toMatch(/scroll-mt-|scroll-margin|scrollMarginTop/);
    }
  });

  it("is still published as --sticky-offset while the Studio is mounted", () => {
    const source = readFileSync(path.join(root, "album-studio.tsx"), "utf8");
    expect(source).toContain('setProperty("--sticky-offset"');
    expect(source).toContain('removeProperty("--sticky-offset")');
  });
});
