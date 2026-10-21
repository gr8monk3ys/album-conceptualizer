import { cn } from "@/lib/utils";

/**
 * "Album Conceptualizer" in condensed caps. With `fit`, inside a narrow column (the sidebar,
 * the mobile sheet), it never grows past what that column can hold, so enlarged text wraps it
 * between the two words instead of splitting "Conceptualizer": the parent must be a size
 * container (`@container`). "CONCEPTUALIZER" in this cut is 8.44em wide, so 11cqi keeps it
 * to 93% of the column. It never sets smaller than it does at 100% text (14px, or 0.875rem
 * if the reader chose smaller text): enlarged text may stop it growing, never shrink it. The
 * column has to leave it room, so the mobile sheet gives it a row of its own when narrow.
 *
 * Its own module, not the sidebar's: client modules that show it (the root error screen, the
 * mobile sheet) would otherwise load the sidebar's navigation, credits meter and account
 * block with it, on every page, public ones included.
 */
export function Wordmark({ className, fit = false }: { className?: string; fit?: boolean }) {
  return (
    <span
      className={cn(
        "type-catalog break-words text-ink",
        fit ? "text-[length:max(min(0.875rem,14px),min(0.875rem,11cqi))] leading-5" : "text-sm",
        className,
      )}
    >
      Album <span className="font-extrabold">Conceptualizer</span>
    </span>
  );
}
