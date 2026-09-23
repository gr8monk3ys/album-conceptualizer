"use client";

import { useEffect, useState } from "react";

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

export function formatRelative(date: Date, now = Date.now()) {
  const seconds = Math.round((date.getTime() - now) / 1000);
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

/** A timestamp in the viewer's own locale, as "3 minutes ago", with the exact time on hover. */
export function RelativeTime({ date }: { date: string }) {
  const value = new Date(date);
  const [label, setLabel] = useState(() => value.toISOString().slice(0, 10));
  useEffect(() => {
    const update = () => setLabel(formatRelative(value));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);
  return (
    <time dateTime={value.toISOString()} title={value.toLocaleString()} suppressHydrationWarning>
      {label}
    </time>
  );
}
