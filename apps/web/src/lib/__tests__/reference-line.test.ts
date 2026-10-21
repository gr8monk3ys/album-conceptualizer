import { describe, expect, it } from "vitest";

import { REFERENCE_LINE_SEPARATOR, parseReferenceLine } from "@/lib/reference-line";

describe("parseReferenceLine", () => {
  it("reads the form the wizard's placeholder teaches", () => {
    expect(parseReferenceLine(`Blonde${REFERENCE_LINE_SEPARATOR}Frank Ocean`)).toEqual({
      title: "Blonde",
      artist: "Frank Ocean",
    });
    expect(parseReferenceLine("OK Computer — Radiohead")).toEqual({ title: "OK Computer", artist: "Radiohead" });
  });

  it("takes a spaced en dash or hyphen too", () => {
    expect(parseReferenceLine("Hey Jude - The Beatles")).toEqual({ title: "Hey Jude", artist: "The Beatles" });
    expect(parseReferenceLine("Pink Moon – Nick Drake")).toEqual({ title: "Pink Moon", artist: "Nick Drake" });
  });

  it("splits at the last dash, so a title's own dash stays in it", () => {
    expect(parseReferenceLine("Part 1 - Intro - Some Band")).toEqual({ title: "Part 1 - Intro", artist: "Some Band" });
  });

  it("never splits a hyphen inside a word", () => {
    expect(parseReferenceLine("Jay-Z")).toEqual({ title: "Jay-Z", artist: null });
    expect(parseReferenceLine("Twenty-One Pilots — Vessel")).toEqual({ title: "Twenty-One Pilots", artist: "Vessel" });
  });

  it("splits at the last comma when there is no dash", () => {
    expect(parseReferenceLine("Blonde, Frank Ocean")).toEqual({ title: "Blonde", artist: "Frank Ocean" });
    expect(parseReferenceLine("Hey, Soul Sister, Train")).toEqual({ title: "Hey, Soul Sister", artist: "Train" });
  });

  it("prefers a dash to a comma, so an artist's own comma stays whole", () => {
    expect(parseReferenceLine("September — Earth, Wind & Fire")).toEqual({
      title: "September",
      artist: "Earth, Wind & Fire",
    });
    expect(parseReferenceLine("Hey, Soul Sister - Train")).toEqual({ title: "Hey, Soul Sister", artist: "Train" });
  });

  it("splits at the last ' by ' only after two words or more", () => {
    expect(parseReferenceLine("Stand by Me by Ben E. King")).toEqual({ title: "Stand by Me", artist: "Ben E. King" });
    expect(parseReferenceLine("Nothing Compares 2 U BY Sinéad O'Connor")).toEqual({
      title: "Nothing Compares 2 U",
      artist: "Sinéad O'Connor",
    });
    expect(parseReferenceLine("Stand by Me")).toEqual({ title: "Stand by Me", artist: null });
    expect(parseReferenceLine("Blinded by the Light")).toEqual({ title: "Blinded by the Light", artist: null });
  });

  it("keeps a line without a separator whole, as the title", () => {
    expect(parseReferenceLine("  Kid   A ")).toEqual({ title: "Kid A", artist: null });
  });

  it("keeps the line whole when a separator leaves one side empty", () => {
    expect(parseReferenceLine("Blonde,")).toEqual({ title: "Blonde,", artist: null });
    expect(parseReferenceLine(", Frank Ocean")).toEqual({ title: ", Frank Ocean", artist: null });
    expect(parseReferenceLine("— Radiohead")).toEqual({ title: "— Radiohead", artist: null });
  });

  it("reads a blank line as nothing", () => {
    expect(parseReferenceLine("   ")).toBeNull();
    expect(parseReferenceLine("")).toBeNull();
  });
});
