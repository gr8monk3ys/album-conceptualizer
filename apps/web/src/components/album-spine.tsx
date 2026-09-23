import Link from "next/link";
import { Check } from "lucide-react";

import type { SpineRow } from "@/server/album-songs";
import { cn } from "@/lib/utils";

function Mark({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      title={label}
      className={cn("grid h-5 w-5 place-items-center rounded-sm border", done ? "border-ok/60 text-ok" : "border-line text-transparent")}
    >
      <Check className="h-3 w-3" aria-hidden="true" />
      <span className="sr-only">{`${label}: ${done ? "yes" : "not yet"}`}</span>
    </span>
  );
}

/**
 * The album's sequence, always in view: one row per track with what each track still needs
 * (lyrics written, themes tagged, a narrative role). Each row opens that track in the Studio.
 */
export function AlbumSpine({ albumId, rows }: { albumId: string; rows: SpineRow[] }) {
  return (
    <section aria-labelledby="album-spine-title" className="sticky top-24">
      <h2 id="album-spine-title" className="text-sm font-semibold text-ink">
        Sequence
      </h2>
      {rows.length ? (
        <ol className="mt-2 border-t border-line">
          {rows.map((row) => (
            <li key={row.trackNumber} className="border-b border-line">
              <Link
                href={`/app/albums/${albumId}/studio?song=${row.trackNumber}`}
                className="group flex min-h-11 items-center gap-3 py-1.5 pr-0.5 hover:bg-hover"
              >
                <span className="type-figure w-7 shrink-0 pl-1 text-lg font-semibold text-ink-3 group-hover:text-accent">
                  {String(row.trackNumber).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{row.title}</span>
                <span className="flex gap-1.5">
                  <Mark done={row.sections > 0 && row.lyricSections === row.sections} label="Lyrics written" />
                  <Mark done={row.themes > 0} label="Themes tagged" />
                  <Mark done={row.hasNarrative} label="Narrative role" />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : null}
      {rows.length ? (
        <p className="mt-3 text-xs leading-relaxed text-ink-3">
          The three marks on each track: lyrics written, themes tagged, narrative role set.
        </p>
      ) : (
        <p className="mt-3 text-sm text-ink-2">No tracks yet. Add the first one in the Studio.</p>
      )}
    </section>
  );
}
