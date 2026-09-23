"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// Nothing an artist types should be lost to a slow request, a stray click on a tab or a
// closed tab. This module holds the three pieces that make that true on the Sound pages:
//
// - AutosaveController / useAutosave: debounced saving with one request in flight at a time
//   (the latest value is queued behind it), Cmd/Ctrl+S to save now, and a flush on unmount.
// - useLeaveGuard: while something is unsaved, same-origin link clicks save first and then
//   navigate; if saving fails the page asks before leaving. Closing the tab asks natively.
// - useDraftState: a form value mirrored into sessionStorage per key, restored on return.

export type AutosaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export type AutosaveState = {
  status: AutosaveStatus;
  /** Epoch milliseconds of the last successful save in this visit, or null. */
  lastSavedAt: number | null;
  /** A human-written reason the last save failed, or null. */
  error: string | null;
};

type ControllerOptions<T> = {
  /** The value already saved on the server when the page loaded. */
  initial: T;
  /** Persist a value. Throw an Error with a plain-words message when it fails. */
  save: (value: T) => Promise<void>;
  delayMs: number;
  /** How two values are compared. Defaults to JSON.stringify. */
  serialize?: (value: T) => string;
  now?: () => number;
};

const FALLBACK_ERROR = "Check your connection. Your text is still here.";

/**
 * The framework-free core of autosave, so the timing rules can be tested without React.
 * Call `update` with every new value; the controller decides when to save.
 */
export class AutosaveController<T> {
  private state: AutosaveState = { status: "idle", lastSavedAt: null, error: null };
  private readonly listeners = new Set<() => void>();
  private saveValue: (value: T) => Promise<void>;
  private readonly serialize: (value: T) => string;
  private readonly now: () => number;
  private readonly delayMs: number;
  private value: T;
  private key: string;
  private savedKey: string;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<boolean> | null = null;
  private queued: Promise<boolean> | null = null;

  constructor(options: ControllerOptions<T>) {
    this.saveValue = options.save;
    this.serialize = options.serialize ?? ((value) => JSON.stringify(value));
    this.now = options.now ?? Date.now;
    this.delayMs = options.delayMs;
    this.value = options.initial;
    this.key = this.serialize(options.initial);
    this.savedKey = this.key;
  }

  getState = (): AutosaveState => this.state;

  /** Swap the save function (a component's closure changes between renders). */
  setSave = (save: (value: T) => Promise<void>) => {
    this.saveValue = save;
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** True while a change is waiting, saving, or failed to save. */
  hasUnsavedChanges = () => this.key !== this.savedKey || this.inFlight !== null;

  update = (value: T) => {
    const key = this.serialize(value);
    this.value = value;
    if (key === this.key) return;
    this.key = key;
    // A save is running: it picks up the latest value when it finishes.
    if (this.inFlight) return;
    this.clearTimer();
    if (key === this.savedKey) {
      this.set({ status: this.state.lastSavedAt ? "saved" : "idle", error: null });
      return;
    }
    this.set({ status: "dirty", error: null });
    this.schedule();
  };

  /** Save the latest value now. Resolves true once it is saved (or nothing needed saving). */
  saveNow = (): Promise<boolean> => {
    this.clearTimer();
    if (this.inFlight) {
      this.queued ??= this.inFlight.then(() => {
        this.queued = null;
        return this.saveNow();
      });
      return this.queued;
    }
    if (this.key === this.savedKey) return Promise.resolve(true);
    return this.run();
  };

  /** Try again after a failure. The same as saving now. */
  retry = () => this.saveNow();

  /** Send anything pending right away, without waiting on the debounce (unmount, unload). */
  flush = () => {
    this.clearTimer();
    if (!this.inFlight && this.key !== this.savedKey) void this.run();
  };

  private schedule() {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.saveNow();
    }, this.delayMs);
  }

  private clearTimer() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private run(): Promise<boolean> {
    const key = this.key;
    const value = this.value;
    this.set({ status: "saving", error: null });
    const attempt = Promise.resolve()
      .then(() => this.saveValue(value))
      .then(
        () => ({ ok: true as const }),
        (error: unknown) => ({
          ok: false as const,
          message: error instanceof Error && error.message ? error.message : FALLBACK_ERROR,
        }),
      );
    this.inFlight = attempt.then((result) => {
      this.inFlight = null;
      if (!result.ok) {
        this.set({ status: "error", error: result.message });
        return false;
      }
      this.savedKey = key;
      const lastSavedAt = this.now();
      if (this.key !== this.savedKey) {
        // New edits arrived while saving: save them too, unless a save-now is already queued.
        this.set({ status: "dirty", lastSavedAt, error: null });
        if (!this.queued) this.schedule();
      } else {
        this.set({ status: "saved", lastSavedAt, error: null });
      }
      return true;
    });
    return this.inFlight;
  }

  private set(patch: Partial<AutosaveState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
}

/** A click on a link, reduced to what decides whether leaving should be guarded. */
export type LinkClick = {
  href: string;
  target: string;
  download: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
};

/**
 * Where a link click would take the viewer inside the app, or null when the click should be
 * left alone: new-tab and download clicks, other sites (the browser asks for those), and
 * links to a spot on the same page.
 */
export function guardedDestination(click: LinkClick, currentHref: string): string | null {
  if (click.defaultPrevented || click.button !== 0) return null;
  if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return null;
  if (click.download) return null;
  if (click.target && click.target !== "_self") return null;
  let url: URL;
  let here: URL;
  try {
    here = new URL(currentHref);
    url = new URL(click.href, here);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.origin !== here.origin) return null;
  if (url.pathname === here.pathname && url.search === here.search) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

export type LeaveGuard = {
  /** Where the viewer tried to go when saving failed; the page shows a confirm while set. */
  pendingHref: string | null;
  leaveAnyway: () => void;
  stay: () => void;
};

/**
 * While `when` is true: closing or reloading the tab asks first, and clicks on same-origin
 * links call `beforeLeave` (save, or keep a draft) before navigating. When it returns false
 * the navigation waits on `pendingHref` for the viewer to choose.
 */
export function useLeaveGuard({
  when,
  beforeLeave,
  onUnload,
}: {
  when: boolean;
  beforeLeave: () => Promise<boolean> | boolean;
  onUnload?: () => void;
}): LeaveGuard {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const latest = useRef({ beforeLeave, onUnload });
  const leaving = useRef(false);

  useEffect(() => {
    latest.current = { beforeLeave, onUnload };
  });

  useEffect(() => {
    if (!when) return;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      latest.current.onUnload?.();
      event.preventDefault();
      // Older browsers need returnValue set to show their prompt.
      event.returnValue = "";
    }

    function onClick(event: MouseEvent) {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const destination = guardedDestination(
        {
          href: anchor.href,
          target: anchor.target,
          download: anchor.hasAttribute("download"),
          button: event.button,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          defaultPrevented: event.defaultPrevented,
        },
        window.location.href,
      );
      if (!destination) return;
      // Capture phase on the document: the link's own handler never runs, we navigate.
      event.preventDefault();
      event.stopPropagation();
      if (leaving.current) return;
      leaving.current = true;
      void Promise.resolve()
        .then(() => latest.current.beforeLeave())
        .catch(() => false)
        .then((ok) => {
          leaving.current = false;
          if (ok) router.push(destination);
          else setPendingHref(destination);
        });
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [when, router]);

  return {
    pendingHref,
    leaveAnyway: () => {
      const href = pendingHref;
      setPendingHref(null);
      if (href) router.push(href);
    },
    stay: () => setPendingHref(null),
  };
}

/**
 * Autosave a value: `delayMs` after the last change, on Cmd/Ctrl+S, before in-app
 * navigation, and on unmount. The value the component starts with counts as saved.
 */
export function useAutosave<T>({
  value,
  save,
  delayMs = 2000,
  serialize,
}: {
  value: T;
  save: (value: T) => Promise<void>;
  delayMs?: number;
  serialize?: (value: T) => string;
}) {
  const [controller] = useState(
    () => new AutosaveController<T>({ initial: value, save, delayMs, serialize }),
  );

  useEffect(() => {
    controller.setSave(save);
  }, [controller, save]);
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);

  useEffect(() => {
    controller.update(value);
  }, [controller, value]);

  // Leaving the page by any route still sends the last edits.
  useEffect(() => () => controller.flush(), [controller]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      void controller.saveNow();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [controller]);

  const unsaved = state.status === "dirty" || state.status === "saving" || state.status === "error";
  const leaveGuard = useLeaveGuard({
    when: unsaved,
    beforeLeave: controller.saveNow,
    onUnload: controller.flush,
  });

  return {
    status: state.status,
    lastSavedAt: state.lastSavedAt,
    error: state.error,
    saveNow: controller.saveNow,
    retry: controller.retry,
    leaveGuard,
  };
}

// ---------------------------------------------------------------------------------------
// Session drafts

export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function sessionStore(): DraftStorage | null {
  try {
    return window.sessionStorage;
  } catch {
    // No window (server), or storage blocked by the browser.
    return null;
  }
}

/** The parsed draft under `key`, or null when there is none or storage is unavailable. */
export function readDraft(key: string, storage: DraftStorage | null = sessionStore()): unknown {
  try {
    const raw = storage?.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

/** Keep a draft. Returns false when it could not be kept (storage full or blocked). */
export function writeDraft(
  key: string,
  value: unknown,
  storage: DraftStorage | null = sessionStore(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(key: string, storage: DraftStorage | null = sessionStore()) {
  try {
    storage?.removeItem(key);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

/** Keep only the string fields a form knows about, so an old or tampered draft can't break it. */
export function mergeStringFields<T extends Record<string, unknown>>(base: T, raw: unknown): T {
  if (!raw || typeof raw !== "object") return base;
  const next: Record<string, unknown> = { ...base };
  for (const key of Object.keys(base)) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof base[key] === "string" && typeof value === "string") next[key] = value;
  }
  return next as T;
}

const subscribeNever = () => () => {};

/**
 * Form state mirrored into sessionStorage under `key` while it differs from a blank form,
 * and restored when the viewer comes back in the same tab. Restoring happens after
 * hydration, so the server and first client render agree.
 */
export function useDraftState<T>(
  key: string,
  {
    initial,
    parse,
    isPristine,
  }: {
    initial: () => T;
    parse: (raw: unknown) => T | null;
    isPristine: (value: T) => boolean;
  },
) {
  const isClient = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const [value, setValue] = useState<T>(initial);
  const [phase, setPhase] = useState<"pending" | "fresh" | "restored">("pending");

  if (isClient && phase === "pending") {
    const draft = parse(readDraft(key));
    if (draft !== null && !isPristine(draft)) {
      setValue(draft);
      setPhase("restored");
    } else {
      setPhase("fresh");
    }
  }

  const pristine = isPristine(value);

  useEffect(() => {
    if (phase === "pending") return;
    if (pristine) clearDraft(key);
    else writeDraft(key, value);
  }, [key, value, pristine, phase]);

  return {
    value,
    setValue,
    pristine,
    /** True when the current value came back from an earlier visit. */
    restored: phase === "restored",
    /** Write the draft now; true when it is kept (or there is nothing to keep). */
    persist: () => pristine || writeDraft(key, value),
    /** Back to a blank form, and forget the stored draft. */
    reset: () => {
      clearDraft(key);
      setValue(initial());
      setPhase("fresh");
    },
  };
}
