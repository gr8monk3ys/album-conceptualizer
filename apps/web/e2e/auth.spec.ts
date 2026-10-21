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

  test("a failed sign-in explains itself and takes focus", async ({ page }) => {
    await page.goto("/sign-in?error=CredentialsSignin");
    const alert = page.getByRole("alert").filter({ hasText: "Those details didn't sign you in." });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Check the email address, then try again.");
    await expect(alert).toBeFocused();
    // The sign-in methods are still offered right below it.
    await expect(page.getByRole("button", { name: "Continue (dev)" })).toBeVisible();
  });

  test("an unknown sign-in error code gets the default message, not the code", async ({
    page,
  }) => {
    await page.goto("/sign-in?error=SomethingOdd");
    await expect(
      page.getByRole("alert").filter({ hasText: "Something went wrong while signing you in." }),
    ).toBeVisible();
    await expect(page.getByText("SomethingOdd")).toHaveCount(0);
  });

  test("a failed sign-in keeps the page the person was going to", async ({ page }) => {
    await page.goto("/sign-in?callbackUrl=%2Fapp%2Flibrary");
    await expect(page.getByText("Dev login")).toBeVisible();
    // An empty email fails the dev login; NextAuth comes back with callbackUrl made absolute.
    await page.getByPlaceholder("email").fill("");
    await page.getByRole("button", { name: "Continue (dev)" }).click();
    await page.waitForURL(/error=CredentialsSignin/);
    const returned = new URL(page.url()).searchParams.get("callbackUrl");
    expect(returned).toMatch(/^https?:\/\/.+\/app\/library$/);
    await expect(
      page.getByRole("alert").filter({ hasText: "Those details didn't sign you in." }),
    ).toBeVisible();

    await page.getByPlaceholder("email").fill(randomEmail("retry"));
    await page.getByPlaceholder("name").fill("Retry User");
    await page.getByRole("button", { name: "Continue (dev)" }).click();
    await page.waitForURL("**/app/library");
    await expect(page.getByRole("heading", { level: 1, name: "Library" })).toBeVisible();
  });

  test("a callbackUrl on another site is not followed", async ({ page }) => {
    await page.goto("/sign-in?callbackUrl=https%3A%2F%2Fevil.example%2Fapp");
    await page.getByPlaceholder("email").fill(randomEmail("elsewhere"));
    await page.getByRole("button", { name: "Continue (dev)" }).click();
    await page.waitForURL("**/app");
    expect(new URL(page.url()).host).not.toBe("evil.example");
  });

  test("dev login authenticates user and redirects to dashboard", async ({ page }) => {
    await devLogin(page, randomEmail("sign-in"), "Sign-In Test User");
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
  });

  test("authenticated user can access /app directly", async ({ page }) => {
    await devLogin(page);
    // Navigate away then back
    await page.goto("/app/discover");
    await page.goto("/app");
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
  });

  test("authenticated user can navigate to settings from the shell", async ({ page }) => {
    await devLogin(page);

    const width = page.viewportSize()?.width ?? 1024;
    if (width < 768) {
      await page.getByRole("button", { name: "Open navigation menu" }).click();
      await page.getByRole("link", { name: "Settings" }).click();
    } else {
      await page.getByRole("link", { name: "Settings" }).first().click();
    }

    await expect(page).toHaveURL(/\/app\/settings$/);
  });

  test("topbar search routes into workspace search", async ({ page }) => {
    await devLogin(page);

    const width = page.viewportSize()?.width ?? 1024;
    if (width < 768) {
      await page.getByRole("link", { name: "Open search" }).click();
    } else {
      await page.getByRole("searchbox", { name: "Search workspace" }).fill("memory");
      await page.keyboard.press("Enter");
    }

    await expect(page).toHaveURL(/\/app\/search/);
  });
});
