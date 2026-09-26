"use client";

import { useEffect, useState } from "react";

import { LiveStatus } from "@/components/ui";

/**
 * The one line that says what just happened on arrival ("Restored …"), in an always-mounted
 * live region. The page renders it with its message, but the region mounts empty and the line
 * is filled in just after, so screen readers announce it: a region that appears already filled
 * is often read as nothing new.
 */
export function ArrivalStatus({
  message,
  tone = "ok",
  className,
}: {
  message: string | null;
  tone?: "neutral" | "ok" | "danger";
  className?: string;
}) {
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    // A beat after the region is in the page, so assistive tech is listening when it fills.
    const timer = window.setTimeout(() => setShown(message), 150);
    return () => window.clearTimeout(timer);
  }, [message]);
  return <LiveStatus message={shown} tone={tone} className={className} />;
}
