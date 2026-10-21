import { describe, expect, it } from "vitest";

import { handoffDownloaded, zipContents, zipNextStep, type ExportFormat } from "@/components/album-export";

describe("export confirmations end on the next step", () => {
  it("says what to do with a handoff brief", () => {
    expect(
      handoffDownloaded({ title: "Suno brief", next: "paste each track's prompt line into Suno, one track at a time" }),
    ).toBe("Suno brief downloaded — paste each track's prompt line into Suno, one track at a time.");
  });

  it("leads the zip's next step with the DAW when it holds MIDI", () => {
    expect(zipNextStep(new Set<ExportFormat>(["json", "midi"]))).toMatch(/^open the MIDI files in your DAW/);
  });
});

describe("zipContents", () => {
  it("names what the zip holds, above its button", () => {
    expect(zipContents(new Set<ExportFormat>(["midi", "chordpro", "json"]), true)).toBe(
      "The zip holds MIDI, ChordPro, and JSON, with your production notes.",
    );
    expect(zipContents(new Set<ExportFormat>(["json"]), false)).toBe("The zip holds JSON.");
    expect(zipContents(new Set<ExportFormat>(["midi", "chordpro", "musicxml", "json", "text"]), false)).toBe(
      "The zip holds every format.",
    );
  });

  it("says what to do when nothing is picked", () => {
    expect(zipContents(new Set<ExportFormat>(), true)).toBe("Pick at least one format below to build a zip.");
  });
});
