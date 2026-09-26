"use client";

import { useEffect, useRef, useState } from "react";

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

// One formatter for every timestamp on the page (a Discover page shows dozens), built on first use.
let relativeFormat: Intl.RelativeTimeFormat | undefined;

/**
 * What `Intl.RelativeTimeFormat("en", { numeric: "auto" })` says for a whole, non-zero `value`
 * under 1000: "yesterday", "last week", "in 1 hour", "3 days ago". Tested against Intl for every
 * English locale. The first Intl formatter a page builds loads ICU's locale data (60ms or more
 * on a throttled phone), which made the first timestamp update one of the page's long tasks.
 */
export function englishRelative(value: number, unit: Intl.RelativeTimeFormatUnit): string | null {
  const count = Math.abs(value);
  if (!Number.isInteger(value) || count < 1 || count >= 1000) return null;
  if (count === 1 && (unit === "day" || unit === "days")) return value < 0 ? "yesterday" : "tomorrow";
  const singular = unit.replace(/s$/, "");
  if (count === 1 && ["week", "month", "quarter", "year"].includes(singular)) {
    return `${value < 0 ? "last" : "next"} ${singular}`;
  }
  const noun = count === 1 ? singular : `${singular}s`;
  return value < 0 ? `${count} ${noun} ago` : `in ${count} ${noun}`;
}

function viewerReadsEnglish() {
  return typeof navigator !== "undefined" && /^en(?:-|$)/i.test(navigator.language ?? "");
}

export function formatRelative(date: Date, now = Date.now()) {
  const seconds = Math.round((date.getTime() - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      const value = Math.round(seconds / size);
      const english = viewerReadsEnglish() ? englishRelative(value, unit) : null;
      if (english) return english;
      relativeFormat ??= new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
      return relativeFormat.format(value, unit);
    }
  }
  return "just now";
}

/** A timestamp in the viewer's own locale, as "3 minutes ago", with the exact time on hover. */
export function RelativeTime({ date }: { date: string }) {
  const value = new Date(date);
  const ref = useRef<HTMLTimeElement>(null);
  const shownDate = useRef<string | null>(null);
  const [label, setLabel] = useState(() => value.toISOString().slice(0, 10));
  useEffect(() => {
    // The exact time on hover. The server writes it into the page and hydration keeps that
    // attribute, so it is only filled in here: for a timestamp first drawn in the browser, and
    // when the date changes. Formatting it while hydrating did nothing (hydration never patches
    // an attribute) but cost the page's first date format, 40–65ms on a throttled phone.
    const element = ref.current;
    if (element && (shownDate.current !== null || !element.title)) element.title = value.toLocaleString();
    shownDate.current = date;
    const update = () => setLabel(formatRelative(value));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);
  return (
    <time
      ref={ref}
      dateTime={value.toISOString()}
      title={typeof window === "undefined" ? value.toLocaleString() : undefined}
      suppressHydrationWarning
    >
      {label}
    </time>
  );
}
