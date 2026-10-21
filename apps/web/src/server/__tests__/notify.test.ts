import { describe, expect, it } from "vitest";

import { albumActivityTitle } from "@/server/notify";

describe("albumActivityTitle", () => {
  it("names who liked or remixed which album", () => {
    expect(albumActivityTitle("like", "Theo Lind", "Salt Year")).toBe("Theo Lind liked Salt Year");
    expect(albumActivityTitle("remix", " Theo Lind ", "Salt Year")).toBe("Theo Lind remixed Salt Year");
  });

  it("falls back to plain words when a name or title is missing", () => {
    expect(albumActivityTitle("remix", null, "Salt Year")).toBe("Another artist remixed Salt Year");
    expect(albumActivityTitle("like", "  ", " ")).toBe("Another artist liked your album");
  });
});
