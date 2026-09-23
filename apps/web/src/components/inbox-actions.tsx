"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";

import { Button, StatusMessage } from "@/components/ui";

/** The server's human-written `error` field, or the fallback. Never a raw body or status. */
async function readError(response: Response, fallback: string) {
  if (response.status === 401) return "You're signed out. Sign in again, then retry.";
  try {
    const data = (await response.json()) as { error?: unknown };
    if (typeof data?.error === "string" && data.error.trim()) return data.error;
  } catch {
    // Not JSON: use the fallback.
  }
  return fallback;
}

/** A row action that PATCHes one inbox item, then refreshes the list it belongs to. */
function InboxAction({
  url,
  body,
  label,
  busyLabel,
  itemLabel,
  failure,
}: {
  url: string;
  body: Record<string, unknown>;
  label: string;
  busyLabel: string;
  itemLabel: string;
  failure: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const busy = loading || refreshing;

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setError(await readError(response, failure));
        return;
      }
      startRefresh(() => router.refresh());
    } catch {
      setError(`${failure} Check your connection and try again.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        tone="secondary"
        className="px-3"
        disabled={busy}
        aria-label={`${label}: ${itemLabel}`}
        onClick={() => void run()}
      >
        <Check aria-hidden="true" className="h-4 w-4" />
        {busy ? busyLabel : label}
      </Button>
      {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}
    </div>
  );
}

export function ResolveCommentButton({
  albumId,
  commentId,
  itemLabel = "comment",
}: {
  albumId: string;
  commentId: string;
  itemLabel?: string;
}) {
  return (
    <InboxAction
      url={`/api/albums/${albumId}/comments/${commentId}`}
      body={{ action: "resolve" }}
      label="Resolve"
      busyLabel="Resolving…"
      itemLabel={itemLabel}
      failure="Couldn't resolve this comment."
    />
  );
}

export function CompleteTaskButton({
  albumId,
  taskId,
  itemLabel = "task",
}: {
  albumId: string;
  taskId: string;
  itemLabel?: string;
}) {
  return (
    <InboxAction
      url={`/api/albums/${albumId}/tasks/${taskId}`}
      body={{ status: "done" }}
      label="Mark done"
      busyLabel="Marking done…"
      itemLabel={itemLabel}
      failure="Couldn't mark this task done."
    />
  );
}
