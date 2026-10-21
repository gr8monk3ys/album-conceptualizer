import { expect, test, type Page } from "@playwright/test";

import { getDailyChallenge } from "../src/server/challenges";

// The engine has no copy of web albums, so agent workflows must receive the album snapshot.
// CI's engine runs without ANTHROPIC_API_KEY, which lets us prove the request got past the
// album lookup (a 503 "not available", not a 404 "Album not found") without calling an LLM.

async function devLogin(page: Page) {
  await page.goto("/sign-in");
  await page.getByPlaceholder("email").fill(`agents-${Math.random().toString(36).slice(2, 8)}@example.com`);
  await page.getByPlaceholder("name").fill("Agents User");
  await page.getByRole("button", { name: "Continue (dev)" }).click();
  await page.waitForURL("**/app");
}

async function createAlbum(page: Page) {
  const response = await page.request.post("/api/albums", {
    data: {
      album: {
        title: "Lighthouse Static",
        concept_summary: "A keeper loses the light and the town forgets the sea.",
        central_themes: ["memory"],
        songs: [
          {
            title: "Foghorn",
            track_number: 1,
            sections: [{ section_type: "verse", order: 0, lyrics: "Salt on the glass" }],
          },
        ],
      },
    },
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

async function remainingCredits(page: Page) {
  await page.goto("/app");
  // The sidebar holding the meter is hidden below md; its value is still in the DOM.
  const meter = page.getByRole("meter", { name: "Credits", includeHidden: true }).first();
  return Number(await meter.getAttribute("aria-valuenow"));
}

test.describe("Agent workflows and credits", () => {
  test("coherence review reaches the engine with the album snapshot and refunds on failure", async ({
    page,
  }) => {
    await devLogin(page);
    const albumId = await createAlbum(page);
    const before = await remainingCredits(page);

    const response = await page.request.post("/api/agents/coherence-review", {
      data: { album_id: albumId },
    });
    const body = (await response.json()) as { error?: string };

    if (response.status() === 202) {
      // An engine with an API key accepted the job: the snapshot path works end to end.
      return;
    }
    expect(body.error ?? "").not.toMatch(/album not found/i);
    // Operator detail (the missing key) stays in the server log, not in the artist's message.
    expect(body.error ?? "").not.toMatch(/ANTHROPIC_API_KEY/);
    expect(body.error ?? "").toMatch(/isn't available on this server/);
    // The failed start was refunded.
    expect(await remainingCredits(page)).toBe(before);
  });

  test("agents reject albums outside the caller's workspace", async ({ page }) => {
    await devLogin(page);
    const response = await page.request.post("/api/agents/coherence-review", {
      data: { album_id: "not-my-album" },
    });
    expect(response.status()).toBe(404);
  });

  test("invalid requests get a 400 with details", async ({ page }) => {
    await devLogin(page);
    const response = await page.request.post("/api/albums", { data: { album: { title: "" } } });
    expect(response.status()).toBe(400);
    const body = (await response.json()) as { error: string; details?: string[] };
    expect(body.error).toBe("Invalid album payload.");
    expect(body.details?.length).toBeGreaterThan(0);
  });

  test("a challenge entry links to the album it was written for, only within the workspace", async ({
    page,
  }) => {
    await devLogin(page);
    const albumId = await createAlbum(page);
    const { challenge } = getDailyChallenge();
    const notes = "Drafted a chorus hook and a four-chord loop for the opener.";

    const foreign = await page.request.post("/api/challenges/complete", {
      data: { challengeKey: challenge.key, notes, albumId: "not-my-album" },
    });
    expect(foreign.status()).toBe(404);

    const before = await remainingCredits(page);
    const done = await page.request.post("/api/challenges/complete", {
      data: { challengeKey: challenge.key, notes, albumId, trackNumber: 1 },
    });
    expect(done.status()).toBe(200);
    expect(await remainingCredits(page)).toBe(before + challenge.credits);

    await page.goto("/app/challenges");
    await expect(page.getByRole("link", { name: /Lighthouse Static · 01 Foghorn/ })).toBeVisible();
    await expect(page.getByText(notes)).toBeVisible();
  });

  test("the challenge opens in the Studio above the lyrics, and pays there for them", async ({ page }) => {
    await devLogin(page);
    await createAlbum(page);
    const { challenge } = getDailyChallenge();
    const before = await remainingCredits(page);

    await page.goto("/app/challenges");
    await page.getByRole("link", { name: "Take the challenge" }).click();
    await page.waitForURL(/\/studio\?/);
    // The prompt stays pinned while the writer moves around the Studio: its parameter stays.
    await expect(page).toHaveURL(new RegExp(`challenge=${challenge.key}`));
    const band = page.getByRole("group", { name: `Today’s challenge: ${challenge.title}.` });
    await expect(band).toContainText(challenge.description);
    // The prompt is part of what the lyrics field says it is for.
    await expect(page.getByLabel("Lyrics draft")).toHaveAttribute("aria-describedby", /studio-challenge-prompt/);

    // An album made today counts from nothing, so its written verse pays at once.
    await band.getByRole("button", { name: `Claim ${challenge.credits} credits` }).click();
    await expect(band).toContainText(`Done for today: ${challenge.credits} credits added to your workspace.`);
    await expect(band.getByRole("button", { name: "Hide today’s challenge" })).toBeFocused();
    await band.getByRole("button", { name: "Hide today’s challenge" }).click();
    await expect(band).toHaveCount(0);
    await expect(page).not.toHaveURL(/challenge=/);
    await expect(page.getByLabel("Lyrics draft")).toBeFocused();

    expect(await remainingCredits(page)).toBe(before + challenge.credits);
    await page.goto("/app/challenges");
    await expect(page.getByRole("link", { name: /Lighthouse Static · 01 Foghorn/ })).toBeVisible();
  });
});
