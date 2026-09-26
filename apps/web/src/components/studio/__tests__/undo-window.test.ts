import { describe, expect, it } from "vitest";

import {
  IDLE_UNDO_WINDOW,
  UNDO_WINDOW_MS,
  undoTimeLeft,
  undoWindowReducer as reduce,
  type UndoWindowState,
} from "@/components/studio/undo-window";

const offered = (now = 0): UndoWindowState => reduce(IDLE_UNDO_WINDOW, { type: "offer", key: 1, now });

describe("Undo window", () => {
  it("offers Undo for the whole window", () => {
    const state = offered(1000);
    expect(undoTimeLeft(state, 1000)).toBe(UNDO_WINDOW_MS);
    expect(undoTimeLeft(state, 1000 + UNDO_WINDOW_MS - 1)).toBe(1);
    expect(undoTimeLeft(state, 1000 + UNDO_WINDOW_MS + 50)).toBe(0);
  });

  it("stops the clock while Undo has focus, and never runs out while it does", () => {
    const focused = reduce(offered(0), { type: "focus", now: 9000 });
    expect(undoTimeLeft(focused, 60_000)).toBeNull();
  });

  it("stops the clock while the pointer is over it", () => {
    const hovered = reduce(offered(0), { type: "enter", now: 9000 });
    expect(undoTimeLeft(hovered, 60_000)).toBeNull();
  });

  it("starts a whole new window once focus leaves, not what was left of the old one", () => {
    let state = reduce(offered(0), { type: "focus", now: 9500 });
    state = reduce(state, { type: "blur", now: 30_000 });
    expect(undoTimeLeft(state, 30_000)).toBe(UNDO_WINDOW_MS);
  });

  it("stays held until both focus and the pointer have left", () => {
    let state = reduce(offered(0), { type: "focus", now: 1000 });
    state = reduce(state, { type: "enter", now: 2000 });
    state = reduce(state, { type: "blur", now: 3000 });
    expect(undoTimeLeft(state, 50_000)).toBeNull();
    state = reduce(state, { type: "leave", now: 4000 });
    expect(undoTimeLeft(state, 4000)).toBe(UNDO_WINDOW_MS);
  });

  it("starts held when the new offer appears with focus or the pointer already on it", () => {
    expect(undoTimeLeft(reduce(IDLE_UNDO_WINDOW, { type: "offer", key: 2, now: 0, focusInside: true }), 0)).toBeNull();
    expect(undoTimeLeft(reduce(IDLE_UNDO_WINDOW, { type: "offer", key: 2, now: 0, hoverInside: true }), 0)).toBeNull();
  });

  it("restarts the window for a new offer", () => {
    const first = offered(0);
    const second = reduce(first, { type: "offer", key: 2, now: 8000 });
    expect(second.key).toBe(2);
    expect(undoTimeLeft(second, 8000)).toBe(UNDO_WINDOW_MS);
  });

  it("has nothing to time once cleared, and focus or blur alone offers nothing", () => {
    const cleared = reduce(offered(0), { type: "clear" });
    expect(undoTimeLeft(cleared, 0)).toBeNull();
    expect(undoTimeLeft(reduce(cleared, { type: "blur", now: 10 }), 10)).toBeNull();
    expect(undoTimeLeft(reduce(IDLE_UNDO_WINDOW, { type: "leave", now: 10 }), 10)).toBeNull();
  });
});
