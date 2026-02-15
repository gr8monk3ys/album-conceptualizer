import { test, expect } from "@playwright/test";

test("e2e: create -> studio -> export -> publish -> discover remix", async ({ page }) => {
  const albumTitle = `Playwright CI Album ${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e-${Math.random().toString(36).slice(2, 8)}@example.com`;

  await page.goto("/sign-in");

  // Dev login (enabled in CI via ENABLE_DEV_LOGIN + NEXT_PUBLIC_ENABLE_DEV_LOGIN).
  await expect(page.getByText("Dev login")).toBeVisible();
  await page.getByPlaceholder("email").fill(email);
  await page.getByPlaceholder("name").fill("E2E User");
  await page.getByRole("button", { name: "Continue (dev)" }).click();

  await page.waitForURL("**/app");
  await expect(page.getByText("Recent projects")).toBeVisible();

  await page.goto("/app/create");
  await page.getByLabel("Album title").fill(albumTitle);
  await page.getByLabel("Artist").fill("Playwright");
  await page.getByRole("button", { name: "Generate album.json" }).click();

  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL("**/app/albums/**");

  await page.getByRole("main").getByRole("link", { name: "Studio" }).click();
  await page.waitForURL("**/studio");

  await page.getByLabel("Lyrics draft").fill("This is an E2E lyrics draft.\nSecond line.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.getByRole("main").getByRole("link", { name: "Export" }).click();
  await page.waitForURL("**/export");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download zip" }).click(),
  ]);

  const filename = download.suggestedFilename();
  expect(filename).toMatch(/_export\.zip$/);
  const path = await download.path();
  expect(path).not.toBeNull();

  // Publish and verify Discover.
  await page.goto("/app");
  await page.getByRole("link", { name: albumTitle }).first().click();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published to Discover.")).toBeVisible();

  await page.goto("/app/discover");
  await expect(page.getByText("Community projects")).toBeVisible();

  const albumCard = page
    .locator('[data-testid="discover-album-card"]', { hasText: albumTitle })
    .first();
  await albumCard.getByRole("button", { name: "Like", exact: true }).click();
  await expect(albumCard.getByRole("button", { name: "Liked", exact: true })).toBeVisible();

  await albumCard.getByRole("button", { name: "Remix" }).click();
  await page.waitForURL("**/app/albums/**/studio");
});
