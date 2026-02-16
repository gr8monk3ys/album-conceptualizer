import { test, expect } from "./fixtures";

// ---------------------------------------------------------------------------
// Album tests — verify creating, listing, and opening albums.
// ---------------------------------------------------------------------------

test.describe("Albums: create and view", () => {
  test("create a new album, verify redirect to album detail", async ({
    authenticatedPage: page,
  }) => {
    const albumTitle = `E2E Album ${Math.random().toString(36).slice(2, 8)}`;

    // Navigate to the Create page.
    await page.goto("/app/create");
    await expect(page.getByText("Generate album.json")).toBeVisible();

    // Fill in album details.
    await page.getByLabel("Album title").fill(albumTitle);
    await page.getByLabel("Artist").fill("E2E Artist");

    // Generate the album JSON.
    await page
      .getByRole("button", { name: "Generate album.json" })
      .click();

    // Wait for the JSON preview to appear, then save.
    await expect(page.getByText("Generated album.json.")).toBeVisible();

    await page.getByRole("button", { name: "Save" }).click();

    // Saving redirects to the album detail page.
    await page.waitForURL("**/app/albums/**", { timeout: 30_000 });

    // The album detail page should show the title and artist.
    await expect(page.getByText(albumTitle)).toBeVisible();
    await expect(page.getByText("by E2E Artist")).toBeVisible();

    // Verify the tracklist section is rendered.
    await expect(page.getByText("Tracklist")).toBeVisible();
    await expect(page.getByText("Songs")).toBeVisible();
  });

  test("album listing page shows created albums", async ({
    authenticatedPage: page,
  }) => {
    const albumTitle = `Listing Test ${Math.random().toString(36).slice(2, 8)}`;

    // Create an album first.
    await page.goto("/app/create");
    await page.getByLabel("Album title").fill(albumTitle);
    await page.getByLabel("Artist").fill("Listing Artist");
    await page
      .getByRole("button", { name: "Generate album.json" })
      .click();
    await expect(page.getByText("Generated album.json.")).toBeVisible();
    await page.getByRole("button", { name: "Save" }).click();
    await page.waitForURL("**/app/albums/**", { timeout: 30_000 });

    // Go to the Library page and verify the album appears.
    await page.goto("/app/library");
    await expect(page.getByText("All projects")).toBeVisible();
    await expect(page.getByText(albumTitle)).toBeVisible();
  });

  test("clicking into an album shows the studio view", async ({
    authenticatedPage: page,
  }) => {
    const albumTitle = `Studio Test ${Math.random().toString(36).slice(2, 8)}`;

    // Create an album.
    await page.goto("/app/create");
    await page.getByLabel("Album title").fill(albumTitle);
    await page.getByLabel("Artist").fill("Studio Artist");
    await page
      .getByRole("button", { name: "Generate album.json" })
      .click();
    await expect(page.getByText("Generated album.json.")).toBeVisible();
    await page.getByRole("button", { name: "Save" }).click();
    await page.waitForURL("**/app/albums/**", { timeout: 30_000 });

    // We should be on the album detail page. Click "Studio" to enter the studio view.
    await page.getByRole("link", { name: "Studio" }).click();
    await page.waitForURL("**/studio", { timeout: 15_000 });

    // The studio page shows the album title and editing instructions.
    await expect(page.getByText(albumTitle)).toBeVisible();
    await expect(
      page.getByText("Edit lyrics drafts, chord loops, and structure per section."),
    ).toBeVisible();
  });
});
