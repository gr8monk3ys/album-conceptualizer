import { describe, expect, it } from "vitest";

import { KEEPALIVE_BODY_LIMIT, keepaliveFits, versionSavedText } from "@/components/studio/studio-model";

describe("keepaliveFits", () => {
  it("sends an ordinary album save with keepalive, so a reload can't cancel it", () => {
    const body = JSON.stringify({ album: { title: "Lighthouse Keeper", songs: [{ title: "Track 1" }] } });
    expect(keepaliveFits(body)).toBe(true);
  });

  it("keeps a body the browser would refuse off keepalive", () => {
    expect(keepaliveFits("x".repeat(KEEPALIVE_BODY_LIMIT))).toBe(true);
    expect(keepaliveFits("x".repeat(KEEPALIVE_BODY_LIMIT + 1))).toBe(false);
  });

  it("counts UTF-8 bytes, not characters", () => {
    // "é" is two bytes: 40 of them are 80 bytes.
    expect(keepaliveFits("é".repeat(40), 79)).toBe(false);
    expect(keepaliveFits("é".repeat(40), 80)).toBe(true);
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
