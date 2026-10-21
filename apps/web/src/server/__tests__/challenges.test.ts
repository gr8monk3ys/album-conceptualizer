import { describe, expect, it } from "vitest";

import {
  CHALLENGE_PARAM,
  challengeByKey,
  challengeClaimReason,
  challengeStudioHref,
  getDailyChallenge,
} from "@/server/challenges";

describe("daily challenges", () => {
  it("titles every challenge in sentence case", () => {
    const keys = ["hook-in-10", "verse-twist", "bridge-lift", "tempo-lock", "theme-thread"];
    for (const key of keys) {
      const title = challengeByKey(key)?.title ?? "";
      // Only the first word is capitalised ("Hook in 10 minutes", never "Hook In 10 Minutes").
      expect(title.split(" ").slice(1).every((word) => word === word.toLowerCase())).toBe(true);
    }
    expect(challengeByKey("hook-in-10")?.title).toBe("Hook in 10 minutes");
  });

  it("finds a challenge by key, whatever the day, and nothing for an unknown key", () => {
    const { challenge } = getDailyChallenge("2026-09-26");
    expect(challengeByKey(challenge.key)).toBe(challenge);
    expect(challengeByKey("nope")).toBeNull();
    expect(challengeByKey(null)).toBeNull();
  });

  it("opens the chosen track at its lyrics with the prompt pinned", () => {
    expect(challengeStudioHref("a1", "verse-twist", 3)).toBe(
      `/app/albums/a1/studio?song=3&focus=lyrics&${CHALLENGE_PARAM}=verse-twist`,
    );
    // Without a track the Studio opens where it would, still with the prompt.
    expect(challengeStudioHref("a1", "verse-twist", null)).toBe(`/app/albums/a1/studio?${CHALLENGE_PARAM}=verse-twist`);
  });

  it("says why a claim didn't pay, for where it was made", () => {
    const target = { albumTitle: "Salt Year", trackNumber: 3 };
    expect(challengeClaimReason("unchanged", target, "studio")).toBe(
      "No credits yet: the lyrics on track 03 of Salt Year are the same as before today. Write something new, then claim again.",
    );
    expect(challengeClaimReason("no-lyrics", target, "page")).toBe(
      "No credits yet: track 03 of Salt Year has no written lyrics. Write them in the Studio, then check again.",
    );
    expect(challengeClaimReason("no-baseline", { albumTitle: "Salt Year", trackNumber: null }, "studio")).toMatch(
      /^No credits yet: Salt Year was already written in today before the challenge was opened/,
    );
    // No claim says "Note saved": a claim without a note saves none.
    for (const reason of ["no-lyrics", "not-saved-today", "no-baseline", "unchanged"] as const) {
      expect(challengeClaimReason(reason, target, "studio")).not.toMatch(/note/i);
    }
  });
});
