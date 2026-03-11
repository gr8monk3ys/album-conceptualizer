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
  await page.getByPlaceholder("email").fill(`studio-${randomSuffix()}@example.com`);
  await page.getByPlaceholder("name").fill("Studio User");
  await page.getByRole("button", { name: "Continue (dev)" }).click();
  await page.waitForURL("**/app");
}

async function createAlbumAndOpenStudio(page: import("@playwright/test").Page, title: string) {
  await page.goto("/app/create");
  await page.getByLabel("Album title").fill(title);
  await page.getByLabel("Artist").fill("Studio Artist");
  await page
    .getByLabel("Concept summary")
    .fill("A concept album about radio transmissions drifting across a desert at night.");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.waitForURL("**/app/albums/**");
  await page.getByRole("main").getByRole("link", { name: "Studio", exact: true }).click();
  await page.waitForURL("**/studio");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Studio", () => {
  test("studio page loads after navigating from album detail", async ({ page }) => {
    await devLogin(page);
    const title = `Studio Load ${randomSuffix()}`;
    await createAlbumAndOpenStudio(page, title);
    await expect(page).toHaveURL(/studio/);
  });

  test("save lyrics in studio shows saved confirmation", async ({ page }) => {
    await devLogin(page);
    const title = `Lyrics Save ${randomSuffix()}`;
    await createAlbumAndOpenStudio(page, title);

    await page.getByLabel("Lyrics draft").fill("These lyrics were written by the E2E test.\nSecond line here.");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
  });

  test("studio export button triggers zip download", async ({ page }) => {
    await devLogin(page);
    const title = `Export Download ${randomSuffix()}`;
    await createAlbumAndOpenStudio(page, title);

    // Navigate to export tab
    await page.getByRole("main").getByRole("link", { name: "Export", exact: true }).click();
    await page.waitForURL("**/export");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download zip" }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/_export\.zip$/);
    expect(await download.path()).not.toBeNull();
  });
});
