import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

async function devLogin(page: import("@playwright/test").Page) {
  await page.goto("/sign-in");
  await expect(page.getByText("Dev login")).toBeVisible();
  await page.getByPlaceholder("email").fill(`mgmt-${randomSuffix()}@example.com`);
  await page.getByPlaceholder("name").fill("Album Mgmt User");
  await page.getByRole("button", { name: "Continue (dev)" }).click();
  await page.waitForURL("**/app");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Album Management", () => {
  test("create album navigates to album detail page", async ({ page }) => {
    await devLogin(page);

    const title = `Create Test ${randomSuffix()}`;
    await page.goto("/app/create");
    await page.getByLabel("Album title").fill(title);
    await page.getByLabel("Artist").fill("Test Band");
    await page.getByRole("button", { name: "Generate album.json" }).click();
    await page.getByRole("button", { name: "Save" }).click();

    await page.waitForURL("**/app/albums/**");
    await expect(page.getByText(title).first()).toBeVisible();
  });

  test("created album appears in Recent projects on dashboard", async ({ page }) => {
    await devLogin(page);

    const title = `Dashboard Album ${randomSuffix()}`;
    await page.goto("/app/create");
    await page.getByLabel("Album title").fill(title);
    await page.getByLabel("Artist").fill("Dashboard Band");
    await page.getByRole("button", { name: "Generate album.json" }).click();
    await page.getByRole("button", { name: "Save" }).click();

    await page.waitForURL("**/app/albums/**");
    await page.goto("/app");
    await expect(page.getByRole("link", { name: title }).first()).toBeVisible();
  });

  test("album detail page links to studio", async ({ page }) => {
    await devLogin(page);

    const title = `Studio Link ${randomSuffix()}`;
    await page.goto("/app/create");
    await page.getByLabel("Album title").fill(title);
    await page.getByLabel("Artist").fill("Linker");
    await page.getByRole("button", { name: "Generate album.json" }).click();
    await page.getByRole("button", { name: "Save" }).click();

    await page.waitForURL("**/app/albums/**");
    await page.getByRole("main").getByRole("link", { name: "Studio" }).click();
    await page.waitForURL("**/studio");
    await expect(page).toHaveURL(/studio/);
  });

  test("album detail page links to export", async ({ page }) => {
    await devLogin(page);

    const title = `Export Link ${randomSuffix()}`;
    await page.goto("/app/create");
    await page.getByLabel("Album title").fill(title);
    await page.getByLabel("Artist").fill("Exporter");
    await page.getByRole("button", { name: "Generate album.json" }).click();
    await page.getByRole("button", { name: "Save" }).click();

    await page.waitForURL("**/app/albums/**");
    await page.getByRole("main").getByRole("link", { name: "Export" }).click();
    await page.waitForURL("**/export");
    await expect(page).toHaveURL(/export/);
  });
});
