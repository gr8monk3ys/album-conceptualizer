"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Heart, Shuffle } from "lucide-react";

import { ConfirmSpend } from "@/components/confirm-spend";
import { Button, ButtonLink, StatusMessage } from "@/components/ui";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { cn } from "@/lib/utils";

/** The server's human-written `error`, or a plain fallback. Never a raw body or status code. */
async function readApiError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string" && body.error.trim() ? body.error : fallback;
}

function likesLabel(count: number) {
  return `${count} ${count === 1 ? "like" : "likes"}`;
}

/**
 * A Like toggle (aria-pressed) with the album's like count beside it. In a list, pass
 * `albumTitle` so each toggle's accessible name says which album it likes.
 */
export function LikeToggle({
  albumId,
  albumTitle,
  initialLiked,
  initialLikes,
  onError,
}: {
  albumId: string;
  albumTitle?: string;
  initialLiked: boolean;
  initialLikes: number;
  onError: (message: string | null) => void;
}) {
  const [state, setState] = useState({ liked: initialLiked, likes: initialLikes });
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    onError(null);
    try {
      const response = await fetch(`/api/albums/${albumId}/like`, {
        method: state.liked ? "DELETE" : "POST",
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Your like didn't save. Try again."));
      }
      const payload = (await response.json().catch(() => null)) as
        | { liked?: boolean; likes?: number }
        | null;
      setState((current) => ({
        liked: Boolean(payload?.liked),
        likes: typeof payload?.likes === "number" ? payload.likes : current.likes,
      }));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Your like didn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button tone="secondary" aria-pressed={state.liked} onClick={toggle} disabled={busy}>
        <Heart className={cn("h-4 w-4", state.liked && "fill-current")} aria-hidden="true" />
        {state.liked ? "Liked" : "Like"}
        {albumTitle ? <span className="sr-only"> {albumTitle}</span> : null}
      </Button>
      <span className="type-figure min-w-[4.5rem] text-sm text-ink-2">{likesLabel(state.likes)}</span>
    </div>
  );
}

/**
 * Remix: copies a published album into the viewer's workspace as a new private album and
 * opens it in the Studio. It spends credits, so it asks once (cost and balance after) before
 * spending. In a list, pass `albumTitle` so each button's accessible name says which album it
 * remixes.
 */
export function RemixButton({
  albumId,
  albumTitle,
  tone = "secondary",
  creditsRemaining,
  onError,
}: {
  albumId: string;
  albumTitle?: string;
  tone?: "primary" | "secondary";
  creditsRemaining: number;
  onError: (message: string | null) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const cost = CREDIT_COSTS.albumFork;
  const cannotAfford = creditsRemaining < cost;

  async function remix() {
    setBusy(true);
    onError(null);
    try {
      const response = await fetch(`/api/albums/${albumId}/fork`, { method: "POST" });
      if (!response.ok) {
        throw new Error(await readApiError(response, "The remix didn't go through. Try again."));
      }
      const payload = (await response.json().catch(() => null)) as { id?: string } | null;
      if (!payload?.id) {
        router.refresh();
        throw new Error("The remix was created but couldn't be opened. Find it in your Library.");
      }
      // Open the new album, then refresh so the workspace chrome (the credits meter) re-renders
      // with the spent credits. The order matters: a navigation discards a refresh that is
      // still pending, while a refresh queued after it runs once the album has opened.
      router.push(`/app/albums/${payload.id}/studio`);
      router.refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : "The remix didn't go through. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <ConfirmSpend
        cost={cost}
        remaining={creditsRemaining}
        actionLabel="Remix"
        onConfirm={remix}
        busy={busy}
        disabled={cannotAfford}
        tone={tone}
      >
        <Shuffle className="h-4 w-4" aria-hidden="true" />
        {busy ? "Remixing…" : "Remix"}
        {albumTitle ? <span className="sr-only"> {albumTitle}</span> : null}
        {busy ? null : ` · ${cost} credits`}
      </ConfirmSpend>
      {cannotAfford ? (
        <p className="max-w-[65ch] text-xs text-ink-2">
          You have {creditsRemaining} {creditsRemaining === 1 ? "credit" : "credits"}.{" "}
          <Link href="/app/challenges" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-ink">
            Earn more
          </Link>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Your own published album needs no remix: this opens it in the Studio and spends nothing.
 * In a list, pass `albumTitle` so the link's accessible name says which album it opens.
 */
export function OpenInStudioLink({
  albumId,
  albumTitle,
  tone = "secondary",
}: {
  albumId: string;
  albumTitle?: string;
  tone?: "primary" | "secondary";
}) {
  return (
    <ButtonLink tone={tone} href={`/app/albums/${albumId}/studio`}>
      Open in Studio
      {albumTitle ? <span className="sr-only"> ({albumTitle})</span> : null}
    </ButtonLink>
  );
}

/**
 * Like and Remix for the Discover album page, where Remix is the page's primary action. On the
 * viewer's own album, Remix gives way to "Open in Studio".
 */
export function DiscoverAlbumActions({
  albumId,
  initialLiked,
  initialLikes,
  creditsRemaining,
  isOwn,
}: {
  albumId: string;
  initialLiked: boolean;
  initialLikes: number;
  creditsRemaining: number;
  isOwn: boolean;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-start gap-3">
        <LikeToggle
          albumId={albumId}
          initialLiked={initialLiked}
          initialLikes={initialLikes}
          onError={setError}
        />
        {isOwn ? (
          <OpenInStudioLink albumId={albumId} tone="primary" />
        ) : (
          <RemixButton
            albumId={albumId}
            tone="primary"
            creditsRemaining={creditsRemaining}
            onError={setError}
          />
        )}
      </div>
      {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}
    </div>
  );
}
