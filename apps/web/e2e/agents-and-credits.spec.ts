import { expect, test, type Page } from "@playwright/test";

// The engine has no copy of web albums, so agent workflows must receive the album snapshot.
// CI's engine runs without ANTHROPIC_API_KEY, which lets us prove the request got past the
// album lookup (a 503 about the key, not a 404 "Album not found") without calling an LLM.

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
  const meter = page.getByRole("meter", { name: "Credits" }).first();
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
    expect(body.error ?? "").toMatch(/ANTHROPIC_API_KEY|agent/i);
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
});
