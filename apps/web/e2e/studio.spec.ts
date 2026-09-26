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
  await page.waitForURL(/\/studio(\?|$)/);
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
    await page.getByRole("navigation", { name: "Album" }).getByRole("link", { name: "Story bible", exact: true }).click();
    await page.waitForURL("**/bible");
    await page.getByRole("navigation", { name: "Album" }).getByRole("link", { name: "Studio", exact: true }).click();
    await page.waitForURL(/\/studio(\?|$)/);
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
    await page.waitForURL(/\/studio(\?|$)/);
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
  test("the address follows a moved track, so a reload opens what was on screen", async ({ page }) => {
    await devLogin(page);
    await createAlbumAndOpenStudio(page, `Move Reload ${randomSuffix()}`);
    const words = "Salt on the lamp glass, the keeper counts the ships.";
    await page.getByLabel("Lyrics draft").fill(words);
    await page.getByRole("button", { name: "Save now", exact: true }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    await page.getByRole("button", { name: "More track actions" }).click();
    await page.getByRole("menuitem", { name: /Move track down/ }).click();
    // The move is shown where a delete would be, with Undo, and the address follows the track.
    await expect(page.getByText("Moved “Track 1” (now “Track 2”) from 01 to 02.")).toBeVisible();
    await expect(page).toHaveURL(/[?&]song=2(&|$)/);
    await page.getByRole("button", { name: "Save now", exact: true }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Lyrics draft")).toHaveValue(words);
  });
  // A save that changes the album's frame (a track title) refreshes the layout. When the writer
  // moved to another track while it was out, the Studio rewrote its address under the refresh,
  // and Next.js then loaded the Studio afresh: focus and the words typed meanwhile were gone
  // from the editor. Its props also named the track the writer had left.
  test("a refresh after a title edit keeps the track the writer moved to", async ({ page, isMobile }) => {
    test.skip(isMobile, "The track list sits beside the editor on a desktop-sized window.");
    await devLogin(page);
    await createAlbumAndOpenStudio(page, `Stay ${randomSuffix()}`);
    const rows = page.locator('button[id^="track-row-"]');
    while ((await rows.count()) < 3) {
      const count = await rows.count();
      await page.getByRole("button", { name: "Add track", exact: true }).first().click();
      await expect(rows).toHaveCount(count + 1);
      await expect(page.getByText("Saving…")).toHaveCount(0);
    }
    const trackRow = (n: number) => rows.nth(n - 1);
    await trackRow(2).click();
    await expect(page).toHaveURL(/[?&]song=2(&|$)/);

    // Hold the layout refresh the title's save sets off, until the writer has moved on.
    const held: Array<() => Promise<void>> = [];
    let holding = true;
    await page.route(
      (url) => url.pathname.endsWith("/studio"),
      async (route) => {
        const headers = route.request().headers();
        if (!holding || headers.rsc !== "1" || headers["next-router-prefetch"]) return route.continue();
        held.push(() => route.continue());
      },
    );
    await page.getByLabel("Track title").fill("Harbour Wall");
    const saved = page.waitForResponse((response) => response.request().method() === "PATCH" && response.ok());
    await page.getByRole("button", { name: "Save now", exact: true }).click();
    await saved;
    await expect.poll(() => held.length).toBeGreaterThan(0);

    await trackRow(3).click();
    const third = await page.getByLabel("Track title").inputValue();
    // Words typed while the refresh is out stay, in the same editor (never loaded afresh).
    await page.evaluate(() => document.getElementById("studio-editor")?.setAttribute("data-probe", "kept"));
    const lyrics = page.getByLabel("Lyrics draft");
    await lyrics.fill("Typed while the refresh was out");
    holding = false;
    const landed = page.waitForResponse((response) => response.url().includes("_rsc") && response.url().includes("/studio?"));
    for (const release of held.splice(0)) await release();
    await landed;
    await page.waitForTimeout(1000);

    await expect(page.locator("#studio-editor")).toHaveAttribute("data-probe", "kept");
    await expect(trackRow(3)).toHaveAttribute("aria-current", "true");
    await expect(page.getByLabel("Track title")).toHaveValue(third);
    await expect(lyrics).toHaveValue("Typed while the refresh was out");
    await expect(lyrics).toBeFocused();
    // Once it has landed, the address follows the track on screen.
    await expect(page).toHaveURL(/[?&]song=3(&|$)/);
  });
  // `focus` and `section` describe an arrival, not where the writer is: they leave the address
  // once applied, even when the link already names the track and section on screen.
  test("a deep link's one-shot focus leaves the address once applied", async ({ page }) => {
    await devLogin(page);
    await createAlbumAndOpenStudio(page, `One Shot ${randomSuffix()}`);
    await expect(page).toHaveURL(/[?&]sid=/);
    const here = page.url();
    await page.goto(`${here}&focus=story`);
    await expect(page.getByLabel("Story note")).toBeFocused();
    await expect(page).not.toHaveURL(/focus=/);
    expect(new URL(page.url()).search).toBe(new URL(here).search);
    // A remix arrival drops its `remixed` too, in place, keeping the track and section.
    await page.goto(`${here}&remixed=1`);
    await expect(page.getByText(/^Remixed into your workspace/)).toBeVisible();
    await expect(page).not.toHaveURL(/remixed=/);
    expect(new URL(page.url()).search).toBe(new URL(here).search);
  });
  test("Save now with an untitled track goes to its title; the tab names the track", async ({ page }) => {
    await devLogin(page);
    const album = `Untitled Save ${randomSuffix()}`;
    await createAlbumAndOpenStudio(page, album);
    const title = page.getByLabel("Track title");
    const name = await title.inputValue();
    await expect(page).toHaveTitle(`Studio · ${name} · ${album} · Album Conceptualizer`);
    await title.fill("");
    await page.getByRole("button", { name: "Save now", exact: true }).click();
    await expect(page.getByText("Couldn't save — Give track 1 a title before saving.")).toBeVisible();
    await expect(title).toBeFocused();
    await expect(page).toHaveTitle(`Studio · Track 1 · ${album} · Album Conceptualizer`);
    // Adding a chip is said, as removing one is.
    await title.fill("Harbour Wall");
    await expect(page).toHaveTitle(`Studio · Harbour Wall · ${album} · Album Conceptualizer`);
    await page.getByRole("button", { name: /Themes and motifs/ }).click();
    await page.getByLabel("Themes", { exact: true }).fill("tide, salt,");
    await expect(page.locator("[aria-live=polite]").filter({ hasText: "Added 2 themes." })).toHaveCount(1);
    // The next page names itself: the Studio's title never follows it out.
    await page.getByRole("navigation", { name: "Album" }).getByRole("link", { name: "Story bible", exact: true }).click();
    await page.waitForURL("**/bible");
    await expect(page).toHaveTitle(new RegExp(`^(?!Studio).*${album}`));
    await page.waitForTimeout(500);
    await expect(page).not.toHaveTitle(/^Studio/);
  });
  test("after a restore, focus lands on the line that says what was restored, said once", async ({ page }) => {
    await devLogin(page);
    await createAlbumAndOpenStudio(page, `Restore Focus ${randomSuffix()}`);
    const albumUrl = page.url().replace(/\/studio.*/, "");
    await page.goto(`${albumUrl}/versions`);
    await page.getByLabel("What's in this version").fill("First pass");
    await page.getByRole("button", { name: "Save version", exact: true }).click();
    await page.getByRole("button", { name: /^Restore the version "First pass"/ }).click();
    await page.getByRole("button", { name: "Restore this version" }).click();
    await page.waitForURL(/\/app\/albums\/[^/?]+(\?|$)/);
    const line = page.getByText(/^Restored “First pass”/);
    await expect(line).toBeVisible();
    await expect(page.locator(":focus")).toContainText("Restored “First pass”");
    // Focus reads it, so no live region says it again.
    await expect(page.locator("[aria-live], [role=status], [role=alert]").filter({ hasText: "Restored" })).toHaveCount(0);
    // The address drops ?restored=, so a reload doesn't announce it again.
    await expect(page).not.toHaveURL(/restored=/);
    await page.reload();
    await expect(page.getByText(/^Restored “First pass”/)).toHaveCount(0);
  });
});

