"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CheckCheck, MailOpen, RotateCcw } from "lucide-react";

import { Button, LiveStatus } from "@/components/ui";
import { useReturnFocus } from "@/components/use-return-focus";

type Status = { tone: "ok" | "danger"; text: string } | null;

async function readApiError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string" && body.error.trim() ? body.error : fallback;
}

/**
 * Marks every notification read. Busy while it works, and unavailable (not `disabled`) once
 * nothing is unread, so the button keeps keyboard focus through its own press and the refresh
 * that follows; "All caught up" beside the page title says why it is unavailable.
 */
export function MarkAllReadButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const returnFocus = useReturnFocus();
  const unavailable = Boolean(disabled) && !loading;

  async function markAll() {
    if (unavailable) return;
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/notifications/read-all", { method: "POST" });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Couldn't mark everything as read. Try again."));
      }
      setStatus({ tone: "ok", text: "All notifications marked read." });
      // Any row's earlier "Marked unread." is out of date now: rows clear their own line.
      window.dispatchEvent(new Event(ALL_READ_EVENT));
      router.refresh();
    } catch (err) {
      setStatus({
        tone: "danger",
        text: err instanceof Error ? err.message : "Couldn't mark everything as read. Try again.",
      });
    } finally {
      setLoading(false);
      // The refresh re-renders the page around the button; focus stays on it.
      returnFocus(() => buttonRef.current);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        ref={buttonRef}
        tone="secondary"
        busy={loading}
        aria-disabled={loading || unavailable || undefined}
        onClick={() => void markAll()}
      >
        <CheckCheck className="h-4 w-4" aria-hidden="true" />
        {loading ? "Marking…" : "Mark all read"}
      </Button>
      {/* Always mounted, so the result is announced when it arrives. */}
      <LiveStatus message={status?.text ?? null} tone={status?.tone} className="max-w-[65ch] text-right" />
    </div>
  );
}

/** Fired when "Mark all read" succeeds, so rows drop their own now out-of-date lines. */
const ALL_READ_EVENT = "notifications:all-read";

/**
 * Marks one notification read or unread. The button stays the same element through the
 * refresh (its label turns from "Mark read" to "Mark unread"), and it is busy rather than
 * disabled while it works, so focus stays on it; the change is announced once.
 */
export function ToggleNotificationReadButton({ id, unread }: { id: string; unread: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const returnFocus = useReturnFocus();
  const label = unread ? "Mark read" : "Mark unread";

  // A row's line describes its last change only until "Mark all read" makes a newer one.
  useEffect(() => {
    const clear = () => setStatus((current) => (current?.tone === "ok" ? null : current));
    window.addEventListener(ALL_READ_EVENT, clear);
    return () => window.removeEventListener(ALL_READ_EVENT, clear);
  }, []);

  async function toggle() {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: unread ? "read" : "unread" }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, "That change didn't save. Try again."));
      }
      setStatus({ tone: "ok", text: unread ? "Marked read." : "Marked unread." });
      router.refresh();
    } catch (err) {
      setStatus({
        tone: "danger",
        text: err instanceof Error ? err.message : "That change didn't save. Try again.",
      });
    } finally {
      setLoading(false);
      returnFocus(() => buttonRef.current);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button ref={buttonRef} tone="ghost" busy={loading} onClick={() => void toggle()} aria-label={label}>
        {unread ? (
          <MailOpen className="h-4 w-4" aria-hidden="true" />
        ) : (
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        )}
        {loading ? "Saving…" : label}
      </Button>
      {/* Always mounted. A success is heard, not shown: the dot and the button's new label
          already show it on every row. An error is shown too. */}
      <LiveStatus
        message={status?.text ?? null}
        tone={status?.tone}
        className={status?.tone === "ok" ? "sr-only" : "max-w-[65ch] text-right"}
      />
    </div>
  );
}
