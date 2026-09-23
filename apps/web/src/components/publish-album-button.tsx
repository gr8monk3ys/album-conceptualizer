"use client";

import { useState } from "react";
import { Globe2, Lock } from "lucide-react";

import { Button, StatusMessage } from "@/components/ui";

async function errorFrom(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string" && body.error ? body.error : fallback;
}

/** Puts the album on Discover, where others can find and remix it, or takes it off. */
export function PublishAlbumButton({
  albumId,
  initialPublic,
}: {
  albumId: string;
  initialPublic: boolean;
}) {
  const [publicOverride, setPublicOverride] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const isPublic = publicOverride ?? initialPublic;

  async function toggle() {
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/albums/${albumId}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isPublic: !isPublic }),
      });
      if (!response.ok) {
        throw new Error(
          await errorFrom(response, "The album's Discover status didn't change. Try again in a moment."),
        );
      }
      const payload = (await response.json().catch(() => null)) as { isPublic?: boolean } | null;
      setPublicOverride(Boolean(payload?.isPublic));
      setStatus({
        tone: "ok",
        text: payload?.isPublic ? "Published to Discover." : "Taken off Discover. The album is private again.",
      });
    } catch (err) {
      setStatus({
        tone: "danger",
        text: err instanceof Error ? err.message : "The album's Discover status didn't change.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void toggle()} disabled={busy} aria-busy={busy || undefined}>
          {isPublic ? (
            <Lock className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Globe2 className="h-4 w-4" aria-hidden="true" />
          )}
          {busy ? (isPublic ? "Unpublishing…" : "Publishing…") : isPublic ? "Unpublish" : "Publish"}
        </Button>
        <p className="min-w-0 max-w-[65ch] text-sm text-ink-2">
          {isPublic
            ? "On Discover: anyone signed in can find it and remix it."
            : "Private: only you, and anyone you send a share link, can open it."}
        </p>
      </div>
      {status ? <StatusMessage tone={status.tone}>{status.text}</StatusMessage> : null}
    </div>
  );
}
