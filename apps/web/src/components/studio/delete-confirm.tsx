"use client";

import { useEffect, useId, useRef } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui";

/**
 * "Written work is never one click from gone": the inline question the Studio asks before it
 * deletes a track or a section that holds written lyrics, naming what goes ("Delete Track 1
 * and its 2 written sections?"), with Delete and Cancel. It takes focus on its Delete when it
 * opens; Escape or Cancel closes it (the Studio returns focus to the "More" button that asked).
 * The delete itself still offers Undo for 10 seconds.
 */
export function DeleteConfirm({
  id,
  question,
  onConfirm,
  onCancel,
}: {
  id: string;
  question: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const promptId = useId();
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  return (
    <div
      id={id}
      role="group"
      aria-labelledby={promptId}
      className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <p id={promptId} className="min-w-0 max-w-[65ch] break-words text-sm text-ink">
        {question}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button ref={confirmRef} tone="danger" onClick={onConfirm}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete
        </Button>
        <Button tone="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/** "Delete Track 1 and its 2 written sections?" (the track's name, or "track 3" without one). */
export function deleteTrackQuestion(title: string | null | undefined, trackNumber: number, written: number) {
  const name = title?.trim() || `track ${trackNumber}`;
  return `Delete ${name} and its ${plural(written, "written section", "written sections")}?`;
}

/** "Delete Verse 1 and its written lyrics?" */
export function deleteSectionQuestion(label: string) {
  return `Delete ${label} and its written lyrics?`;
}
