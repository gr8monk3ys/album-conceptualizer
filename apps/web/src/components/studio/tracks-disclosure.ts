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

/** A no-break space: what holds a separator to the item before it, and a count together. */
const NBSP = " ";

/**
 * "Sequence · 04 of 10 · Track 4": the folded list's summary (where you are in the sequence).
 * "Sequence", as the album screens' spine and its disclosure say it (the One Term Rule).
 * Like every catalog line (CatalogItems), each separator ends the item before it: a no-break
 * space ties the dot to that item, so a line may end on a dot but never start with one (320px
 * with 200% text wraps it as "Sequence · / 02 of 09 · / Track 2"), and "04 of 10" stays whole.
 * A screen reader hears the no-break spaces as spaces.
 */
export function tracksSummary(current: { track_number: number; title?: string | null } | undefined, count: number) {
  const { where, title } = tracksSummaryParts(current, count);
  return title ? `${where}${title}` : where;
}

/**
 * The summary in its two parts: where you are ("Sequence · 04 of 10"), and the track's title
 * with the separator that joins it (" · Track 4", empty without a track). In a column under
 * 12rem (320px with 200% text) the toggle shows only the first: a long word in a title
 * ("Congregation") would have to break mid-word there, and the title heads the editor just
 * below it anyway.
 */
export function tracksSummaryParts(
  current: { track_number: number; title?: string | null } | undefined,
  count: number,
): { where: string; title: string } {
  if (!current || !count) return { where: "Sequence", title: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  const place = [pad(current.track_number), "of", pad(count)].join(NBSP);
  return { where: ["Sequence", place].join(`${NBSP}· `), title: `${NBSP}· ${current.title?.trim() || "Untitled"}` };
}
