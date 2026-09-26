"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

import { menuLeftOffset } from "@/components/studio/menu-position";
import { buttonClass } from "@/components/ui";
import { cn } from "@/lib/utils";

export type MoreMenuItem = {
  key: string;
  label: string;
  /** A second line in Ash Ink: what the action does or needs. */
  hint?: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  /** Destructive: coral text, set apart from the items above it by a hairline. */
  danger?: boolean;
};

/**
 * The overflow for actions that don't belong on the writing path (reordering, downloads,
 * deleting). A menu button: Enter, Space or ↓ opens it on the first item, ↑ on the last; ↑/↓,
 * Home and End move between items; Escape closes it and returns focus to the button; Tab
 * closes it and moves on. The visible label is "More"; `label` completes the accessible name
 * ("More track actions") so two menus on a page stay distinct.
 */
export function MoreMenu({
  label,
  items,
  className,
  triggerId,
}: {
  label: string;
  items: MoreMenuItem[];
  className?: string;
  /** An id for the "More" button, so the page can return focus to it. */
  triggerId?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const firstFocus = useRef<"first" | "last">("first");
  const id = useId();
  const menuId = `${id}-menu`;

  function show(focus: "first" | "last") {
    firstFocus.current = focus;
    setOpen(true);
  }

  function hide(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  // Keeps the menu inside the viewport: it hangs from the button's right edge, clamped 8px
  // from either edge (menu-position.ts), so it never widens the page on a phone.
  const place = useCallback(() => {
    const wrapper = wrapperRef.current;
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!wrapper || !trigger || !menu) return;
    const left = menuLeftOffset({
      triggerRight: trigger.getBoundingClientRect().right,
      wrapperLeft: wrapper.getBoundingClientRect().left,
      menuWidth: menu.offsetWidth,
      viewportWidth: document.documentElement.clientWidth,
    });
    menu.style.left = `${left}px`;
    menu.style.right = "auto";
  }, []);

  // On open: place the menu and focus the first or last item.
  useLayoutEffect(() => {
    if (!open) return;
    place();
    const index = firstFocus.current === "last" ? items.length - 1 : 0;
    itemRefs.current[index]?.focus();
    // Only when the menu opens; the items' identity changes on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Rotating a phone or resizing the window re-places an open menu.
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, place]);

  // A press anywhere outside closes the menu without taking focus back.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      show(event.key === "ArrowUp" ? "last" : "first");
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const current = itemRefs.current.findIndex((el) => el === document.activeElement);
    const last = items.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowDown") next = current >= last ? 0 : current + 1;
    else if (event.key === "ArrowUp") next = current <= 0 ? last : current - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      hide(true);
      return;
    } else if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (next != null) {
      event.preventDefault();
      itemRefs.current[next]?.focus();
    }
  }

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? hide(false) : show("first"))}
        onKeyDown={onTriggerKeyDown}
        className={buttonClass("ghost", "px-3")}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        More
        <span className="sr-only"> {label}</span>
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={`More ${label}`}
          onKeyDown={onMenuKeyDown}
          className="absolute left-0 top-full z-30 mt-1 flex w-max min-w-[min(14rem,calc(100vw-1rem))] max-w-[min(20rem,calc(100vw-1rem))] flex-col rounded border border-line-strong bg-raised p-1"
        >
          {items.map((item, index) => (
            <button
              key={item.key}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-disabled={item.disabled || undefined}
              onClick={() => {
                if (item.disabled) return;
                hide(true);
                item.onSelect();
              }}
              className={cn(
                "flex min-h-11 w-full items-start gap-2 rounded-sm px-3 py-2.5 text-left text-sm font-medium transition-colors",
                item.danger ? "text-danger hover:bg-danger-soft" : "text-ink hover:bg-hover",
                item.danger && index > 0 && "mt-1 border-t border-line",
                item.disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
              )}
            >
              {item.icon ? <span className="mt-0.5 flex-none">{item.icon}</span> : null}
              <span className="min-w-0">
                <span className="block break-words">{item.label}</span>
                {item.hint ? (
                  <span className="mt-0.5 block max-w-[65ch] break-words text-xs font-normal leading-relaxed text-ink-3">
                    {item.hint}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
