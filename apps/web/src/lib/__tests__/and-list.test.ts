import { describe, expect, it } from "vitest";

import { andList } from "@/lib/and-list";

describe("andList", () => {
  const intl = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
  const cases: string[][] = [[], ["tide"], ["tide", "signal"], ["tide", "signal", "static"], ["01", "02", "03", "04", "05"], ["", "a"]];

  it.each(cases.map((items) => [items]))("matches Intl.ListFormat for %j", (items) => {
    expect(andList(items)).toBe(intl.format(items));
  });

  it("uses the serial comma", () => {
    expect(andList(["memory", "signal", "home"])).toBe("memory, signal, and home");
  });
});
