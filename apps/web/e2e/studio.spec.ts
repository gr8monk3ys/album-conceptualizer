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
  // Saving spends credits, so it asks once: the trigger, then the confirm.
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.getByRole("button", { name: "Save and continue", exact: true }).click();
  await page.waitForURL("**/app/albums/**");
  await page.getByRole("navigation", { name: "Album" }).getByRole("link", { name: "Studio", exact: true }).click();
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
    await page.getByRole("button", { name: "Save now", exact: true }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
  });

  test("studio export button triggers zip download", async ({ page }) => {
    await devLogin(page);
    const title = `Export Download ${randomSuffix()}`;
    await createAlbumAndOpenStudio(page, title);

    // Navigate to export tab
    await page.getByRole("navigation", { name: "Album" }).getByRole("link", { name: "Export", exact: true }).click();
    await page.waitForURL("**/export");

    // The zip spends credits, so it asks once: open the confirm, then download.
    await page.getByRole("button", { name: "Download zip · 2 credits" }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download zip", exact: true }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/_export\.zip$/);
    expect(await download.path()).not.toBeNull();
    // Focus is back on the trigger once the confirm closes, never on the page body.
    await expect(page.getByRole("button", { name: "Download zip · 2 credits" })).toBeFocused();
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
  });

  // WCAG 2.4.11: no focus stop may be hidden under the sticky header or save bar, including at
  // 200% text on a laptop-sized screen, where the sticky layers are tallest.
  test("keyboard focus is never hidden under the sticky layers at 200% text", async ({ page, isMobile }) => {
    test.skip(isMobile, "Desktop geometry: the sticky save bar only sticks on tall viewports.");
    await page.setViewportSize({ width: 1024, height: 768 });
    await devLogin(page);
    await createAlbumAndOpenStudio(page, `Focus ${randomSuffix()}`);
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    await page.locator("body").focus();

    const hidden: string[] = [];
    for (let stop = 0; stop < 60; stop += 1) {
      await page.keyboard.press("Tab");
      const problem = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        const name = `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}"`;
        if (rect.bottom <= 0 || rect.top >= innerHeight) return `${name} is off-screen (top ${Math.round(rect.top)})`;
        // Sample the visible part of the control: whatever is painted there must be the control.
        const top = Math.max(rect.top, 0);
        const bottom = Math.min(rect.bottom, innerHeight);
        const x = Math.min(Math.max(rect.left + rect.width / 2, 1), innerWidth - 1);
        const y = top + (bottom - top) / 2;
        const hit = document.elementFromPoint(x, y);
        return hit && (hit === el || el.contains(hit) || hit.contains(el)) ? null : `${name} is covered`;
      });
      if (problem) hidden.push(problem);
    }
    expect(hidden).toEqual([]);
  });

  // Leaving the Studio inside the autosave window used to drop the last words typed: in-app
  // navigation unmounted the editor before its 2 s save ran.
  test("words typed just before switching tabs are saved, not lost", async ({ page }) => {
    await devLogin(page);
    await createAlbumAndOpenStudio(page, `Leave ${randomSuffix()}`);
    const line = `Sirens practise on a Tuesday ${randomSuffix()}`;
    await page.getByLabel("Lyrics draft").fill(line);
    // Straight to another tab, well inside the autosave delay.
    await page.getByRole("navigation", { name: "Album" }).getByRole("link", { name: "Bible", exact: true }).click();
    await page.waitForURL("**/bible");
    await page.getByRole("navigation", { name: "Album" }).getByRole("link", { name: "Studio", exact: true }).click();
    await page.waitForURL("**/studio");
    await expect(page.getByLabel("Lyrics draft")).toHaveValue(line);
  });
  test("focus never falls to the page after creating an album or editing chips", async ({ page }) => {
    await devLogin(page);
    await page.goto("/app/create");
    await page.getByLabel("Album title").fill(`Focus Arrival ${randomSuffix()}`);
    await page.getByLabel("Artist").fill("Studio Artist");
    await page.getByLabel("Concept summary").fill("A concept album about a lighthouse keeper's last winter.");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await page.getByRole("button", { name: "Save and continue", exact: true }).click();
    await page.waitForURL("**/app/albums/**");
    // The wizard's button is gone; focus lands on the line that says the album is saved.
    await expect(page.getByRole("group", { name: "Album saved" })).toBeFocused();

    await page.getByRole("navigation", { name: "Album" }).getByRole("link", { name: "Studio", exact: true }).click();
    await page.waitForURL("**/studio");
    await page.getByRole("button", { name: /Themes and motifs/ }).click();
    const themes = page.getByLabel("Themes", { exact: true });
    await themes.fill("tide");
    await page.getByRole("button", { name: "Add theme", exact: true }).click();
    // Add returns to the field, ready for the next one.
    await expect(themes).toBeFocused();
    await themes.fill("salt");
    await themes.press("Enter");
    await page.getByRole("button", { name: "Remove theme “tide”" }).click();
    // Removing a chip moves to the next chip's remove button.
    await expect(page.getByRole("button", { name: "Remove theme “salt”" })).toBeFocused();
    await page.getByRole("button", { name: "Remove theme “salt”" }).press("Enter");
    // The last chip gone, focus returns to the field.
    await expect(themes).toBeFocused();
  });
});

