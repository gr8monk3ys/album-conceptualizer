import { describe, expect, it } from "vitest";

import {
  ARRIVAL_KEY,
  ARRIVAL_MAX_AGE_MS,
  leaveArrival,
  restoredArrivalText,
  takeArrival,
} from "@/lib/arrival-handoff";

function memory() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe("arrival handoff", () => {
  it("is read once, by the page it names", () => {
    const s = memory();
    leaveArrival(s, "/app/albums/a1", "Restored “First pass”", 1000);
    expect(takeArrival(s, "/app/albums/a1", 1500)).toBe("Restored “First pass”");
    expect(takeArrival(s, "/app/albums/a1", 1600)).toBeNull();
    expect(s.map.size).toBe(0);
  });

  it("is left for its own page when another page looks", () => {
    const s = memory();
    leaveArrival(s, "/app/albums/a1", "Restored", 1000);
    expect(takeArrival(s, "/app/albums/a2", 1100)).toBeNull();
    expect(takeArrival(s, "/app/albums/a1", 1200)).toBe("Restored");
  });

  it("drops a stale or unreadable handoff", () => {
    const s = memory();
    leaveArrival(s, "/app/albums/a1", "Restored", 1000);
    expect(takeArrival(s, "/app/albums/a1", 1000 + ARRIVAL_MAX_AGE_MS + 1)).toBeNull();
    expect(s.map.size).toBe(0);
    leaveArrival(s, "/app/albums/a1", "Restored", 1000);
    expect(takeArrival(s, "/app/albums/a2", 1000 + ARRIVAL_MAX_AGE_MS + 1)).toBeNull();
    expect(s.map.size).toBe(0);
    s.map.set(ARRIVAL_KEY, "{not json");
    expect(takeArrival(s, "/app/albums/a1", 1000)).toBeNull();
    expect(s.map.size).toBe(0);
  });

  it("never throws when storage does", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => leaveArrival(broken, "/x", "t")).not.toThrow();
    expect(takeArrival(broken, "/x")).toBeNull();
    expect(takeArrival(null, "/x")).toBeNull();
  });
});

describe("restoredArrivalText", () => {
  it("names the version restored", () => {
    expect(restoredArrivalText("First pass")).toBe(
      "Restored “First pass” · the draft it replaced is saved in Version history.",
    );
    expect(restoredArrivalText(null)).toBe(
      "Restored an earlier version · the draft it replaced is saved in Version history.",
    );
    expect(restoredArrivalText("Before restoring 2026-09-01T10:00:00.000Z")).toBe(
      "Restored the draft an earlier restore kept · the draft it replaced is saved in Version history.",
    );
  });
});
