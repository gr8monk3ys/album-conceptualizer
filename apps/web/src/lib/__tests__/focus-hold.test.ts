import { describe, expect, it } from "vitest";

import { FOCUS_HOLD_MS, focusIsLost, holdFocus, type Focusable, type FocusHoldEnv } from "@/lib/focus-hold";

type El = Focusable & { name: string; isConnected: boolean };

function setup() {
  const body = { name: "body" };
  let active: unknown = body;
  let time = 0;
  let frames: Array<() => void> = [];
  let pointer: (() => void) | null = null;
  const env: FocusHoldEnv = {
    activeElement: () => active,
    body: () => body,
    now: () => time,
    frame: (callback) => {
      frames.push(callback);
      return frames.length;
    },
    cancelFrame: () => {
      frames = [];
    },
    onPointerDown: (callback) => {
      pointer = callback;
      return () => {
        pointer = null;
      };
    },
  };
  const element = (name: string): El => {
    const el: El = { name, isConnected: true, focus: () => (active = el) };
    return el;
  };
  const runFrame = (advance = 16) => {
    time += advance;
    const due = frames;
    frames = [];
    for (const callback of due) callback();
  };
  return {
    env,
    body,
    element,
    runFrame,
    get active() {
      return active;
    },
    set active(value: unknown) {
      active = value;
    },
    press: () => pointer?.(),
    pending: () => frames.length,
  };
}

describe("focusIsLost", () => {
  it("is lost on the body, on nothing, or on a removed element", () => {
    const body = {};
    expect(focusIsLost(body, body)).toBe(true);
    expect(focusIsLost(null, body)).toBe(true);
    expect(focusIsLost({ isConnected: false }, body)).toBe(true);
    expect(focusIsLost({ isConnected: true }, body)).toBe(false);
  });
});

describe("holdFocus", () => {
  it("focuses the target at once when focus was dropped to the body", () => {
    const t = setup();
    const trigger = t.element("trigger");
    holdFocus(() => trigger, t.env);
    expect(t.active).toBe(trigger);
  });

  it("never takes focus from something the person moved to", () => {
    const t = setup();
    const elsewhere = t.element("elsewhere");
    t.active = elsewhere;
    holdFocus(() => t.element("trigger"), t.env);
    expect(t.active).toBe(elsewhere);
  });

  it("finds the replacement when a refresh swaps the element a frame later", () => {
    const t = setup();
    let current = t.element("trigger");
    holdFocus(() => current, t.env);
    // The refresh replaces the trigger: the old one leaves the page and focus drops.
    current.isConnected = false;
    current = t.element("new trigger");
    t.active = t.body;
    t.runFrame();
    expect(t.active).toBe(current);
  });

  it("stops after the hold, or as soon as the person presses a pointer", () => {
    const t = setup();
    const trigger = t.element("trigger");
    holdFocus(() => trigger, t.env);
    t.runFrame(FOCUS_HOLD_MS + 1);
    t.active = t.body;
    t.runFrame();
    expect(t.active).toBe(t.body);
    expect(t.pending()).toBe(0);

    const u = setup();
    const other = u.element("trigger");
    holdFocus(() => other, u.env);
    u.press();
    u.active = u.body;
    u.runFrame();
    expect(u.active).toBe(u.body);
  });

  it("returns a stop function", () => {
    const t = setup();
    const trigger = t.element("trigger");
    const stop = holdFocus(() => trigger, t.env);
    stop();
    t.active = t.body;
    t.runFrame();
    expect(t.active).toBe(t.body);
  });
});
