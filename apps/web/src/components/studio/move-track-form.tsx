"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

import { Button, selectClass } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * One option per place in the sequence: "05 · now “Signal”" (the track the moved one takes the
 * place of), and "02 · where it is now" for its own place.
 */
export function positionOptions(
  songs: readonly { title?: string | null }[],
  current: number,
): { value: number; label: string }[] {
  return songs.map((song, index) => {
    const number = String(index + 1).padStart(2, "0");
    const label = index === current ? "where it is now" : `now “${song.title?.trim() || "Untitled"}”`;
    return { value: index, label: `${number} · ${label}` };
  });
}

/**
 * "Move to position…" from the track's More menu, inline under the track header like the
 * delete question: a select of every place in the sequence and Move / Cancel, so a track goes
 * from 10 to 02 in one step. It takes focus on its select when it opens; Escape or Cancel
 * closes it (the Studio returns focus to the "More" button that asked). The move itself keeps
 * its Undo in the save bar.
 */
export function MoveTrackForm({
  id,
  songs,
  current,
  onMove,
  onCancel,
}: {
  id: string;
  songs: readonly { id?: string | null; title?: string | null }[];
  /** The index of the track being moved. */
  current: number;
  /** Called with the chosen index (0-based), only when it differs from `current`. */
  onMove: (to: number) => void;
  onCancel: () => void;
}) {
  const promptId = useId();
  const selectId = `${id}-position`;
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const [to, setTo] = useState(current);
  // A move made another way while this is open (a shortcut) moves "where it is now" with it.
  const [shownFor, setShownFor] = useState(current);
  if (shownFor !== current) {
    setShownFor(current);
    setTo(current);
  }
  const target = Math.min(Math.max(0, to), songs.length - 1);
  const unchanged = target === current;

  useEffect(() => {
    selectRef.current?.focus();
  }, []);

  function move() {
    if (unchanged) return;
    onMove(target);
  }

  return (
    <div
      id={id}
      role="group"
      aria-labelledby={promptId}
      className="mt-2 flex min-w-0 flex-wrap items-end gap-x-3 gap-y-2"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <label id={promptId} htmlFor={selectId} className="text-sm font-medium text-ink">
          Move to position
        </label>
        <select
          ref={selectRef}
          id={selectId}
          value={target}
          onChange={(event) => setTo(Number(event.target.value))}
          onKeyDown={(event) => {
            // Enter moves, as a form would; the select keeps its own arrow keys.
            if (event.key === "Enter") {
              event.preventDefault();
              move();
            }
          }}
          className={cn(selectClass, "w-auto max-w-full")}
        >
          {positionOptions(songs, current).map((option) => (
            <option key={songs[option.value]?.id ?? option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {/* Unavailable until another place is chosen, but never natively disabled, so focus
            can rest on it. */}
        <Button tone="secondary" onClick={move} {...(unchanged ? { "aria-disabled": true } : {})}>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          Move
        </Button>
        <Button tone="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
