// The Studio's keyboard shortcuts, decided in one pure function so the rules can be tested
// without a browser:
//
// - Ctrl/⌘+S saves now, from anywhere.
// - Alt+PageUp / Alt+PageDown move between tracks (with Shift: between sections), from
//   anywhere, including while writing in the lyrics field.
// - Alt+↑ / Alt+↓ do the same, but only outside text fields: on macOS Option+↑/↓ moves the
//   caret to the start or end of a paragraph, and a focused select keeps Alt+↓ for opening.
// - Ctrl+Alt+Shift+PageUp / PageDown move the selected track one place up or down in the
//   sequence, from anywhere; Ctrl+Alt+Shift+↑ / ↓ do the same outside text fields (the arrow
//   keys stay the caret's inside them). Ctrl+Alt+Shift is not a text-editing chord, and it
//   leaves Alt (step between tracks) and Alt+Shift (between sections) as they were.
// - Nothing fires while an IME is composing.

export type ShortcutEvent = {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  isComposing?: boolean;
  keyCode?: number;
};

/** The parts of the focused element the rules look at (an Element satisfies this). */
export type ShortcutTarget = {
  tagName?: string;
  type?: string;
  isContentEditable?: boolean;
} | null;

export type StudioShortcut =
  | { kind: "save" }
  | { kind: "step"; what: "track" | "section"; dir: -1 | 1 }
  /** Move the selected track one place in the sequence. */
  | { kind: "move"; dir: -1 | 1 }
  | null;

/** Input types where arrow keys move a caret or change a value. */
const TEXT_INPUT_TYPES = new Set([
  "",
  "text",
  "search",
  "url",
  "tel",
  "email",
  "password",
  "number",
  "date",
  "datetime-local",
  "month",
  "time",
  "week",
]);

/** True when arrow keys belong to the focused control: text fields, editable text, selects. */
export function ownsArrowKeys(target: ShortcutTarget): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = (target.tagName ?? "").toUpperCase();
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") return TEXT_INPUT_TYPES.has((target.type ?? "").toLowerCase());
  return false;
}

export function studioShortcut(event: ShortcutEvent, target: ShortcutTarget): StudioShortcut {
  if (event.isComposing || event.keyCode === 229) return null;

  if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "s") {
    return { kind: "save" };
  }

  if (event.ctrlKey && event.altKey && event.shiftKey && !event.metaKey) {
    if (event.key === "PageUp" || event.key === "PageDown") return { kind: "move", dir: event.key === "PageUp" ? -1 : 1 };
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      if (ownsArrowKeys(target)) return null;
      return { kind: "move", dir: event.key === "ArrowUp" ? -1 : 1 };
    }
    return null;
  }

  if (!event.altKey || event.ctrlKey || event.metaKey) return null;
  const what = event.shiftKey ? "section" : "track";

  if (event.key === "PageUp" || event.key === "PageDown") {
    return { kind: "step", what, dir: event.key === "PageUp" ? -1 : 1 };
  }
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    if (ownsArrowKeys(target)) return null;
    return { kind: "step", what, dir: event.key === "ArrowUp" ? -1 : 1 };
  }
  return null;
}

/** `aria-keyshortcuts` values for the rows the shortcuts move between. */
export const TRACK_KEYSHORTCUTS = "Alt+PageUp Alt+PageDown Alt+ArrowUp Alt+ArrowDown";
export const SECTION_KEYSHORTCUTS = "Alt+Shift+PageUp Alt+Shift+PageDown Alt+Shift+ArrowUp Alt+Shift+ArrowDown";

/** `aria-keyshortcuts` for "Move track up" / "Move track down". */
export const MOVE_TRACK_UP_KEYSHORTCUTS = "Control+Alt+Shift+PageUp Control+Alt+Shift+ArrowUp";
export const MOVE_TRACK_DOWN_KEYSHORTCUTS = "Control+Alt+Shift+PageDown Control+Alt+Shift+ArrowDown";
