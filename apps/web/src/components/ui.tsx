import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

// The shared vocabulary of the label identity program. Screens compose these instead of
// restyling raw elements, so a primary action, a field or a section looks the same
// everywhere. Rules: saffron only on primary actions, current location and focus; hairline
// rules separate content, and a Panel is never placed inside another Panel.

type Tone = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

const BUTTON_TONES: Record<Tone, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover",
  secondary: "border border-line-strong bg-transparent text-ink hover:border-ink-3 hover:bg-hover",
  ghost: "text-ink-2 hover:bg-hover hover:text-ink",
  danger: "border border-danger/60 bg-transparent text-danger hover:bg-danger-soft",
};

export function buttonClass(tone: Tone = "secondary", className?: string) {
  return cn(BUTTON_BASE, BUTTON_TONES[tone], className);
}

export function Button({
  tone = "secondary",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { tone?: Tone }) {
  return <button type={type} className={buttonClass(tone, className)} {...props} />;
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
        "grid h-11 w-11 shrink-0 place-items-center rounded text-ink-2 transition-colors hover:bg-hover hover:text-ink disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * The top of every page: the h1 in the display cut, an optional catalog line beneath it
 * (artist · tracks · status), and the page's actions, with at most one primary.
 */
export function PageHeader({
  title,
  catalog,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  catalog?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="min-w-0 max-w-[68ch]">
        <h1 className="type-display text-3xl text-ink md:text-[2.75rem]">{title}</h1>
        {catalog ? <p className="type-catalog mt-3 text-xs text-ink-2">{catalog}</p> : null}
        {description ? <p className="mt-3 text-sm leading-relaxed text-ink-2">{description}</p> : null}
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
        <div className="min-w-0 max-w-[68ch]">
          <Heading id={id ? `${id}-title` : undefined} className="text-lg font-semibold text-ink">
            {title}
          </Heading>
          {description ? <p className="mt-1 text-sm leading-relaxed text-ink-2">{description}</p> : null}
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

const CONTROL =
  "w-full rounded border border-line-control bg-sunken px-3 text-sm text-ink placeholder:text-ink-3 transition-colors hover:border-ink-3 focus-visible:border-accent disabled:opacity-60";

export const inputClass = cn(CONTROL, "min-h-11");
export const textareaClass = cn(CONTROL, "min-h-24 py-2.5 leading-relaxed");
export const selectClass = cn(CONTROL, "min-h-11 appearance-auto");

/** A labelled control. The label is always visible; hints and errors are tied to the control. */
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
  children: ReactNode;
  className?: string;
  htmlFor: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs leading-relaxed text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A short label for a tag, theme or state. Not a button; see ChipButton for toggles. */
export function Chip({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: "neutral" | "accent" | "ok" | "warn" | "danger" }) {
  const tones = {
    neutral: "border-line-strong text-ink-2",
    accent: "border-accent/60 text-accent",
    ok: "border-ok/50 text-ok",
    warn: "border-warn/50 text-warn",
    danger: "border-danger/50 text-danger",
  };
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-medium", tones[tone], className)}
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
      <p className="text-base font-semibold text-ink">{title}</p>
      {children ? <div className="mt-2 max-w-[60ch] text-sm leading-relaxed text-ink-2">{children}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
