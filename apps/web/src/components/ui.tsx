import Link from "next/link";
import {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

// The shared vocabulary of the label identity program. Screens compose these instead of
// restyling raw elements, so a primary action, a field or a section looks the same
// everywhere. Rules: saffron only on primary actions, current location and focus; hairline
// rules separate content, and a Panel is never placed inside another Panel.

type Tone = "primary" | "secondary" | "ghost" | "danger";

// Every tone has a 1px border, transparent where the design shows none: in forced-colors
// (Windows High Contrast) mode backgrounds are dropped and borders are drawn in the system
// colour, so the border is what keeps a primary or ghost button looking like a button.
// Unavailable (disabled, or aria-disabled while busy) is 50% and a not-allowed cursor; in
// forced colors the label and edge turn GrayText, which the system draws for a native disabled
// button but not for an aria-disabled one or a link.
const BUTTON_BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded border border-transparent px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 disabled:forced-colors:border-[GrayText] disabled:forced-colors:text-[GrayText] aria-disabled:forced-colors:border-[GrayText] aria-disabled:forced-colors:text-[GrayText]";

/**
 * Marks the one saffron action on a screen. It carries no style; the album release header
 * reads it to step its own next-step button back when the screen already has a primary.
 */
export const PRIMARY_ACTION_MARKER = "primary-action";

const PRIMARY_UNAVAILABLE = [
  "disabled:border-line-strong disabled:bg-raised disabled:text-ink-3 disabled:opacity-100 disabled:hover:bg-raised",
  "aria-disabled:border-line-strong aria-disabled:bg-raised aria-disabled:text-ink-3 aria-disabled:opacity-100 aria-disabled:hover:bg-raised",
].join(" ");

const BUTTON_TONES: Record<Tone, string> = {
  // An unavailable primary doesn't fade its saffron (half-strength saffron on graphite read
  // as a muddy olive, a colour the system doesn't have): it takes the Raised surface with a
  // Strong Rule edge and an Ash Ink label, at full opacity, so it reads as unavailable, keeps
  // its shape, and the one saffron on a screen is always an action that can be taken.
  primary: `${PRIMARY_ACTION_MARKER} bg-accent text-accent-ink hover:bg-accent-hover ${PRIMARY_UNAVAILABLE}`,
  secondary: "border-line-strong bg-transparent text-ink hover:border-ink-3 hover:bg-hover",
  ghost: "text-ink-2 hover:bg-hover hover:text-ink",
  danger: "border-danger/60 bg-transparent text-danger hover:bg-danger-soft",
};

export function buttonClass(tone: Tone = "secondary", className?: string) {
  return cn(BUTTON_BASE, BUTTON_TONES[tone], className);
}

function preventWhileBusy(event: { preventDefault: () => void }) {
  event.preventDefault();
}

/**
 * A button. `busy` is for a control whose own work is running (saving, previewing): it stays
 * focusable and announces itself unavailable (aria-disabled, aria-busy) and ignores clicks,
 * where the native `disabled` attribute would drop keyboard focus to the page body.
 */
export function Button({
  tone = "secondary",
  className,
  type = "button",
  busy = false,
  onClick,
  ...props
}: ComponentProps<"button"> & { tone?: Tone; busy?: boolean }) {
  return (
    <button
      type={type}
      className={buttonClass(tone, className)}
      aria-disabled={busy || props["aria-disabled"] || undefined}
      aria-busy={busy || undefined}
      // Only a client caller can be busy or pass a handler; a Server Component renders this
      // with neither, and must not be handed a function (it can't be serialised).
      onClick={busy ? preventWhileBusy : onClick}
      {...props}
    />
  );
}

export function ButtonLink({
  tone = "secondary",
  className,
  ...props
}: ComponentProps<typeof Link> & { tone?: Tone }) {
  return <Link className={buttonClass(tone, className)} {...props} />;
}

/** An icon-only control. `label` is required: it is the accessible name. */
export function IconButton({
  label,
  className,
  type = "button",
  children,
  ...props
}: ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-11 w-11 shrink-0 place-items-center rounded border border-transparent text-ink-2 transition-colors hover:bg-hover hover:text-ink disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * The top of every page: the h1, an optional catalog line beneath it (artist · tracks ·
 * status), and the page's actions, with at most one primary. `size="display"` (the default)
 * sets the h1 in the expanded display cut, for pages whose title is a work (an album, a
 * plan); `size="page"` sets it at headline size in the normal cut, for the app's own screens
 * (Home, Library, Search, Notifications, Settings, Help), so the display face stays for titles
 * that are the artist's.
 */
export function PageHeader({
  title,
  catalog,
  description,
  actions,
  className,
  size = "display",
}: {
  title: ReactNode;
  catalog?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  size?: "display" | "page";
}) {
  return (
    // A size container, so the title steps down in a narrow column (a phone at 200% text)
    // instead of breaking inside words (--text-display-md in globals.css).
    <header className={cn("@container flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="min-w-0">
        <h1
          className={cn(
            "break-words hyphens-auto text-ink",
            // The page title also steps down in a narrow header (9% of it, never under 1rem):
            // 1.5rem at normal size, about 23px at 320px with 200% text, so words stay whole.
            size === "page"
              ? "text-[length:max(1rem,min(1.5rem,9cqi))] font-semibold leading-tight"
              : "type-display text-display-md",
          )}
        >
          {title}
        </h1>
        {catalog ? (
          <p className={cn("type-catalog text-xs text-ink-2", size === "page" ? "mt-2" : "mt-3")}>{catalog}</p>
        ) : null}
        {description ? (
          <p className="mt-3 max-w-[65ch] text-sm leading-relaxed text-ink-2">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** A titled region of a page, separated by a hairline rule rather than a box. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
  headingLevel = 2,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  headingLevel?: 2 | 3;
  id?: string;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section aria-labelledby={id ? `${id}-title` : undefined} className={cn("border-t border-line pt-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Heading
            id={id ? `${id}-title` : undefined}
            className="break-words text-lg font-semibold text-ink"
          >
            {title}
          </Heading>
          {description ? (
            <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-ink-2">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** A contained surface for a form or a self-contained tool. Never nest one in another. */
export function Panel({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded border border-line bg-raised p-4 md:p-5", className)} {...props} />;
}

/**
 * The one wrapper for a table wider than its column: a labelled, focusable region that
 * scrolls sideways inside itself, with an edge fade on the side that has more of the table.
 * It measures its own scroll position, so it lives in a client module; Server Components
 * render it like any other primitive (`<TableScroller label="…">…table…</TableScroller>`).
 */
export { TableScroller } from "@/components/table-scroller";

const CONTROL =
  "w-full rounded border border-line-control bg-sunken px-3 text-sm text-ink placeholder:text-ink-3 transition-colors hover:border-ink-3 focus-visible:border-accent disabled:opacity-60";

export const inputClass = cn(CONTROL, "min-h-11");
export const textareaClass = cn(CONTROL, "min-h-24 py-2.5 leading-relaxed");
export const selectClass = cn(CONTROL, "min-h-11 appearance-auto");

/** The props Field gives its control so the hint or error is read with it. */
export type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

/** Ids a Field owns for its control's description; any others the caller set are kept. */
function fieldDescriptionIds(htmlFor: string) {
  return new Set([`${htmlFor}-hint`, `${htmlFor}-error`]);
}

/** The caller's own describedby ids (minus the Field's) followed by the one the Field shows. */
export function mergeDescribedBy(existing: unknown, htmlFor: string, current: string | null) {
  const owned = fieldDescriptionIds(htmlFor);
  const ids = (typeof existing === "string" ? existing.split(/\s+/) : []).filter(
    (id) => id && !owned.has(id),
  );
  if (current) ids.push(current);
  return ids.length ? Array.from(new Set(ids)).join(" ") : undefined;
}

type ElementProps = { id?: unknown; children?: ReactNode; "aria-describedby"?: unknown; "aria-invalid"?: unknown };

/**
 * Finds the element whose id is `htmlFor` among `node` and its plain descendants (fragments
 * and wrapper elements written inline) and gives it the description props. Returns the node
 * unchanged, and `found: false`, when the control isn't there (e.g. it is rendered inside
 * another component; pass a render function then).
 */
function wireControl(
  node: ReactNode,
  htmlFor: string,
  describe: (element: ReactElement<ElementProps>) => Partial<ElementProps>,
): { node: ReactNode; found: boolean } {
  let found = false;
  const visit = (child: ReactNode): ReactNode => {
    if (found || !isValidElement<ElementProps>(child)) return child;
    if (child.props.id === htmlFor) {
      found = true;
      return cloneElement(child, describe(child));
    }
    const inner = child.props.children;
    if (inner === undefined || inner === null || typeof inner === "string") return child;
    // Only walk into fragments and host elements: a component's children are its own business.
    if (child.type !== Fragment && typeof child.type !== "string") return child;
    const mapped = Children.map(inner, visit);
    return found ? cloneElement(child, undefined, ...(mapped ?? [])) : child;
  };
  const result = Children.count(node) === 1 ? visit(node) : Children.map(node, visit);
  return { node: result, found };
}

/**
 * A labelled control. The label is always visible, and the hint or error below it is tied to
 * the control: the Field gives the control (the element whose id is `htmlFor`) its
 * `aria-describedby` and, with an error, `aria-invalid`, so a caller can't forget them. Ids the
 * caller already set on the control are kept. When the control is rendered by another
 * component, pass a function instead: `{(control) => <Picker {...control} />}`.
 */
export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode | ((control: FieldControlProps) => ReactNode);
  className?: string;
  htmlFor: string;
}) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : null;
  let control: ReactNode;
  if (typeof children === "function") {
    control = children({
      id: htmlFor,
      "aria-describedby": describedBy ?? undefined,
      "aria-invalid": error ? true : undefined,
    });
  } else {
    control = wireControl(children, htmlFor, (element) => ({
      "aria-describedby": mergeDescribedBy(element.props["aria-describedby"], htmlFor, describedBy),
      "aria-invalid": error ? true : (element.props["aria-invalid"] as ElementProps["aria-invalid"]),
    })).node;
  }
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {control}
      {error ? (
        <p id={`${htmlFor}-error`} className="max-w-[65ch] text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="max-w-[65ch] text-xs leading-relaxed text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A short label for a tag, theme or state; not a button. There is no saffron tone: a chip is
 * never the primary action, the current location or focus (the One Signal Rule).
 *
 * Chips that aren't buttons don't look like buttons: a flat tint with no border (a Strong Rule
 * outline is what a secondary button wears), no shadow and the default cursor. Interactive
 * chips (the editable chip lists, suggestion chips) are drawn by their editors, 44px tall with a
 * border and a hover, so the two never read alike.
 */
export function Chip({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: "neutral" | "ok" | "warn" | "danger" }) {
  const tones = {
    neutral: "bg-hover text-ink-2",
    ok: "bg-ok/10 text-ok",
    warn: "bg-warn/10 text-warn",
    danger: "bg-danger-soft text-danger",
  };
  return (
    <span
      className={cn(
        "inline-flex cursor-default items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/**
 * Inline status text for the result of an action. `polite` for progress and success,
 * `assertive` for errors, so screen readers hear what happened.
 */
export function StatusMessage({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "ok" | "danger";
  children: ReactNode;
  className?: string;
}) {
  const color = tone === "ok" ? "text-ok" : tone === "danger" ? "text-danger" : "text-ink-2";
  return (
    <p role={tone === "danger" ? "alert" : "status"} className={cn("text-sm", color, className)}>
      {children}
    </p>
  );
}

/**
 * A status line whose live region is always mounted, so a message is announced when it
 * arrives: many screen readers stay silent for a region that appears with its text already in
 * it. Render it unconditionally and pass `message` (null when there is nothing to say). Errors
 * go into a second always-mounted region, role="alert", which is announced at once.
 */
export function LiveStatus({
  message,
  tone = "neutral",
  className,
}: {
  message: ReactNode | null;
  tone?: "neutral" | "ok" | "danger";
  className?: string;
}) {
  const color = tone === "ok" ? "text-ok" : tone === "danger" ? "text-danger" : "text-ink-2";
  return (
    // Two regions, both always mounted: news goes into the polite one, errors into the alert
    // one (an alert inside a polite region can be read twice). While idle the pair is taken
    // out of the flow (zero size), so it adds no gap to the flex or grid it sits in; it stays
    // in the page, so it is still listening.
    <div className={message ? className : "absolute"}>
      <div aria-live="polite" className="empty:absolute">
        {message && tone !== "danger" ? <p className={cn("text-sm", color)}>{message}</p> : null}
      </div>
      <div role="alert" className="empty:absolute">
        {message && tone === "danger" ? <p className={cn("text-sm", color)}>{message}</p> : null}
      </div>
    </div>
  );
}

/** An empty state that teaches the next step instead of saying "nothing here". */
export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded border border-dashed border-line-strong px-5 py-8", className)}>
      <p className="max-w-[65ch] break-words text-base font-semibold text-ink">{title}</p>
      {children ? (
        <div className="mt-2 max-w-[65ch] text-sm leading-relaxed text-ink-2">{children}</div>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
