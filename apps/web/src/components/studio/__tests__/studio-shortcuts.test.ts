import { describe, expect, it } from "vitest";

import { ownsArrowKeys, studioShortcut, type ShortcutEvent } from "@/components/studio/studio-shortcuts";

const key = (k: string, mods: Partial<ShortcutEvent> = {}): ShortcutEvent => ({
  key: k,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...mods,
});

const textarea = { tagName: "TEXTAREA" };
const textInput = { tagName: "INPUT", type: "text" };
const numberInput = { tagName: "INPUT", type: "number" };
const checkbox = { tagName: "INPUT", type: "checkbox" };
const select = { tagName: "SELECT" };
const button = { tagName: "BUTTON" };
const editable = { tagName: "DIV", isContentEditable: true };

describe("ownsArrowKeys", () => {
  it("is true for text fields, editable text and selects", () => {
    for (const target of [textarea, textInput, numberInput, select, editable, { tagName: "input" }]) {
      expect(ownsArrowKeys(target)).toBe(true);
    }
  });

  it("is false for buttons, checkboxes and nothing", () => {
    expect(ownsArrowKeys(button)).toBe(false);
    expect(ownsArrowKeys(checkbox)).toBe(false);
    expect(ownsArrowKeys(null)).toBe(false);
  });
});

describe("studioShortcut", () => {
  it("saves on Ctrl+S and ⌘+S from anywhere, including the lyrics field", () => {
    expect(studioShortcut(key("s", { ctrlKey: true }), textarea)).toEqual({ kind: "save" });
    expect(studioShortcut(key("S", { metaKey: true, shiftKey: true }), button)).toEqual({ kind: "save" });
    expect(studioShortcut(key("s", { ctrlKey: true, altKey: true }), null)).toBeNull();
  });

  it("leaves Alt/Option+↑/↓ to text fields (macOS moves the caret by paragraph)", () => {
    expect(studioShortcut(key("ArrowUp", { altKey: true }), textarea)).toBeNull();
    expect(studioShortcut(key("ArrowDown", { altKey: true }), textInput)).toBeNull();
    expect(studioShortcut(key("ArrowDown", { altKey: true, shiftKey: true }), textarea)).toBeNull();
    expect(studioShortcut(key("ArrowDown", { altKey: true }), select)).toBeNull();
  });

  it("moves between tracks and sections with Alt+↑/↓ outside text fields", () => {
    expect(studioShortcut(key("ArrowDown", { altKey: true }), button)).toEqual({ kind: "step", what: "track", dir: 1 });
    expect(studioShortcut(key("ArrowUp", { altKey: true }), null)).toEqual({ kind: "step", what: "track", dir: -1 });
    expect(studioShortcut(key("ArrowUp", { altKey: true, shiftKey: true }), button)).toEqual({
      kind: "step",
      what: "section",
      dir: -1,
    });
  });

  it("moves with Alt+PageUp/PageDown everywhere, including while writing", () => {
    expect(studioShortcut(key("PageDown", { altKey: true }), textarea)).toEqual({ kind: "step", what: "track", dir: 1 });
    expect(studioShortcut(key("PageUp", { altKey: true }), textInput)).toEqual({ kind: "step", what: "track", dir: -1 });
    expect(studioShortcut(key("PageDown", { altKey: true, shiftKey: true }), textarea)).toEqual({
      kind: "step",
      what: "section",
      dir: 1,
    });
  });

  it("never takes plain arrows, PageUp/PageDown or Ctrl/⌘ combinations", () => {
    expect(studioShortcut(key("ArrowDown"), button)).toBeNull();
    expect(studioShortcut(key("PageDown"), textarea)).toBeNull();
    expect(studioShortcut(key("PageDown", { altKey: true, ctrlKey: true }), button)).toBeNull();
    expect(studioShortcut(key("ArrowUp", { altKey: true, metaKey: true }), button)).toBeNull();
  });

  it("does nothing while an IME is composing", () => {
    expect(studioShortcut(key("s", { ctrlKey: true, isComposing: true }), textarea)).toBeNull();
    expect(studioShortcut(key("PageDown", { altKey: true, keyCode: 229 }), textarea)).toBeNull();
  });
});
