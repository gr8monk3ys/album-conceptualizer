import { describe, expect, it } from "vitest";

import { CREDIT_COSTS } from "@/lib/credit-costs";
import { creditUses } from "@/lib/credit-uses";

describe("creditUses", () => {
  it("prices the worked album with two AI drafts when AI can run", () => {
    const { albumPass, uses } = creditUses(true);
    expect(albumPass).toBe(CREDIT_COSTS.albumCreate + 2 * CREDIT_COSTS.agentRun + CREDIT_COSTS.exportZip);
    expect(uses.find((use) => use.key === "ai")?.unavailable).toBe(false);
    expect(uses.find((use) => use.key === "pass")?.detail).toContain("two AI drafts");
  });

  it("doesn't sell AI drafts when AI can't run: the example drops them and the row says so", () => {
    const { albumPass, uses } = creditUses(false);
    expect(albumPass).toBe(CREDIT_COSTS.albumCreate + CREDIT_COSTS.exportZip);
    const ai = uses.find((use) => use.key === "ai");
    expect(ai?.unavailable).toBe(true);
    expect(ai?.detail).toMatch(/not available/i);
    expect(uses.find((use) => use.key === "pass")?.detail).not.toMatch(/AI/);
  });
});
