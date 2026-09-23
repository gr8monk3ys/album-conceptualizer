"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCheck, MailOpen, RotateCcw } from "lucide-react";

import { Button, StatusMessage } from "@/components/ui";

async function readApiError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string" && body.error.trim() ? body.error : fallback;
}

export function MarkAllReadButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markAll() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/notifications/read-all", { method: "POST" });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Couldn't mark everything as read. Try again."));
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't mark everything as read. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button tone="secondary" disabled={disabled || loading} onClick={markAll}>
        <CheckCheck className="h-4 w-4" aria-hidden="true" />
        {loading ? "Marking…" : "Mark all read"}
      </Button>
      {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}
    </div>
  );
}

export function ToggleNotificationReadButton({ id, unread }: { id: string; unread: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = unread ? "Mark read" : "Mark unread";

  async function toggle() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: unread ? "read" : "unread" }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, "That change didn't save. Try again."));
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That change didn't save. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button tone="ghost" disabled={loading} onClick={toggle} aria-label={label}>
        {unread ? (
          <MailOpen className="h-4 w-4" aria-hidden="true" />
        ) : (
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        )}
        {loading ? "Saving…" : label}
      </Button>
      {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}
    </div>
  );
}
