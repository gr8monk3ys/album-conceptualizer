import { test, expect } from "./fixtures";

// ---------------------------------------------------------------------------
// Navigation tests — verify the authenticated app shell and sidebar links.
// ---------------------------------------------------------------------------

test.describe("Navigation: authenticated app shell", () => {
  test("app layout renders sidebar and topbar after login", async ({
    authenticatedPage: page,
  }) => {
    // After dev-login the fixture lands us on /app.
    // The sidebar (desktop) should show the branding and key nav items.
    await expect(page.getByText("Album Conceptualizer").first()).toBeVisible();
    await expect(page.getByText("workspace:")).toBeVisible();

    // Topbar shows the workspace name and "Create" CTA.
    await expect(page.getByText("Workspaces")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Create" }).first(),
    ).toBeVisible();

    // Dashboard content.
    await expect(page.getByText("Recent projects")).toBeVisible();
  });

  test("sidebar links navigate to main sections", async ({
    authenticatedPage: page,
  }) => {
    // Navigate to Discover.
    await page.getByRole("link", { name: "Discover" }).click();
    await page.waitForURL("**/app/discover");
    await expect(page.getByText("Community projects")).toBeVisible();

    // Navigate to Library.
    await page.getByRole("link", { name: "Library" }).click();
    await page.waitForURL("**/app/library");
    await expect(page.getByText("All projects")).toBeVisible();

    // Navigate to Create.
    // There may be multiple "Create" links (sidebar + topbar), use sidebar.
    await page
      .locator("aside")
      .getByRole("link", { name: "Create" })
      .click();
    await page.waitForURL("**/app/create");
    await expect(page.getByText("Generate album.json")).toBeVisible();

    // Navigate back to Home via sidebar.
    await page.getByRole("link", { name: "Home" }).click();
    await page.waitForURL("**/app");
    await expect(page.getByText("Recent projects")).toBeVisible();
  });

  test("Settings page is accessible from sidebar", async ({
    authenticatedPage: page,
  }) => {
    await page.getByRole("link", { name: "Settings" }).click();
    await page.waitForURL("**/app/settings");
  });
});
