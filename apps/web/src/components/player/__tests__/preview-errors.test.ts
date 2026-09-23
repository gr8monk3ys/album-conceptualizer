import { describe, expect, it } from "vitest";

import {
  PREVIEW_FAILED_MESSAGE,
  PreviewError,
  instrumentSwitchMessage,
  previewErrorMessage,
  previewFailureMessage,
} from "@/components/player/preview-errors";

describe("preview failures", () => {
  it("say what failed and what to do next", () => {
    expect(previewFailureMessage("instrument", "strings")).toContain("the strings sounds didn't load");
    expect(previewFailureMessage("instrument", "strings")).toContain("check your connection, then retry");
    expect(previewFailureMessage("audio")).toContain("audio player didn't load");
    expect(previewFailureMessage("offline")).toContain("server can't be reached");
    for (const failure of ["audio", "file", "instrument", "offline"] as const) {
      expect(previewFailureMessage(failure)).not.toMatch(/engine|midi|tone|soundfont/i);
      expect(previewFailureMessage(failure)).toMatch(/retry/i);
    }
  });

  it("carry their message through a PreviewError", () => {
    const err = new PreviewError("instrument", "pad");
    expect(err.failure).toBe("instrument");
    expect(previewErrorMessage(err)).toBe(previewFailureMessage("instrument", "pad"));
    expect(previewErrorMessage(new Error("AudioContext was not allowed to start"))).toBe(PREVIEW_FAILED_MESSAGE);
  });

  it("explain an instrument switch that kept the old one", () => {
    expect(instrumentSwitchMessage("strings", "piano")).toBe(
      "The strings sounds didn't load, so the preview stays on piano. Check your connection, then pick it again.",
    );
  });
});
