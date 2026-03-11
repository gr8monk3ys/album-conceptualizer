import { expect, test } from "@playwright/test";

test.describe("Production smoke", () => {
  test("sign-in page renders marketing shell", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page).toHaveTitle(/Sign In/i);
    await expect(page.getByText("Album Conceptualizer")).toBeVisible();
  });

  test("unauthenticated app route redirects to sign-in", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("core unauthenticated APIs respond", async ({ request }) => {
    const health = await request.get("/api/health");
    expect(health.ok()).toBeTruthy();
    const healthJson = (await health.json()) as {
      ok?: boolean;
      checks?: { config?: boolean; db?: boolean; engine?: boolean };
    };
    expect(healthJson.ok).toBeTruthy();
    expect(healthJson.checks?.config).toBeTruthy();
    expect(healthJson.checks?.db).toBeTruthy();

    const providers = await request.get("/api/auth/providers");
    expect(providers.ok()).toBeTruthy();
    const providersJson = (await providers.json()) as Record<string, unknown>;
    expect(Object.keys(providersJson).length).toBeGreaterThan(0);
  });
});
