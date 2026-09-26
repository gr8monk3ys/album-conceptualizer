import Link from "next/link";
import { Check } from "lucide-react";

import type { ReadinessItem } from "@/server/readiness";
import { cn } from "@/lib/utils";

/**
 * What a handoff carries as it stands, one fact per item, each linked to where it's fixed:
 * "3 of 7 tracks written · Sound bible 0 of 9 fields · Starter chords on 7 tracks". Done items
 * carry a check; the rest a small Ember mark. It informs; nothing here blocks.
 */
export function ReadinessList({
  items,
  onlyOpen = false,
  className,
}: {
  items: ReadinessItem[];
  /** Show only what isn't done (the Publish confirm). */
  onlyOpen?: boolean;
  className?: string;
}) {
  const shown = onlyOpen ? items.filter((item) => !item.done) : items;
  if (!shown.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-x-6 gap-y-1", className)}>
      {shown.map((item) => (
        <li key={item.key} className="min-w-0">
          <Link
            href={item.href}
            className="group inline-flex min-h-11 min-w-0 items-center gap-2 text-sm text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
          >
            {item.done ? (
              <Check className="h-4 w-4 shrink-0 text-ok" aria-hidden="true" />
            ) : (
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-warn forced-colors:bg-[CanvasText]" />
            )}
            <span className="type-figure min-w-0 break-words">{item.label}</span>
            <span className="sr-only">{item.done ? " (done)" : " (to do)"}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
