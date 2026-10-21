import { describe, expect, it } from "vitest";

import {
  KEEPALIVE_BODY_LIMIT,
  KEEPALIVE_BUDGET,
  KeepaliveBudget,
  albumPatchBody,
  bodyBytes,
  sendAlbumPatch,
} from "@/components/studio/save-transport";
import { versionSavedText } from "@/components/studio/studio-model";

/**
 * A browser's fetch, as far as keepalive goes: keepalive bodies in flight share 64 KiB, and a
 * keepalive request past that is refused with a TypeError (what a dropped connection gives
 * too). Requests stay in flight until `finish` answers them.
 */
function fakeBrowser({ online = true } = {}) {
  const pending: Array<{ keepalive: boolean; bytes: number; resolve: (r: Response) => void }> = [];
  let keepaliveBytes = 0;
  const sent: Array<{ keepalive: boolean; bytes: number }> = [];
  const fetcher = ((_url: string, init?: RequestInit) => {
    const bytes = bodyBytes(String(init?.body ?? ""));
    const keepalive = Boolean(init?.keepalive);
    if (!online) return Promise.reject(new TypeError("Failed to fetch"));
    if (keepalive && keepaliveBytes + bytes > KEEPALIVE_BUDGET) return Promise.reject(new TypeError("Failed to fetch"));
    if (keepalive) keepaliveBytes += bytes;
    sent.push({ keepalive, bytes });
    return new Promise<Response>((resolve) => {
      pending.push({
        keepalive,
        bytes,
        resolve: (response) => {
          if (keepalive) keepaliveBytes -= bytes;
          resolve(response);
        },
      });
    });
  }) as typeof fetch;
  return {
    fetcher,
    sent,
    get keepaliveBytes() {
      return keepaliveBytes;
    },
    finish() {
      for (const request of pending.splice(0)) request.resolve(new Response('{"ok":true}', { status: 200 }));
    },
  };
}

/** An album save body of about `kb` kilobytes. */
function bodyOf(kb: number) {
  return albumPatchBody({ title: "Harbour Lights", songs: [{ title: "Track 1", lyrics: "la ".repeat((kb * 1000) / 3) }] });
}

describe("KeepaliveBudget", () => {
  it("lets a routine save and a last-chance save of the largest keepalive size fit together", () => {
    expect(2 * KEEPALIVE_BODY_LIMIT).toBeLessThanOrEqual(KEEPALIVE_BUDGET);
    const budget = new KeepaliveBudget();
    expect(budget.take(KEEPALIVE_BODY_LIMIT, "routine")).toBe(true);
    expect(budget.take(KEEPALIVE_BODY_LIMIT, "last-chance")).toBe(true);
    expect(budget.inFlight).toBe(2 * KEEPALIVE_BODY_LIMIT);
  });

  it("gives a large album (32–64 KB) keepalive while the budget is free", () => {
    // A 40 KB album: its immediate save (a delete) and, failing that, its last-chance save
    // must still survive a reload, so both may use the free budget.
    const budget = new KeepaliveBudget();
    expect(budget.take(40_000, "routine")).toBe(true);
    budget.give(40_000);
    expect(budget.take(40_000, "last-chance")).toBe(true);
    // With one 40 KB request in flight, another can't join it.
    expect(budget.take(40_000, "last-chance")).toBe(false);
  });

  it("keeps a body larger than the whole budget off keepalive", () => {
    const budget = new KeepaliveBudget();
    expect(budget.take(KEEPALIVE_BUDGET + 1, "routine")).toBe(false);
    expect(budget.take(KEEPALIVE_BUDGET + 1, "last-chance")).toBe(false);
    expect(budget.inFlight).toBe(0);
  });

  it("sends a routine save without keepalive when it would leave no room for a last-chance save", () => {
    const budget = new KeepaliveBudget();
    expect(budget.take(20_000, "last-chance")).toBe(true);
    expect(budget.take(20_000, "routine")).toBe(false);
    expect(budget.take(13_000, "routine")).toBe(true);
  });

  it("gives the room back when a request finishes", () => {
    const budget = new KeepaliveBudget();
    budget.take(30_000, "last-chance");
    budget.take(30_000, "last-chance");
    expect(budget.take(10_000, "last-chance")).toBe(false);
    budget.give(30_000);
    expect(budget.take(10_000, "last-chance")).toBe(true);
    budget.give(1_000_000);
    expect(budget.inFlight).toBe(0);
  });
});

describe("sendAlbumPatch", () => {
  it("sends an ordinary album save with keepalive, so a reload can't cancel it", async () => {
    const browser = fakeBrowser();
    const patch = sendAlbumPatch("a1", bodyOf(1), "routine", { budget: new KeepaliveBudget(), fetcher: browser.fetcher });
    expect(patch.keepalive()).toBe(true);
    browser.finish();
    expect((await patch.response).status).toBe(200);
  });

  it("gets the last-chance save through while a 40 KB autosave is in flight", async () => {
    // The browser refused a second 40 KB keepalive save (80 KB in flight); the edits after the
    // autosave's revision were lost as the tab closed.
    const browser = fakeBrowser();
    const budget = new KeepaliveBudget();
    const autosave = sendAlbumPatch("a1", bodyOf(40), "routine", { budget, fetcher: browser.fetcher });
    const lastChance = sendAlbumPatch("a1", bodyOf(40), "last-chance", { budget, fetcher: browser.fetcher });
    await Promise.resolve();
    expect(browser.sent).toHaveLength(2);
    browser.finish();
    expect((await autosave.response).status).toBe(200);
    expect((await lastChance.response).status).toBe(200);
  });

  it("keeps the last-chance save on keepalive beside an autosave of the largest keepalive size", async () => {
    const browser = fakeBrowser();
    const budget = new KeepaliveBudget();
    const big = albumPatchBody({ lyrics: "x".repeat(KEEPALIVE_BODY_LIMIT - 23) });
    expect(bodyBytes(big)).toBe(KEEPALIVE_BODY_LIMIT);
    const autosave = sendAlbumPatch("a1", big, "routine", { budget, fetcher: browser.fetcher });
    const lastChance = sendAlbumPatch("a1", big, "last-chance", { budget, fetcher: browser.fetcher });
    expect(autosave.keepalive()).toBe(true);
    expect(lastChance.keepalive()).toBe(true);
    await Promise.resolve();
    expect(browser.sent.map((request) => request.keepalive)).toEqual([true, true]);
    browser.finish();
    await Promise.all([autosave.response, lastChance.response]);
    expect(budget.inFlight).toBe(0);
  });

  it("sends again without keepalive when the browser refuses it, and says it did", async () => {
    const browser = fakeBrowser();
    // Something else on the page (not counted here) holds most of the browser's budget.
    const other = sendAlbumPatch("a1", "x".repeat(KEEPALIVE_BUDGET - 1000), "last-chance", {
      budget: new KeepaliveBudget(KEEPALIVE_BUDGET, KEEPALIVE_BUDGET),
      fetcher: browser.fetcher,
    });
    const budget = new KeepaliveBudget();
    const patch = sendAlbumPatch("a1", bodyOf(10), "last-chance", { budget, fetcher: browser.fetcher });
    expect(patch.keepalive()).toBe(true);
    // Refused, then sent plainly: it stays in flight rather than failing.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(patch.keepalive()).toBe(false);
    expect(browser.sent.map((request) => request.keepalive)).toEqual([true, false]);
    browser.finish();
    expect((await patch.response).status).toBe(200);
    await other.response;
    expect(budget.inFlight).toBe(0);
  });

  it("rejects with a TypeError only when the server can't be reached", async () => {
    const browser = fakeBrowser({ online: false });
    const budget = new KeepaliveBudget();
    const patch = sendAlbumPatch("a1", bodyOf(1), "routine", { budget, fetcher: browser.fetcher });
    await expect(patch.response).rejects.toBeInstanceOf(TypeError);
    expect(budget.inFlight).toBe(0);
  });

  it("sends a large album's last-chance save with keepalive when the budget is free", async () => {
    const browser = fakeBrowser();
    const patch = sendAlbumPatch("a1", bodyOf(50), "last-chance", { budget: new KeepaliveBudget(), fetcher: browser.fetcher });
    expect(patch.keepalive()).toBe(true);
    expect(browser.sent.map((request) => request.keepalive)).toEqual([true]);
    browser.finish();
    expect((await patch.response).status).toBe(200);
  });

  it("sends a body over the whole budget without keepalive", async () => {
    const browser = fakeBrowser();
    const patch = sendAlbumPatch("a1", bodyOf(70), "last-chance", { budget: new KeepaliveBudget(), fetcher: browser.fetcher });
    expect(patch.keepalive()).toBe(false);
    expect(browser.sent.map((request) => request.keepalive)).toEqual([false]);
    browser.finish();
    expect((await patch.response).status).toBe(200);
  });
});

describe("bodyBytes", () => {
  it("counts UTF-8 bytes, not characters", () => {
    // "é" is two bytes: 40 of them are 80 bytes.
    expect(bodyBytes("é".repeat(40))).toBe(80);
  });
});

describe("versionSavedText", () => {
  it("names the version it saved", () => {
    expect(versionSavedText("First pass")).toBe("Saved “First pass” as a version.");
    expect(versionSavedText("  tightened chorus ")).toBe("Saved “tightened chorus” as a version.");
  });

  it("still confirms a version without a note", () => {
    expect(versionSavedText("")).toBe("Saved as a version.");
    expect(versionSavedText(undefined)).toBe("Saved as a version.");
  });
});
