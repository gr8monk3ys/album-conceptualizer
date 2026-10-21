import { describe, expect, it } from "vitest";

import { claimOutcome } from "@/components/studio/challenge-band";
import { suggestedTrack } from "@/components/daily-challenge-card";

describe("claimOutcome", () => {
  it("is done, with the credits named, when the claim paid", () => {
    expect(claimOutcome(true, { credited: true }, 10)).toEqual({
      phase: "done",
      status: { tone: "ok", text: "Done for today: 10 credits added to your workspace." },
    });
  });

  it("keeps the claim open and says the server's reason when it didn't pay yet", () => {
    const reason = "No credits yet: track 01 of Salt Year has no written lyrics. Write them, then claim again.";
    expect(claimOutcome(true, { credited: false, reason }, 10)).toEqual({
      phase: null,
      status: { tone: "neutral", text: reason },
    });
  });

  it("reads a claim already made elsewhere today as done, not as an error", () => {
    expect(claimOutcome(false, { error: "Already completed today." }, 10).phase).toBe("done");
  });

  it("reads another day's challenge as ended, with the band's own line", () => {
    expect(claimOutcome(false, { error: "That challenge is not active today." }, 10)).toEqual({ phase: "ended", status: null });
  });

  it("says any other failure plainly, keeping the claim", () => {
    expect(claimOutcome(false, null, 10)).toEqual({
      phase: null,
      status: { tone: "danger", text: "The claim didn't go through. Try again in a moment." },
    });
  });
});

describe("suggestedTrack", () => {
  it("suggests the first track with no lyrics yet, else the first", () => {
    const album = (written: boolean[]) => ({
      id: "a",
      title: "A",
      tracks: written.map((w, i) => ({ number: i + 1, title: `T${i + 1}`, written: w })),
    });
    expect(suggestedTrack(album([true, false, false]))).toBe(2);
    expect(suggestedTrack(album([true, true]))).toBe(1);
    expect(suggestedTrack(album([]))).toBeNull();
    expect(suggestedTrack(null)).toBeNull();
  });
});
