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
  await page.getByPlaceholder("email").fill(`mgmt-${randomSuffix()}@example.com`);
  await page.getByPlaceholder("name").fill("Album Mgmt User");
  await page.getByRole("button", { name: "Continue (dev)" }).click();
  await page.waitForURL("**/app");
}

async function createAlbumFromWizard(
  page: import("@playwright/test").Page,
  input: { title: string; artist: string; concept: string },
) {
  await page.goto("/app/create");
  await page.getByLabel("Album title").fill(input.title);
  await page.getByLabel("Artist").fill(input.artist);
  await page.getByLabel("Concept summary").fill(input.concept);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.waitForURL("**/app/albums/**");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Album Management", () => {
  test("create album navigates to album detail page", async ({ page }) => {
    await devLogin(page);

    const title = `Create Test ${randomSuffix()}`;
    await createAlbumFromWizard(page, {
      title,
      artist: "Test Band",
      concept: "A late-summer record about memory, heat, and unfinished goodbyes.",
    });

    await expect(page.getByText(title).first()).toBeVisible();
    await expect(page.getByText("Blueprint saved")).toBeVisible();
  });

  test("created album appears in Recent projects on dashboard", async ({ page }) => {
    await devLogin(page);

    const title = `Dashboard Album ${randomSuffix()}`;
    await createAlbumFromWizard(page, {
      title,
      artist: "Dashboard Band",
      concept: "An album about driving at night and trying not to go home yet.",
    });

    await page.goto("/app");
    await expect(page.getByRole("link", { name: title }).first()).toBeVisible();
  });

  test("album detail page links to studio", async ({ page }) => {
    await devLogin(page);

    const title = `Studio Link ${randomSuffix()}`;
    await createAlbumFromWizard(page, {
      title,
      artist: "Linker",
      concept: "A winter-to-spring arc told through one apartment building.",
    });

    await page.getByRole("main").getByRole("link", { name: "Studio", exact: true }).click();
    await page.waitForURL("**/studio");
    await expect(page).toHaveURL(/studio/);
  });

  test("album detail page links to export", async ({ page }) => {
    await devLogin(page);

    const title = `Export Link ${randomSuffix()}`;
    await createAlbumFromWizard(page, {
      title,
      artist: "Exporter",
      concept: "A concept record about leaving a coastal town for the city.",
    });

    await page.getByRole("main").getByRole("link", { name: "Export", exact: true }).click();
    await page.waitForURL("**/export");
    await expect(page).toHaveURL(/export/);
  });

  test("export page downloads a Suno handoff pack", async ({ page }) => {
    await devLogin(page);

    const title = `Handoff ${randomSuffix()}`;
    await createAlbumFromWizard(page, {
      title,
      artist: "Prompt Club",
      concept: "A concept album about airport hotels, rerouted flights, and the last message before sunrise.",
    });

    await page.getByRole("main").getByRole("link", { name: "Export", exact: true }).click();
    await page.waitForURL("**/export");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Download Suno brief" }).click(),
    ]);

    expect(download.suggestedFilename()).toContain("suno_handoff_pack");
  });

  test("coherence report shows breakdown and next actions", async ({ page }) => {
    await devLogin(page);

    const title = `Coherence ${randomSuffix()}`;
    await createAlbumFromWizard(page, {
      title,
      artist: "Arc Runner",
      concept: "A concept album about city lights, false exits, and trying to reconnect.",
    });

    await page.getByRole("main").getByRole("link", { name: "View report" }).click();
    await page.waitForURL("**/coherence");
    await expect(page.getByText("Coherence report v2")).toBeVisible();
    await expect(page.getByText("Next actions")).toBeVisible();
    await expect(page.getByText("Narrative").first()).toBeVisible();
    await expect(page.getByText("Lyrics").first()).toBeVisible();
    await expect(page.getByText("Harmony").first()).toBeVisible();
  });

  test("reference workspace saves a track reference and reflects it on the album page", async ({
    page,
  }) => {
    await devLogin(page);

    const title = `References ${randomSuffix()}`;
    await createAlbumFromWizard(page, {
      title,
      artist: "Reference Club",
      concept: "A concept album about train stations, detours, and messages that arrive too late.",
    });

    await page.getByRole("main").getByRole("link", { name: "References", exact: true }).click();
    await page.waitForURL("**/references");
    await page.getByLabel("Reference title").fill("Dreams Tonite");
    await page.getByLabel("Artist").fill("Alvvays");
    await page.getByLabel("Target role").selectOption("chorus-energy");
    await page.getByLabel("Song target").selectOption({ index: 1 });
    await page.getByLabel("Mood tags").fill("shimmering, bittersweet");
    await page.getByLabel("Arrangement tags").fill("stacked vocals, punchy drums");
    await page
      .getByLabel("Why this reference matters")
      .fill("Use this as the benchmark for chorus lift and vocal blend.");
    await page.getByRole("button", { name: "Add reference" }).click();

    await expect(page.getByText("Reference added.")).toBeVisible();
    await expect(page.getByText("Dreams Tonite").first()).toBeVisible();

    await page.getByRole("link", { name: "Back" }).click();
    await expect(page.getByRole("main").getByText("Reference tracks")).toBeVisible();
    await expect(page.getByText("Dreams Tonite · Alvvays")).toBeVisible();
  });

  test("style bible saves voice and palette guidance and reflects it on the album page", async ({
    page,
  }) => {
    await devLogin(page);

    const title = `Style Bible ${randomSuffix()}`;
    await createAlbumFromWizard(page, {
      title,
      artist: "Palette Club",
      concept: "A concept album about hotel hallways, missed calls, and one long overnight drive.",
    });

    await page.getByRole("main").getByRole("link", { name: "Style", exact: true }).click();
    await page.waitForURL("**/style");
    await page
      .getByLabel("Lead voice brief")
      .fill("Close-mic alto with hushed verses and a brighter chorus lift.");
    await page
      .getByLabel("Sonic palette")
      .fill("chorused guitars, dry drum room, soft synth haze");
    await page
      .getByLabel("Mix priorities")
      .fill("lead vocal forward, bass warm not boomy, choruses widen hard");
    await page
      .getByLabel("Reference strategy")
      .fill("Use references to keep the opener intimate and the choruses wider without going glossy.");
    await page.getByRole("button", { name: "Save style bible" }).click();

    await expect(page.getByText("Style bible saved.")).toBeVisible();

    await page.getByRole("link", { name: "Back" }).click();
    await expect(page.getByRole("main").getByText("Voice / Style Bible").first()).toBeVisible();
    await expect(page.getByText("Close-mic alto with hushed verses").first()).toBeVisible();
  });

  test("rough demo workspace saves a demo capture and reflects it on the album page", async ({
    page,
  }) => {
    await devLogin(page);

    const title = `Rough Demo ${randomSuffix()}`;
    await createAlbumFromWizard(page, {
      title,
      artist: "Memo Club",
      concept: "A concept album about airport lounges, neon vending machines, and the chorus you only hear once.",
    });

    await page.getByRole("main").getByRole("link", { name: "Demos", exact: true }).click();
    await page.waitForURL("**/demos");
    await page.getByLabel("Local rough demo file").setInputFiles({
      name: "hallway-memo.wav",
      mimeType: "audio/wav",
      buffer: Buffer.from("rough-demo-audio"),
    });
    await page.getByLabel("Demo title").fill("Hallway chorus memo");
    await page.getByLabel("Source kind").selectOption("hook-sketch");
    await page.getByLabel("Song target").selectOption({ index: 1 });
    await page
      .getByLabel("What this demo captures")
      .fill("The chorus rhythm is working even though the verse still needs a rewrite.");
    await page.getByLabel("Sonic traits").fill("handclap pulse, whispered hook");
    await page.getByLabel("Next moves").fill("rewrite verse 1, test slower tempo");
    await page.getByRole("button", { name: "Add demo" }).click();

    await expect(page.getByText("Demo added.")).toBeVisible();
    await expect(page.getByText("Hallway chorus memo").first()).toBeVisible();
    await expect(page.getByText("Structured review").first()).toBeVisible();
    await expect(page.getByText("Chorus or post-chorus candidate").first()).toBeVisible();

    await page.getByRole("link", { name: "Back" }).click();
    await expect(page.getByRole("main").getByText("Rough demos").first()).toBeVisible();
    await expect(page.getByText("Hallway chorus memo").first()).toBeVisible();
  });

  test("analytics page shows the new project in the workspace funnel", async ({ page }) => {
    await devLogin(page);

    const title = `Analytics ${randomSuffix()}`;
    await createAlbumFromWizard(page, {
      title,
      artist: "Metrics Club",
      concept: "A concept album about trying to measure a relationship after it is over.",
    });

    await page.goto("/app/settings/analytics");
    await expect(page.locator("main").getByText("Workspace funnel").first()).toBeVisible();
    await expect(page.getByText("Last 30 days")).toBeVisible();
    await expect(page.getByText("Album created")).toBeVisible();
    await expect(page.getByRole("link", { name: title })).toBeVisible();
  });
});
