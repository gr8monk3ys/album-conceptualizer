import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Smoke tests — verify that the most critical pages load without errors.
// These do NOT require authentication.
// ---------------------------------------------------------------------------

test.describe("Smoke: public pages", () => {
  test("landing page loads and shows branding", async ({ page }) => {
    await page.goto("/");

    // The landing page renders the app name and key CTA links.
    await expect(page.getByText("Album Conceptualizer")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Sign in" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open app" }),
    ).toBeVisible();
  });

  test("landing page shows value proposition copy", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByText("Make a concept album people can actually finish."),
    ).toBeVisible();
    await expect(page.getByText("Album canvas")).toBeVisible();
    await expect(page.getByText("Export packs")).toBeVisible();
  });

  test("unauthenticated user visiting /app is redirected to sign-in", async ({
    page,
  }) => {
    await page.goto("/app");

    // The NextAuth middleware redirects unauthenticated requests to /sign-in.
    // The URL will include a callbackUrl query parameter.
    await page.waitForURL("**/sign-in**", { timeout: 15_000 });

    // Verify we actually landed on the sign-in page content.
    await expect(page.getByText("Album Conceptualizer")).toBeVisible();
  });

  test("sign-in page renders provider buttons", async ({ page }) => {
    await page.goto("/sign-in");

    // The sign-in page always shows the GitHub OAuth button.
    await expect(
      page.getByRole("button", { name: "Continue with GitHub" }),
    ).toBeVisible();

    // When NEXT_PUBLIC_ENABLE_DEV_LOGIN=1, the dev login section is shown.
    // In CI/dev environments this should be enabled.
    await expect(page.getByText("Dev login")).toBeVisible();
    await expect(page.getByPlaceholder("email")).toBeVisible();
    await expect(page.getByPlaceholder("name")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue (dev)" }),
    ).toBeVisible();
  });
});
