import { beforeRestoringDate } from "@/lib/version-labels";

// The one line an arrival screen shows ("Restored “First pass” · …"), handed from the screen
// that navigates there through sessionStorage instead of a query parameter. A parameter had to
// be dropped from the address once shown, and dropping it made the router restore its tree a
// moment after the navigation, which the route announcer read as a second page change: the
// album was announced twice ("Salt Year", then "Salt Year · Album Conceptualizer"). A handoff
// is read once, by the page it names, within a short time, and removed as it is read, so a
// reload or a later visit never says it again.

export const ARRIVAL_KEY = "album-conceptualizer:arrival";
/** A handoff older than this is left from an arrival that never happened, and is dropped. */
export const ARRIVAL_MAX_AGE_MS = 30_000;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Handoff = { path: string; text: string; at: number };

function isHandoff(value: unknown): value is Handoff {
  const v = value as Partial<Handoff> | null;
  return (
    typeof v?.path === "string" &&
    typeof v.text === "string" &&
    typeof v.at === "number" &&
    Boolean(v.text)
  );
}

/** The tab's sessionStorage, or null where reading it throws (blocked site data, some previews). */
export function safeSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Leave the line for the page at `path` (a pathname, no query). Never throws. */
export function leaveArrival(
  storage: StorageLike | null | undefined,
  path: string,
  text: string,
  now = Date.now(),
) {
  try {
    storage?.setItem(ARRIVAL_KEY, JSON.stringify({ path, text, at: now } satisfies Handoff));
  } catch {
    // Storage can be unavailable (private windows, blocked site data): the arrival just says less.
  }
}

/**
 * The line left for the page at `path`, taken (removed) as it is read; null when there is none,
 * it is for another page, or it is stale. Never throws.
 */
export function takeArrival(
  storage: StorageLike | null | undefined,
  path: string,
  now = Date.now(),
): string | null {
  try {
    const raw = storage?.getItem(ARRIVAL_KEY);
    if (!raw) return null;
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    const fresh = isHandoff(parsed) && now - parsed.at >= 0 && now - parsed.at <= ARRIVAL_MAX_AGE_MS;
    if (isHandoff(parsed) && fresh && parsed.path !== path) return null; // someone else's, still on its way
    storage?.removeItem(ARRIVAL_KEY);
    return isHandoff(parsed) && fresh ? parsed.text : null;
  } catch {
    return null;
  }
}

/** How the Overview's arrival line names a restored version; a draft a restore kept is named as such. */
export function restoredArrivalText(message: string | null | undefined): string {
  const name = message?.trim();
  const what = !name
    ? "an earlier version"
    : beforeRestoringDate(name)
      ? "the draft an earlier restore kept"
      : `“${name}”`;
  return `Restored ${what} · the draft it replaced is saved in Version history.`;
}
