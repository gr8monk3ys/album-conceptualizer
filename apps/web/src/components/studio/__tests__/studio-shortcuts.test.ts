import { describe, expect, it } from "vitest";

import { STUDIO_SHORTCUT_HINTS } from "@/components/studio/shortcuts-disclosure";
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

  it("moves the selected track with Ctrl+Alt+Shift, never taking a text field's arrows", () => {
    const mods = { ctrlKey: true, altKey: true, shiftKey: true };
    expect(studioShortcut(key("PageUp", mods), textarea)).toEqual({ kind: "move", dir: -1 });
    expect(studioShortcut(key("PageDown", mods), textInput)).toEqual({ kind: "move", dir: 1 });
    expect(studioShortcut(key("ArrowUp", mods), button)).toEqual({ kind: "move", dir: -1 });
    expect(studioShortcut(key("ArrowDown", mods), null)).toEqual({ kind: "move", dir: 1 });
    expect(studioShortcut(key("ArrowDown", mods), textarea)).toBeNull();
    expect(studioShortcut(key("ArrowUp", mods), select)).toBeNull();
    // Not with ⌘, and not without all three.
    expect(studioShortcut(key("ArrowDown", { ...mods, metaKey: true }), button)).toBeNull();
    expect(studioShortcut(key("ArrowDown", { ctrlKey: true, shiftKey: true }), button)).toBeNull();
    expect(studioShortcut(key("s", mods), textarea)).toBeNull();
  });

  it("does nothing while an IME is composing", () => {
    expect(studioShortcut(key("s", { ctrlKey: true, isComposing: true }), textarea)).toBeNull();
    expect(studioShortcut(key("PageDown", { altKey: true, keyCode: 229 }), textarea)).toBeNull();
    expect(
      studioShortcut(key("PageDown", { ctrlKey: true, altKey: true, shiftKey: true, isComposing: true }), textarea),
    ).toBeNull();
  });
});

describe("the save bar's Shortcuts list", () => {
  // Each listed chord, pressed from the lyrics field, does what the list says it does.
  const expected: Record<string, [ShortcutEvent, ReturnType<typeof studioShortcut>][]> = {
    "Save now": [
      [key("s", { ctrlKey: true }), { kind: "save" }],
      [key("s", { metaKey: true }), { kind: "save" }],
    ],
    "Previous or next track": [
      [key("PageUp", { altKey: true }), { kind: "step", what: "track", dir: -1 }],
      [key("PageDown", { altKey: true }), { kind: "step", what: "track", dir: 1 }],
    ],
    "Previous or next section": [
      [key("PageUp", { altKey: true, shiftKey: true }), { kind: "step", what: "section", dir: -1 }],
      [key("PageDown", { altKey: true, shiftKey: true }), { kind: "step", what: "section", dir: 1 }],
    ],
    "Move the track up or down one place": [
      [key("PageUp", { ctrlKey: true, altKey: true, shiftKey: true }), { kind: "move", dir: -1 }],
      [key("PageDown", { ctrlKey: true, altKey: true, shiftKey: true }), { kind: "move", dir: 1 }],
    ],
  };

  it("lists every chord the Studio answers, and each does what it says", () => {
    expect(STUDIO_SHORTCUT_HINTS.map((hint) => hint.does)).toEqual(Object.keys(expected));
    for (const cases of Object.values(expected)) {
      for (const [event, shortcut] of cases) expect(studioShortcut(event, textarea)).toEqual(shortcut);
    }
  });

  it("says ↑ and ↓ stand in for PgUp and PgDn only outside text fields", () => {
    expect(studioShortcut(key("ArrowUp", { altKey: true }), button)).toEqual({ kind: "step", what: "track", dir: -1 });
    expect(studioShortcut(key("ArrowUp", { altKey: true }), textarea)).toBeNull();
    expect(studioShortcut(key("ArrowDown", { ctrlKey: true, altKey: true, shiftKey: true }), button)).toEqual({ kind: "move", dir: 1 });
  });
});
