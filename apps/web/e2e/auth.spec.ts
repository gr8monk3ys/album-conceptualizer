import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomEmail(prefix = "auth") {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function devLogin(
  page: import("@playwright/test").Page,
  email = randomEmail(),
  name = "E2E User",
) {
  await page.goto("/sign-in");
  await expect(page.getByText("Dev login")).toBeVisible();
  await page.getByPlaceholder("email").fill(email);
  await page.getByPlaceholder("name").fill(name);
  await page.getByRole("button", { name: "Continue (dev)" }).click();
  await page.waitForURL("**/app");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Authentication", () => {
  test("unauthenticated user is redirected to sign-in when accessing /app", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("sign-in page shows dev login form in dev mode", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByText("Dev login")).toBeVisible();
    await expect(page.getByPlaceholder("email")).toBeVisible();
    await expect(page.getByPlaceholder("name")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue (dev)" })).toBeVisible();
  });

  test("dev login authenticates user and redirects to dashboard", async ({ page }) => {
    await devLogin(page, randomEmail("sign-in"), "Sign-In Test User");
    await expect(page.getByText("Recent projects")).toBeVisible();
  });

  test("authenticated user can access /app directly", async ({ page }) => {
    await devLogin(page);
    // Navigate away then back
    await page.goto("/app/discover");
    await page.goto("/app");
    await expect(page.getByText("Recent projects")).toBeVisible();
  });

  test("authenticated user can navigate to settings", async ({ page }) => {
    await devLogin(page);
    await page.goto("/app/settings");
    // Should not redirect to sign-in
    await expect(page).not.toHaveURL(/sign-in/);
  });
});
