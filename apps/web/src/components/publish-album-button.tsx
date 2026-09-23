"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Globe2, Lock } from "lucide-react";

import { ReadinessList } from "@/components/album-readiness";
import { Button, StatusMessage } from "@/components/ui";
import type { AlbumReadiness } from "@/server/readiness";

async function errorFrom(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string" && body.error ? body.error : fallback;
}

/**
 * Puts the album on Discover, where others can find and remix it, or takes it off. When the
 * album isn't finished, Publish asks once ("Publish with 3 of 7 tracks written?") and lists
 * what's open, each item linked to where it's fixed. It informs; it never blocks.
 */
export function PublishAlbumButton({
  albumId,
  initialPublic,
  readiness,
}: {
  albumId: string;
  initialPublic: boolean;
  readiness?: AlbumReadiness;
}) {
  const [publicOverride, setPublicOverride] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const isPublic = publicOverride ?? initialPublic;
  const promptId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  function cancel() {
    setConfirming(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

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
      if (confirming) {
        // The confirm closes; give focus back to the button it replaced.
        setConfirming(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
      }
    }
  }

  // Publishing an unfinished album asks once; unpublishing never does.
  const needsConfirm = !isPublic && readiness && !readiness.ready;

  return (
    <div className="flex flex-col gap-2">
      {confirming && readiness ? (
        <div
          role="group"
          aria-labelledby={promptId}
          className="flex flex-col gap-2"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              cancel();
            }
          }}
        >
          <p id={promptId} className="max-w-[65ch] text-sm font-semibold text-ink">
            {readiness.question}
          </p>
          <p className="max-w-[65ch] text-sm text-ink-2">
            Others will see it as it is now. Still open:
          </p>
          <ReadinessList items={readiness.items} onlyOpen />
          <div className="flex flex-wrap items-center gap-2">
            <Button ref={confirmRef} onClick={() => void toggle()} disabled={busy} aria-busy={busy || undefined}>
              <Globe2 className="h-4 w-4" aria-hidden="true" />
              {busy ? "Publishing…" : "Publish anyway"}
            </Button>
            <Button tone="ghost" onClick={cancel} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            ref={triggerRef}
            onClick={() => (needsConfirm ? setConfirming(true) : void toggle())}
            disabled={busy}
            aria-busy={busy || undefined}
            aria-haspopup={needsConfirm ? "true" : undefined}
          >
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
      )}
      {status ? <StatusMessage tone={status.tone}>{status.text}</StatusMessage> : null}
    </div>
  );
}
