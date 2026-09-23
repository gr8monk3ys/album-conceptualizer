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
  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();

  await page.goto("/app/create");
  await page.getByLabel("Album title").fill(albumTitle);
  await page.getByLabel("Artist").fill("Playwright");
  await page
    .getByLabel("Concept summary")
    .fill("A concept record about missed calls, false starts, and trying again.");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Saving spends credits, so it asks once: the trigger, then the confirm.

  await page.getByRole("button", { name: "Save and continue" }).click();

  await page.getByRole("button", { name: "Save and continue", exact: true }).click();
  await page.waitForURL("**/app/albums/**");

  await page.getByRole("navigation", { name: "Album" }).getByRole("link", { name: "Studio", exact: true }).click();
  await page.waitForURL("**/studio");

  await page.getByLabel("Lyrics draft").fill("This is an E2E lyrics draft.\nSecond line.");
  await page.getByRole("button", { name: "Save now", exact: true }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.getByRole("navigation", { name: "Album" }).getByRole("link", { name: "Export", exact: true }).click();
  await page.waitForURL("**/export");

  // The zip spends credits, so it asks once: open the confirm, then download.
  await page.getByRole("button", { name: "Download zip · 2 credits" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download zip", exact: true }).click(),
  ]);

  const filename = download.suggestedFilename();
  expect(filename).toMatch(/_export\.zip$/);
  const path = await download.path();
  expect(path).not.toBeNull();

  // Publish and verify Discover.
  await page.goto("/app");
  await page.getByRole("link", { name: albumTitle }).first().click();
  await page.getByRole("button", { name: "Publish" }).click();
  // The album isn't finished, so Publish asks once before it goes out.
  await page.getByRole("button", { name: "Publish anyway" }).click();
  await expect(page.getByText("Published to Discover.")).toBeVisible();

  await page.goto("/app/discover");
  await expect(page.getByText("Community albums")).toBeVisible();

  const albumCard = page
    .locator('[data-testid="discover-album-card"]', { hasText: albumTitle })
    .first();
  // Like controls are named after their album, so each row's toggle is distinct.
  await albumCard.getByRole("button", { name: `Like ${albumTitle}`, exact: true }).click();
  await expect(albumCard.getByRole("button", { name: `Liked ${albumTitle}`, exact: true })).toBeVisible();

  // Your own published album opens in the Studio from Discover: no remix, no credits spent.
  await expect(albumCard.getByRole("button", { name: /Remix/ })).toHaveCount(0);
  await albumCard.getByRole("link", { name: /Open in Studio/ }).click();
  await page.waitForURL("**/app/albums/**/studio");
});
