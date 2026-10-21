import { describe, expect, it } from "vitest";

import { EMPTY_FORM, isBlankForm, parseCreateDraft } from "@/lib/create-draft";

describe("isBlankForm", () => {
  it("treats the fresh wizard and whitespace-only fields as blank", () => {
    expect(isBlankForm(EMPTY_FORM)).toBe(true);
    expect(isBlankForm({ ...EMPTY_FORM, title: "   " })).toBe(true);
    expect(isBlankForm({ ...EMPTY_FORM, title: "Coastline" })).toBe(false);
    expect(isBlankForm({ ...EMPTY_FORM, trackCount: 12 })).toBe(false);
    expect(isBlankForm({ ...EMPTY_FORM, narrativeStructure: "circular" })).toBe(false);
  });
});

describe("parseCreateDraft", () => {
  it("restores every step's fields and the step", () => {
    const form = { ...EMPTY_FORM, title: "Coastline", centralThemesRaw: "memory", trackCount: 7 };
    expect(parseCreateDraft({ form, step: 2, visited: 2 })).toEqual({ form, step: 2, visited: 2 });
  });

  it("falls back field by field and clamps numbers", () => {
    const draft = parseCreateDraft({
      form: { title: "Coastline", artist: 4, narrativeStructure: "spiral", trackCount: 99 },
      step: 7,
      visited: -1,
    });
    expect(draft?.form).toEqual({ ...EMPTY_FORM, title: "Coastline", trackCount: 20 });
    expect(draft?.step).toBe(2);
    expect(draft?.visited).toBe(2);
    expect(parseCreateDraft({ form: { title: "x", trackCount: 1 }, step: 1.5 })).toEqual({
      form: { ...EMPTY_FORM, title: "x", trackCount: 4 },
      step: 0,
      visited: 0,
    });
  });

  it("ignores broken, empty or blank drafts", () => {
    expect(parseCreateDraft(null)).toBeNull();
    expect(parseCreateDraft("text")).toBeNull();
    expect(parseCreateDraft([])).toBeNull();
    expect(parseCreateDraft({ form: "x" })).toBeNull();
    expect(parseCreateDraft({ form: EMPTY_FORM, step: 1 })).toBeNull();
  });
});
