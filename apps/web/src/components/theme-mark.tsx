import { cn } from "@/lib/utils";

/**
 * Whether a track carries one of the album's central themes: a filled square when it does, a
 * small dot when it doesn't. The one mark for every theme matrix (the spine, the Studio track
 * list, the landing example), so the three never drift apart.
 *
 * `label` is the mark's spoken equivalent. Leave it out where the row already says what it
 * carries in one phrase (the spine does), so a screen reader isn't read one cell per theme.
 */
export function ThemeMark({ carries, label }: { carries: boolean; label?: string }) {
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "mx-auto block rounded-sm",
          // Forced colors drop background colours, so the marks switch to system colours there.
          carries
            ? "h-2.5 w-2.5 bg-ink forced-colors:bg-[CanvasText]"
            : "h-1 w-1 rounded-full bg-line-strong forced-colors:bg-[GrayText]",
        )}
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </>
  );
}
