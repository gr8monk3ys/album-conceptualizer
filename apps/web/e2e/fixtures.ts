import { test as base, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Dev-login helper
// ---------------------------------------------------------------------------
// The app exposes a credentials provider when ENABLE_DEV_LOGIN=1 and
// NEXT_PUBLIC_ENABLE_DEV_LOGIN=1 are set (non-production only).
// This helper navigates to /sign-in, fills the dev-login form, and waits
// until the authenticated app shell renders.
// ---------------------------------------------------------------------------

export interface DevUser {
  email: string;
  name: string;
}

/** Generate a unique dev user for each test run to avoid state collisions. */
function makeDevUser(): DevUser {
  const id = Math.random().toString(36).slice(2, 8);
  return {
    email: `e2e-${id}@example.com`,
    name: `E2E User ${id}`,
  };
}

async function devLogin(page: Page, user?: Partial<DevUser>): Promise<DevUser> {
  const devUser: DevUser = {
    email: user?.email ?? makeDevUser().email,
    name: user?.name ?? makeDevUser().name,
  };

  await page.goto("/sign-in");

  // Wait for the dev-login section to appear (requires NEXT_PUBLIC_ENABLE_DEV_LOGIN=1).
  await expect(page.getByText("Dev login")).toBeVisible({ timeout: 15_000 });

  // The sign-in page pre-fills email/name inputs; clear and fill with our values.
  const emailInput = page.getByPlaceholder("email");
  const nameInput = page.getByPlaceholder("name");

  await emailInput.fill(devUser.email);
  await nameInput.fill(devUser.name);

  await page.getByRole("button", { name: "Continue (dev)" }).click();

  // Wait for redirect into the authenticated app shell.
  await page.waitForURL("**/app", { timeout: 30_000 });

  return devUser;
}

// ---------------------------------------------------------------------------
// Extended test fixture
// ---------------------------------------------------------------------------
// Provides `authenticatedPage` — a page that is already logged in via dev
// credentials — and `devUser` with the generated user info.
// ---------------------------------------------------------------------------

type Fixtures = {
  authenticatedPage: Page;
  devUser: DevUser;
};

export const test = base.extend<Fixtures>({
  devUser: async ({}, use) => {
    const user = makeDevUser();
    await use(user);
  },

  authenticatedPage: async ({ page, devUser }, use) => {
    const loggedIn = await devLogin(page, devUser);
    // Expose the resolved user back through devUser isn't possible after
    // construction, but the page is now authenticated and at /app.
    await use(page);
  },
});

export { expect, devLogin };
