"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";

import { Button } from "@/components/ui";
import type { LeaveGuard } from "@/lib/use-autosave";
import { cn } from "@/lib/utils";

const SOUND_PAGES = [
  { segment: "style", label: "Style" },
  { segment: "references", label: "References" },
  { segment: "demos", label: "Demos" },
] as const;

export type SoundPage = (typeof SOUND_PAGES)[number]["segment"];

/**
 * The second level under the album's Sound tab: the style bible, reference tracks and rough
 * demos are three views of one question, what the record sounds like.
 */
export function SoundNav({ albumId, current }: { albumId: string; current: SoundPage }) {
  return (
    <nav aria-label="Sound">
      <ul className="flex flex-wrap items-center gap-x-1 gap-y-1">
        {SOUND_PAGES.map((page, index) => {
          const active = page.segment === current;
          return (
            <li key={page.segment} className="flex items-center gap-x-1">
              {index > 0 ? (
                <span aria-hidden="true" className="text-ink-3">
                  ·
                </span>
              ) : null}
              <Link
                href={`/app/albums/${albumId}/${page.segment}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 min-w-11 items-center justify-center rounded px-3 text-sm transition-colors",
                  active
                    ? "font-semibold text-ink underline decoration-accent decoration-2 underline-offset-8"
                    : "text-ink-2 hover:bg-hover hover:text-ink",
                )}
              >
                {page.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Shown when leaving a Sound page couldn't keep the viewer's work: a small, non-modal
 * confirm pinned to the bottom of the viewport, so it is seen wherever the click came from.
 */
export function LeavePrompt({ guard, message }: { guard: LeaveGuard; message: string }) {
  const stayRef = useRef<HTMLButtonElement>(null);
  const messageId = useId();
  const open = guard.pendingHref !== null;

  useEffect(() => {
    if (open) stayRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="alertdialog"
      aria-describedby={messageId}
      aria-label="Leave this page?"
      onKeyDown={(event) => {
        if (event.key === "Escape") guard.stay();
      }}
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded border border-line-strong bg-raised p-4"
    >
      <p id={messageId} className="max-w-[65ch] text-sm leading-relaxed text-ink">
        {message}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button ref={stayRef} tone="secondary" onClick={guard.stay}>
          Stay on this page
        </Button>
        <Button tone="danger" onClick={guard.leaveAnyway}>
          Leave without saving
        </Button>
      </div>
    </div>
  );
}
