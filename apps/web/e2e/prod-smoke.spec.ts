import { expect, test } from "@playwright/test";

test.describe("Production smoke", () => {
  test("sign-in page renders marketing shell", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page).toHaveTitle(/Sign In/i);
    await expect(page.getByText("Album Conceptualizer")).toBeVisible();
    await expect(page.getByRole("link", { name: "Terms" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Privacy Policy" })).toBeVisible();
  });

  test("unauthenticated app route redirects to sign-in", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("public trust pages render", async ({ page }) => {
    await page.goto("/terms");
    await expect(page).toHaveTitle(/Terms of Service/i);
    await expect(page.getByRole("heading", { name: /Terms for using Album Conceptualizer/i })).toBeVisible();

    await page.goto("/privacy");
    await expect(page).toHaveTitle(/Privacy Policy/i);
    await expect(page.getByRole("heading", { name: /How Album Conceptualizer handles your data/i })).toBeVisible();

    await page.goto("/support");
    await expect(page).toHaveTitle(/Support/i);
    await expect(page.getByRole("heading", { name: /Get help with access, billing, and exports/i })).toBeVisible();
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
