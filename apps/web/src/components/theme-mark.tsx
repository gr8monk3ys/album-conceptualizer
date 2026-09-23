import { cn } from "@/lib/utils";

/**
 * Whether a track carries one of the album's central themes: a filled square when it does, a
 * small dot when it doesn't. The one mark for every theme matrix (the spine, the Studio track
 * list, the landing example), so the three never drift apart.
 */
export function ThemeMark({ carries, label }: { carries: boolean; label: string }) {
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "mx-auto block rounded-sm",
          carries ? "h-2.5 w-2.5 bg-ink" : "h-1 w-1 rounded-full bg-line-strong",
        )}
      />
      <span className="sr-only">{label}</span>
    </>
  );
}
