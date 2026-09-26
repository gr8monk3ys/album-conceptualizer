"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * In one column (a phone, enlarged text) the Studio's track list folds into a disclosure, so
 * the current track's lyrics follow straight after it. Whether it is open is remembered for
 * the browser session (sessionStorage, guarded: private windows and blocked storage just start
 * closed), and shared by every Studio in the tab.
 */
const STORAGE_KEY = "studio-tracks-open";

const listeners = new Set<() => void>();
let memory: boolean | null = null;

function read(): boolean {
  if (memory !== null) return memory;
  try {
    memory = window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    memory = false;
  }
  return memory;
}

function write(open: boolean) {
  memory = open;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, open ? "1" : "0");
  } catch {
    // Storage unavailable: the choice lasts until the page is reloaded.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The disclosure's open state and its setter. Closed on the server and on first visit. */
export function useTracksOpen(): [boolean, (open: boolean) => void] {
  const open = useSyncExternalStore(subscribe, read, () => false);
  const setOpen = useCallback((next: boolean) => write(next), []);
  return [open, setOpen];
}

/** The toggle that folds and unfolds the list in one column. */
export const TRACKS_TOGGLE_ID = "studio-tracks-toggle";

/**
 * "Sequence · 04 of 10 · Track 4": the folded list's summary (where you are in the sequence).
 * "Sequence", as the album screens' spine and its disclosure say it (the One Term Rule).
 */
export function tracksSummary(current: { track_number: number; title?: string | null } | undefined, count: number) {
  if (!current || !count) return "Sequence";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `Sequence · ${pad(current.track_number)} of ${pad(count)} · ${current.title?.trim() || "Untitled"}`;
}
