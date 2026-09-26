import { themeHeadLines } from "@/lib/theme-keys";
import { cn } from "@/lib/utils";

/**
 * Whether a track carries one of the album's central themes: a filled square when it does, a
 * small dot when it doesn't. The one mark for every read-only theme matrix (the spine and the
 * landing example), so the two never drift apart. The Studio track list is editable and
 * draws its own toggles (the theme's key letter, filled when pressed).
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

/**
 * A theme's name heading its column, whole: on one line when it fits the slot, otherwise on
 * two (broken at a space, or hyphenated at a syllable), from `themeHeadLines`. Only a name
 * that not even two lines hold truncates, and the table shows its legend for it. Each line
 * still truncates as a safety net. Visual only: the table names its themes in full for
 * screen readers, so this is hidden from them.
 *
 * `widthRem` is the room inside the slot (its width less padding), in rem.
 */
export function ThemeHeadName({
  theme,
  widthRem,
  className,
}: {
  theme: string;
  widthRem: number;
  className?: string;
}) {
  const { lines } = themeHeadLines(theme, widthRem);
  return (
    <span aria-hidden="true" title={theme} className={cn("type-catalog text-xs leading-tight text-ink-3", className)}>
      {lines.map((line, index) => (
        <span key={index} className="block truncate">
          {line}
        </span>
      ))}
    </span>
  );
}
