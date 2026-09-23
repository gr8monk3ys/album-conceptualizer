import { describe, expect, it } from "vitest";

import { effectivePlan, planMonthlyCredits } from "@/server/plan";

describe("effectivePlan", () => {
  it.each([
    [{ plan: "pro", status: "active" }, "pro"],
    [{ plan: "team", status: "trialing" }, "team"],
    [{ plan: "pro", status: "past_due" }, "pro"],
    [{ plan: "pro", status: "canceled" }, "free"],
    [{ plan: "team", status: "inactive" }, "free"],
    [{ plan: "enterprise", status: "active" }, "free"],
    [{ plan: "free", status: "active" }, "free"],
    [null, "free"],
  ])("%j → %s", (subscription, expected) => {
    expect(effectivePlan(subscription)).toBe(expected);
  });

  it("grants more credits to higher plans", () => {
    expect(planMonthlyCredits("free")).toBeLessThan(planMonthlyCredits("pro"));
    expect(planMonthlyCredits("pro")).toBeLessThan(planMonthlyCredits("team"));
  });
});
