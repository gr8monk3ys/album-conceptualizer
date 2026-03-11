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

async function createAlbumFromWizard(
  page: import("@playwright/test").Page,
  input: { title: string; artist: string; concept: string },
) {
  await page.goto("/app/create");
  await page.getByLabel("Album title").fill(input.title);
  await page.getByLabel("Artist").fill(input.artist);
  await page.getByLabel("Concept summary").fill(input.concept);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.waitForURL("**/app/albums/**");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Album Management", () => {
  test("create album navigates to album detail page", async ({ page }) => {
    await devLogin(page);

    const title = `Create Test ${randomSuffix()}`;
    await createAlbumFromWizard(page, {
      title,
      artist: "Test Band",
      concept: "A late-summer record about memory, heat, and unfinished goodbyes.",
    });

    await expect(page.getByText(title).first()).toBeVisible();
    await expect(page.getByText("Blueprint saved")).toBeVisible();
  });

  test("created album appears in Recent projects on dashboard", async ({ page }) => {
    await devLogin(page);

    const title = `Dashboard Album ${randomSuffix()}`;
    await createAlbumFromWizard(page, {
      title,
      artist: "Dashboard Band",
      concept: "An album about driving at night and trying not to go home yet.",
    });

    await page.goto("/app");
    await expect(page.getByRole("link", { name: title }).first()).toBeVisible();
  });

  test("album detail page links to studio", async ({ page }) => {
    await devLogin(page);

    const title = `Studio Link ${randomSuffix()}`;
    await createAlbumFromWizard(page, {
      title,
      artist: "Linker",
      concept: "A winter-to-spring arc told through one apartment building.",
    });

    await page.getByRole("main").getByRole("link", { name: "Studio", exact: true }).click();
    await page.waitForURL("**/studio");
    await expect(page).toHaveURL(/studio/);
  });

  test("album detail page links to export", async ({ page }) => {
    await devLogin(page);

    const title = `Export Link ${randomSuffix()}`;
    await createAlbumFromWizard(page, {
      title,
      artist: "Exporter",
      concept: "A concept record about leaving a coastal town for the city.",
    });

    await page.getByRole("main").getByRole("link", { name: "Export", exact: true }).click();
    await page.waitForURL("**/export");
    await expect(page).toHaveURL(/export/);
  });

  test("analytics page shows the new project in the workspace funnel", async ({ page }) => {
    await devLogin(page);

    const title = `Analytics ${randomSuffix()}`;
    await createAlbumFromWizard(page, {
      title,
      artist: "Metrics Club",
      concept: "A concept album about trying to measure a relationship after it is over.",
    });

    await page.goto("/app/settings/analytics");
    await expect(page.locator("main").getByText("Workspace funnel").first()).toBeVisible();
    await expect(page.getByText("Last 30 days")).toBeVisible();
    await expect(page.getByText("Album created")).toBeVisible();
    await expect(page.getByRole("link", { name: title })).toBeVisible();
  });
});
