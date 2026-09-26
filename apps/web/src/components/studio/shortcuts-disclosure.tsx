"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ChevronDown, Keyboard } from "lucide-react";

import { menuLeftOffset } from "@/components/studio/menu-position";
import { buttonClass } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * The Studio's keyboard shortcuts, as the save bar lists them: the keys (shown, hidden from
 * assistive technology), what they do, and the keys spoken in words. Help has the full table.
 */
export const STUDIO_SHORTCUT_HINTS: ReadonlyArray<{ keys: string[]; does: string; spoken: string }> = [
  { keys: ["Ctrl/⌘", "S"], does: "Save now", spoken: "Control plus S, or Command plus S" },
  { keys: ["Alt", "PgUp/PgDn"], does: "Previous or next track", spoken: "Alt plus Page Up or Page Down" },
  {
    keys: ["Alt", "Shift", "PgUp/PgDn"],
    does: "Previous or next section",
    spoken: "Alt plus Shift plus Page Up or Page Down",
  },
  {
    keys: ["Ctrl", "Alt", "Shift", "PgUp/PgDn"],
    does: "Move the track up or down one place",
    spoken: "Control plus Alt plus Shift plus Page Up or Page Down",
  },
];

/** The "Shortcuts" button's id. */
export const SHORTCUTS_TOGGLE_ID = "studio-shortcuts-toggle";

function Kbd({ children }: { children: string }) {
  return <kbd className="type-figure rounded-sm border border-line px-1 font-sans text-xs text-ink-2">{children}</kbd>;
}

/**
 * One quiet "Shortcuts" button in the save bar in place of a standing legend of keys: a
 * disclosure (`aria-expanded`, `aria-controls`) that opens a small list under it, laid over
 * the page (it takes no room in the bar, so the bar never reflows), kept inside the viewport
 * like the More menu. Escape closes it and returns focus to the button; a press outside, or
 * focus leaving it, closes it. The list ends on Help's full table.
 *
 * `concealed`: an Undo or Retry is laid over this part of the bar. The button hides but keeps
 * its place, an open list closes, and focus inside it goes to `concealedFocusId` (the offer's
 * own button), never to nothing.
 */
export function ShortcutsDisclosure({
  className,
  concealed = false,
  concealedFocusId,
}: {
  className?: string;
  concealed?: boolean;
  concealedFocusId?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = `${useId()}-shortcuts`;

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  // Hangs from the button's right edge, clamped inside the viewport (menu-position.ts).
  const place = useCallback(() => {
    const wrapper = wrapperRef.current;
    const button = buttonRef.current;
    const panel = panelRef.current;
    if (!wrapper || !button || !panel) return;
    panel.style.left = `${menuLeftOffset({
      triggerRight: button.getBoundingClientRect().right,
      wrapperLeft: wrapper.getBoundingClientRect().left,
      menuWidth: panel.offsetWidth,
      viewportWidth: document.documentElement.clientWidth,
    })}px`;
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  // An offer laid over the bar hides the button: the list closes (adjusted while rendering, as
  // React advises for state that follows a prop), and focus inside goes to the offer's button.
  const [wasConcealed, setWasConcealed] = useState(concealed);
  if (concealed !== wasConcealed) {
    setWasConcealed(concealed);
    if (concealed) setOpen(false);
  }
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!concealed || !concealedFocusId || !wrapper?.contains(document.activeElement)) return;
    document.getElementById(concealedFocusId)?.focus();
  }, [concealed, concealedFocusId]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    }
  }

  return (
    <div
      ref={wrapperRef}
      className={cn("relative", concealed && "invisible", className)}
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        // Focus moved somewhere outside (Tab past the Help link): the list closes behind it.
        const next = event.relatedTarget;
        if (open && next instanceof Node && !wrapperRef.current?.contains(next)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        id={SHORTCUTS_TOGGLE_ID}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((was) => !was)}
        className={buttonClass("ghost", "px-2 font-medium text-ink-3 hover:text-ink")}
      >
        <Keyboard className="h-4 w-4 flex-none" aria-hidden="true" />
        Shortcuts
        <ChevronDown
          className={cn("h-3.5 w-3.5 flex-none transition-transform motion-reduce:transition-none", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      <div
        ref={panelRef}
        id={panelId}
        role="group"
        aria-label="Keyboard shortcuts"
        hidden={!open}
        className="absolute left-0 top-full z-30 mt-1 w-max max-w-[min(26rem,calc(100vw-1rem))] rounded border border-line-strong bg-raised p-3"
      >
        {/* Keys in one column and what they do in the next (each row a subgrid of the list). */}
        <ul className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2 text-sm">
          {STUDIO_SHORTCUT_HINTS.map((hint) => (
            <li key={hint.does} className="col-span-2 grid grid-cols-subgrid items-baseline">
              <span aria-hidden="true" className="inline-flex flex-wrap items-baseline gap-1">
                {hint.keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </span>
              <span className="sr-only">{hint.spoken}: </span>
              <span className="min-w-0 text-ink-2">{hint.does}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 max-w-[65ch] text-xs text-ink-3">Outside a text field, ↑ and ↓ work in place of PgUp and PgDn.</p>
        <Link
          href="/app/help#keyboard-title"
          className="-mx-1 mt-1 inline-flex min-h-11 items-center rounded px-1 text-sm text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink hover:decoration-ink"
        >
          Every shortcut, in Help
        </Link>
      </div>
    </div>
  );
}
