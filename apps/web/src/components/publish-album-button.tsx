"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Globe2, Lock } from "lucide-react";

import { ReadinessList } from "@/components/album-readiness";
import { Button, LiveStatus } from "@/components/ui";
import { useReturnFocus } from "@/components/use-return-focus";
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
  const router = useRouter();
  const [publicOverride, setPublicOverride] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const isPublic = publicOverride ?? initialPublic;
  const promptId = useId();
  const groupId = useId();
  const returnFocus = useReturnFocus();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  function cancel() {
    setConfirming(false);
    returnFocus(() => triggerRef.current);
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
      // The release header's catalog line reads the status ("Draft" / "Published · On
      // Discover"); re-render the server layout so it changes here, not on the next reload.
      router.refresh();
    } catch (err) {
      setStatus({
        tone: "danger",
        text: err instanceof Error ? err.message : "The album's Discover status didn't change.",
      });
    } finally {
      setBusy(false);
      // The confirm closes; focus goes back to the button it replaced once that has committed,
      // and stays there through the refresh above (never dropped to the page).
      setConfirming(false);
      returnFocus(() => triggerRef.current);
    }
  }

  // Publishing an unfinished album asks once; unpublishing never does.
  const needsConfirm = !isPublic && readiness && !readiness.ready;

  return (
    <div className="flex flex-col gap-2">
      {confirming && readiness ? (
        <div
          id={groupId}
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
            <Button ref={confirmRef} onClick={() => void toggle()} busy={busy}>
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
            busy={busy}
            // Like Confirm Spend: a disclosure of the question in its place, not a menu.
            aria-expanded={needsConfirm ? false : undefined}
            aria-controls={needsConfirm ? groupId : undefined}
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
      {/* Always mounted, so the result is announced when it arrives. */}
      <LiveStatus message={status?.text ?? null} tone={status?.tone} />
    </div>
  );
}
