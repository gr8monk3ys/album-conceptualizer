"use client";

import { useCallback, useEffect, useReducer, useRef, type FocusEvent } from "react";

/**
 * The Studio's Undo offer waits for people (WCAG 2.2.1, "Timed things wait for people"): it
 * stays at least this long, its clock stops while the Undo group has keyboard focus or the
 * pointer over it, and a full window starts again once both have left.
 */
export const UNDO_WINDOW_MS = 10_000;

export type UndoWindowState = {
  /** The offer being timed (the undo entry's key), or null when nothing is offered. */
  key: number | null;
  /** When the offer lapses, or null while it is held (paused) or not offered. */
  deadline: number | null;
  focus: boolean;
  hover: boolean;
};

export type UndoWindowAction =
  | { type: "offer"; key: number; now: number; focusInside?: boolean; hoverInside?: boolean }
  | { type: "clear" }
  | { type: "focus" | "blur" | "enter" | "leave"; now: number };

export const IDLE_UNDO_WINDOW: UndoWindowState = { key: null, deadline: null, focus: false, hover: false };

export function undoWindowReducer(state: UndoWindowState, action: UndoWindowAction): UndoWindowState {
  switch (action.type) {
    case "offer": {
      // A new offer reads focus and hover from where they are now (the group may have just
      // appeared under the pointer); the Studio moves focus onto the new Undo right after.
      const focus = Boolean(action.focusInside);
      const hover = Boolean(action.hoverInside);
      return { key: action.key, focus, hover, deadline: focus || hover ? null : action.now + UNDO_WINDOW_MS };
    }
    case "clear":
      return IDLE_UNDO_WINDOW;
    case "focus":
    case "enter": {
      const next = { ...state, [action.type === "focus" ? "focus" : "hover"]: true };
      return { ...next, deadline: null };
    }
    case "blur":
    case "leave": {
      const next = { ...state, [action.type === "blur" ? "focus" : "hover"]: false };
      if (next.key == null) return { ...next, deadline: null };
      if (next.focus || next.hover) return { ...next, deadline: null };
      // Both gone: a whole new window, not what was left of the old one.
      return { ...next, deadline: state.deadline ?? action.now + UNDO_WINDOW_MS };
    }
  }
}

/** Milliseconds until the offer lapses, or null while it is held or nothing is offered. */
export function undoTimeLeft(state: UndoWindowState, now: number): number | null {
  if (state.key == null || state.deadline == null) return null;
  return Math.max(0, state.deadline - now);
}

function hasFocus(group: HTMLElement | null) {
  return Boolean(group && document.activeElement && group.contains(document.activeElement));
}

function hasHover(group: HTMLElement | null) {
  return Boolean(group?.matches(":hover"));
}

/**
 * Times one Undo offer (identified by `offerKey`, null when none). Spread `groupProps` on the
 * element that holds the Undo button and its sentence. When the window lapses, `onExpire` runs
 * with whether keyboard focus was inside the group at that moment, so the caller can move it to
 * the affected item and say that Undo is gone.
 */
export function useUndoWindow(offerKey: number | null, onExpire: (focusInside: boolean) => void) {
  const [state, dispatch] = useReducer(undoWindowReducer, IDLE_UNDO_WINDOW);
  const groupRef = useRef<HTMLElement | null>(null);
  const expireRef = useRef(onExpire);
  useEffect(() => {
    expireRef.current = onExpire;
  });

  // A new offer (or none) restarts the clock.
  useEffect(() => {
    if (offerKey == null) dispatch({ type: "clear" });
    else {
      const group = groupRef.current;
      dispatch({ type: "offer", key: offerKey, now: Date.now(), focusInside: hasFocus(group), hoverInside: hasHover(group) });
    }
  }, [offerKey]);

  useEffect(() => {
    const left = undoTimeLeft(state, Date.now());
    if (left == null || state.key !== offerKey) return;
    const timer = window.setTimeout(() => {
      const inside = hasFocus(groupRef.current);
      dispatch({ type: "clear" });
      expireRef.current(inside);
    }, left);
    return () => window.clearTimeout(timer);
  }, [state, offerKey]);

  const setGroup = useCallback((node: HTMLElement | null) => {
    groupRef.current = node;
  }, []);

  return {
    groupProps: {
      ref: setGroup,
      onFocus: () => dispatch({ type: "focus", now: Date.now() }),
      onBlur: (event: FocusEvent<HTMLElement>) => {
        // Focus moving between the group's own controls is still focus inside.
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
        dispatch({ type: "blur", now: Date.now() });
      },
      onMouseEnter: () => dispatch({ type: "enter", now: Date.now() }),
      onMouseLeave: () => dispatch({ type: "leave", now: Date.now() }),
    },
    /** For display or tests: whether the clock is stopped by focus or hover. */
    held: state.focus || state.hover,
  };
}
