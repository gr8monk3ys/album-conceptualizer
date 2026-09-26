import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AutosaveController,
  clearDraft,
  guardedDestination,
  mergeStringFields,
  readDraft,
  writeDraft,
  type DraftStorage,
  type LinkClick,
} from "@/lib/use-autosave";

type Deferred = { resolve: () => void; reject: (error: Error) => void; value: string };

/** A save function whose calls stay pending until the test settles them. */
function controllableSave() {
  const calls: Deferred[] = [];
  const save = vi.fn(
    (value: string) =>
      new Promise<void>((resolve, reject) => {
        calls.push({ resolve, reject, value });
      }),
  );
  return { save, calls };
}

async function settle() {
  // Let chained promise callbacks run.
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

describe("AutosaveController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts idle and treats the initial value as saved", async () => {
    const { save } = controllableSave();
    const controller = new AutosaveController({ initial: "a", save, delayMs: 2000 });
    expect(controller.getState().status).toBe("idle");
    controller.update("a");
    expect(controller.getState().status).toBe("idle");
    await expect(controller.saveNow()).resolves.toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  it("debounces changes and saves the latest value once", async () => {
    const { save, calls } = controllableSave();
    const controller = new AutosaveController({ initial: "a", save, delayMs: 2000, now: () => 42 });
    controller.update("ab");
    controller.update("abc");
    expect(controller.getState().status).toBe("dirty");
    vi.advanceTimersByTime(1999);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    await settle();
    expect(save).toHaveBeenCalledTimes(1);
    expect(calls[0].value).toBe("abc");
    expect(controller.getState().status).toBe("saving");
    calls[0].resolve();
    await settle();
    expect(controller.getState()).toEqual({ status: "saved", lastSavedAt: 42, error: null });
  });

  it("returns to clean without saving when edits are undone", () => {
    const { save } = controllableSave();
    const controller = new AutosaveController({ initial: "a", save, delayMs: 2000 });
    controller.update("ab");
    controller.update("a");
    expect(controller.getState().status).toBe("idle");
    vi.advanceTimersByTime(5000);
    expect(save).not.toHaveBeenCalled();
  });

  it("keeps one save in flight and queues the latest value behind it", async () => {
    const { save, calls } = controllableSave();
    const controller = new AutosaveController({ initial: "a", save, delayMs: 2000 });
    controller.update("b");
    const first = controller.saveNow();
    await settle();
    controller.update("c");
    controller.update("d");
    const second = controller.saveNow();
    const third = controller.saveNow();
    await settle();
    expect(save).toHaveBeenCalledTimes(1);
    expect(second).toBe(third);

    calls[0].resolve();
    await expect(first).resolves.toBe(true);
    await settle();
    expect(save).toHaveBeenCalledTimes(2);
    expect(calls[1].value).toBe("d");
    calls[1].resolve();
    await expect(second).resolves.toBe(true);
    expect(controller.getState().status).toBe("saved");
  });

  it("schedules another save when edits arrive during a save", async () => {
    const { save, calls } = controllableSave();
    const controller = new AutosaveController({ initial: "a", save, delayMs: 2000 });
    controller.update("b");
    void controller.saveNow();
    await settle();
    controller.update("c");
    calls[0].resolve();
    await settle();
    expect(controller.getState().status).toBe("dirty");
    vi.advanceTimersByTime(2000);
    await settle();
    expect(calls[1].value).toBe("c");
  });

  it("reports a failure with its message and saves again on retry", async () => {
    const { save, calls } = controllableSave();
    const controller = new AutosaveController({ initial: "a", save, delayMs: 2000 });
    controller.update("b");
    const attempt = controller.saveNow();
    await settle();
    calls[0].reject(new Error("The server is busy."));
    await expect(attempt).resolves.toBe(false);
    expect(controller.getState()).toMatchObject({ status: "error", error: "The server is busy." });
    expect(controller.hasUnsavedChanges()).toBe(true);

    const retry = controller.retry();
    await settle();
    calls[1].resolve();
    await expect(retry).resolves.toBe(true);
    expect(controller.getState()).toMatchObject({ status: "saved", error: null });
    expect(controller.hasUnsavedChanges()).toBe(false);
  });

  it("flush sends pending edits without waiting for the debounce", async () => {
    const { save } = controllableSave();
    const controller = new AutosaveController({ initial: "a", save, delayMs: 2000 });
    controller.update("b");
    controller.flush();
    await settle();
    expect(save).toHaveBeenCalledWith("b");
  });

  it("compares values with the serializer, not by identity", () => {
    const { save } = controllableSave();
    const controller = new AutosaveController<{ text: string }>({
      initial: { text: "a" },
      save: (value) => save(value.text),
      delayMs: 2000,
    });
    controller.update({ text: "a" });
    expect(controller.getState().status).toBe("idle");
  });
});

describe("guardedDestination", () => {
  const here = "https://app.example.com/app/albums/1/style";
  const click = (overrides: Partial<LinkClick> = {}): LinkClick => ({
    href: "https://app.example.com/app/albums/1/references",
    target: "",
    download: false,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    ...overrides,
  });

  it("guards a plain same-origin link and returns an app path", () => {
    expect(guardedDestination(click(), here)).toBe("/app/albums/1/references");
    expect(guardedDestination(click({ href: "/app?tab=2#top" }), here)).toBe("/app?tab=2#top");
  });

  it("leaves new-tab, modified, download and other-site clicks alone", () => {
    expect(guardedDestination(click({ target: "_blank" }), here)).toBeNull();
    expect(guardedDestination(click({ metaKey: true }), here)).toBeNull();
    expect(guardedDestination(click({ ctrlKey: true }), here)).toBeNull();
    expect(guardedDestination(click({ button: 1 }), here)).toBeNull();
    expect(guardedDestination(click({ download: true }), here)).toBeNull();
    expect(guardedDestination(click({ href: "https://open.spotify.com/x" }), here)).toBeNull();
    expect(guardedDestination(click({ href: "mailto:a@b.co" }), here)).toBeNull();
    expect(guardedDestination(click({ defaultPrevented: true }), here)).toBeNull();
  });

  it("ignores links to a spot on the same page", () => {
    expect(guardedDestination(click({ href: "#style-leadVoice" }), here)).toBeNull();
  });
});

describe("session drafts", () => {
  function memoryStorage(): DraftStorage & { data: Map<string, string> } {
    const data = new Map<string, string>();
    return {
      data,
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => void data.set(key, value),
      removeItem: (key) => void data.delete(key),
    };
  }

  it("round-trips a draft and clears it", () => {
    const storage = memoryStorage();
    expect(writeDraft("k", { title: "Dreams" }, storage)).toBe(true);
    expect(readDraft("k", storage)).toEqual({ title: "Dreams" });
    clearDraft("k", storage);
    expect(readDraft("k", storage)).toBeNull();
  });

  it("survives unavailable, full or corrupt storage", () => {
    expect(writeDraft("k", { a: 1 }, null)).toBe(false);
    expect(readDraft("k", null)).toBeNull();
    const full: DraftStorage = {
      getItem: () => "{not json",
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(writeDraft("k", { a: 1 }, full)).toBe(false);
    expect(readDraft("k", full)).toBeNull();
    expect(() => clearDraft("k", full)).not.toThrow();
  });

  it("merges only known string fields from a stored draft", () => {
    const base = { title: "", bpm: "", file: null as null | { name: string } };
    expect(mergeStringFields(base, { title: "Dreams", bpm: 118, extra: "x" })).toEqual({
      title: "Dreams",
      bpm: "",
      file: null,
    });
    expect(mergeStringFields(base, "garbage")).toBe(base);
  });
});
