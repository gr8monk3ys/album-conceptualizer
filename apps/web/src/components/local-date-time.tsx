"use client";

import { useSyncExternalStore } from "react";

type DateInput = Date | string | number;

const DEFAULT_OPTIONS: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };

// Formatters are costly to build; keep one per locale+options pair.
const formatters = new Map<string, Intl.DateTimeFormat>();
function format(date: Date, options: Intl.DateTimeFormatOptions, locale?: string): string {
  const key = `${locale ?? ""}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    formatters.set(key, formatter);
  }
  return formatter.format(date);
}

const noopSubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

type LocalDateTimeProps = {
  value: DateInput;
  /** Intl options for the viewer-local rendering. */
  options?: Intl.DateTimeFormatOptions;
  className?: string;
};

/**
 * A date/time in the viewer's locale and time zone.
 *
 * `toLocaleString()` in a server component formats in the server's locale and
 * zone (en-US / UTC on Vercel), and in a client component it renders one string
 * on the server and another in the browser. Here the server render and
 * hydration both produce the same UTC-labelled en-US string, so the markup
 * matches, and the render right after hydration switches to the viewer's
 * locale and zone. Client-side navigations render the local value directly.
 */
export function LocalDateTime({ value, options = DEFAULT_OPTIONS, className }: LocalDateTimeProps) {
  const hydrated = useSyncExternalStore(noopSubscribe, getClientSnapshot, getServerSnapshot);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  let text: string;
  if (hydrated) {
    text = format(date, options);
  } else {
    const hasTime = Boolean(options.timeStyle || options.hour || options.minute);
    // Intl rejects timeZoneName together with dateStyle/timeStyle, so label by hand.
    text = format(date, { ...options, timeZone: "UTC" }, "en-US") + (hasTime ? " UTC" : "");
  }

  return (
    <time dateTime={date.toISOString()} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
