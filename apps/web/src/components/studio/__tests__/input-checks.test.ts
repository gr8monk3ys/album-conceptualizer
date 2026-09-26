import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  chordProblem,
  joinWords,
  previewBlockedMessage,
  quoteTokens,
  readTempo,
  tempoClampedNote,
  tempoLimitMessage,
  unreadableChords,
} from "@/components/studio/input-checks";
import { ChordField, TempoField } from "@/components/studio/musical-fields";

describe("unreadableChords", () => {
  it("names the tokens the exports can't read, once each, in order", () => {
    expect(unreadableChords("Am banana F#m7 G/B xyz banana")).toEqual(["banana", "xyz"]);
    expect(unreadableChords("C, Am | F G")).toEqual([]);
  });

  it("waits for a chord-like last token while it's still being typed", () => {
    expect(unreadableChords("Am Cad", { typing: true })).toEqual([]);
    expect(unreadableChords("Am Cad ", { typing: true })).toEqual(["Cad"]);
    expect(unreadableChords("Am Cad")).toEqual(["Cad"]);
  });

  it("flags a last token that can't become a chord at once", () => {
    expect(unreadableChords("Am banana", { typing: true })).toEqual(["banana"]);
    expect(unreadableChords("Hm", { typing: true })).toEqual(["Hm"]);
  });
});

describe("chordProblem", () => {
  it("names one token and suggests readable chords", () => {
    expect(chordProblem(["banana"])).toBe("“banana” isn't a chord the exports can read — try Am, F#m7, G/B.");
  });

  it("pluralises and shortens long lists", () => {
    expect(chordProblem(["x", "y"])).toBe("“x” and “y” aren't chords the exports can read — try Am, F#m7, G/B.");
    expect(quoteTokens(["a", "b", "c", "d", "e"])).toBe("“a”, “b”, “c” and 2 more");
  });

  it("is null when everything reads", () => {
    expect(chordProblem([])).toBeNull();
  });
});

describe("previewBlockedMessage", () => {
  it("says what stops the preview and where to fix it", () => {
    expect(previewBlockedMessage(["banana"])).toBe(
      "“banana” isn't a chord the exports can read, so this can't be previewed yet. Fix it in Chord progression.",
    );
    expect(previewBlockedMessage(["x", "y"], ["Verse 1", "Chorus 1"])).toBe(
      "“x” and “y” aren't chords the exports can read, so this can't be previewed yet. Fix them in Verse 1 and Chorus 1.",
    );
  });

  it("joins words like a sentence", () => {
    expect(joinWords(["Verse 1", "Chorus 1", "Bridge 1"])).toBe("Verse 1, Chorus 1 and Bridge 1");
  });
});

describe("readTempo", () => {
  it("reads, rounds and clamps, saying which way", () => {
    expect(readTempo(" 96 ")).toEqual({ tempo: 96, clamped: null, unreadable: false });
    expect(readTempo("119.6")).toEqual({ tempo: 120, clamped: null, unreadable: false });
    expect(readTempo("350")).toEqual({ tempo: 300, clamped: "high", unreadable: false });
    expect(readTempo("5")).toEqual({ tempo: 20, clamped: "low", unreadable: false });
  });

  it("treats empty as unset and nonsense as unreadable", () => {
    expect(readTempo("")).toEqual({ tempo: null, clamped: null, unreadable: false });
    expect(readTempo("fast")).toEqual({ tempo: null, clamped: null, unreadable: true });
  });

  it("states the limit, and the change once it's made", () => {
    expect(tempoLimitMessage("high")).toBe("Tempo is capped at 300 bpm.");
    expect(tempoLimitMessage("low")).toBe("Tempo can't go below 20 bpm.");
    expect(tempoClampedNote("high")).toBe("Tempo is capped at 300 bpm, so this track is set to 300.");
    expect(tempoClampedNote("low")).toBe("Tempo can't go below 20 bpm, so this track is set to 20.");
  });
});

describe("ChordField", () => {
  it("keeps what was typed and flags the unreadable token inline, tied to the field", () => {
    const html = renderToStaticMarkup(
      h(ChordField, { id: "section-chords", value: ["Am", "banana", "G/B"], onChange: () => {} }),
    );
    expect(html).toContain('value="Am banana G/B"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="section-chords-error"');
    expect(html).toContain("isn&#x27;t a chord the exports can read");
    expect(html).toContain("“banana”");
  });

  it("shows the hint and no error for readable chords", () => {
    const html = renderToStaticMarkup(h(ChordField, { id: "section-chords", value: ["C", "Am"], onChange: () => {} }));
    expect(html).not.toContain("aria-invalid");
    expect(html).toContain('aria-describedby="section-chords-hint"');
  });
});

describe("TempoField", () => {
  it("names the cap for an out-of-range stored tempo", () => {
    const html = renderToStaticMarkup(h(TempoField, { id: "song-tempo", value: 400, onChange: () => {} }));
    expect(html).toContain("Tempo is capped at 300 bpm.");
    expect(html).toContain('aria-invalid="true"');
  });

  it("is quiet for a tempo in range", () => {
    const html = renderToStaticMarkup(h(TempoField, { id: "song-tempo", value: 96, onChange: () => {} }));
    expect(html).not.toContain("aria-invalid");
    expect(html).toContain('value="96"');
  });
});
