import { describe, expect, it } from "vitest";

import { beforeRestoringDate, beforeRestoringMessage } from "@/lib/version-labels";

const savedAt = new Date("2026-09-20T10:15:00.000Z");

describe("beforeRestoringMessage", () => {
  it("names the auto-snapshot after the version being restored", () => {
    expect(beforeRestoringMessage({ message: "Chorus rewrite", createdAt: savedAt })).toBe(
      "Before restoring Chorus rewrite",
    );
  });

  it("uses the save time for an unnamed version", () => {
    for (const message of [null, "", "   "]) {
      expect(beforeRestoringMessage({ message, createdAt: savedAt })).toBe(
        "Before restoring 2026-09-20T10:15:00.000Z",
      );
    }
  });

  it("never nests: restoring an auto-saved version names it by its save time", () => {
    for (const message of [
      "Before restoring Chorus rewrite",
      "Before restoring Before restoring Chorus rewrite",
      "Before restoring 2026-09-01T08:00:00.000Z",
    ]) {
      const next = beforeRestoringMessage({ message, createdAt: savedAt });
      expect(next).toBe("Before restoring 2026-09-20T10:15:00.000Z");
      expect(next.match(/Before restoring/g)).toHaveLength(1);
    }
  });

  it("stays within the version message limit", () => {
    const message = "x".repeat(200);
    expect(beforeRestoringMessage({ message, createdAt: savedAt })).toHaveLength(200);
  });
});

describe("beforeRestoringDate", () => {
  it("reads the date of a restore's auto-snapshot", () => {
    expect(beforeRestoringDate("Before restoring 2026-09-20T10:15:00.000Z")).toBe(
      "2026-09-20T10:15:00.000Z",
    );
  });

  it("ignores every other message", () => {
    for (const message of [null, undefined, "", "Chorus rewrite", "Before restoring Chorus rewrite"]) {
      expect(beforeRestoringDate(message)).toBeNull();
    }
  });
});
