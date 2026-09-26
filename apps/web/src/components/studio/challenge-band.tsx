"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { Button, IconButton, LiveStatus } from "@/components/ui";
import type { DailyChallenge } from "@/server/challenges";

/** The prompt's text, which the lyrics field names as part of its description while pinned. */
export const CHALLENGE_PROMPT_ID = "studio-challenge-prompt";
/** The band's Hide button, where focus lands once a claim has paid (the claim button goes). */
const HIDE_ID = "studio-challenge-hide";

type Phase = "opening" | "open" | "done" | "ended";
type Status = { tone: "ok" | "neutral" | "danger"; text: string };

/**
 * What the claim's response says, as the band shows it: paid (done), not yet (the reason, the
 * claim stays), or an error to say. "Already completed today." is a claim made elsewhere first.
 */
export function claimOutcome(
  ok: boolean,
  body: { error?: unknown; credited?: unknown; reason?: unknown } | null,
  credits: number,
): { phase: Phase | null; status: Status | null } {
  if (!ok) {
    const error = typeof body?.error === "string" && body.error ? body.error : null;
    if (error && /already completed today/i.test(error)) {
      return { phase: "done", status: { tone: "ok", text: "Done for today: this challenge's credits were already added." } };
    }
    if (error && /not active today/i.test(error)) {
      // The band's own line says so, with the way to today's.
      return { phase: "ended", status: null };
    }
    return { phase: null, status: { tone: "danger", text: error ?? "The claim didn't go through. Try again in a moment." } };
  }
  if (body?.credited === false) {
    const reason =
      typeof body.reason === "string" && body.reason
        ? body.reason
        : "No credits yet: the lyrics written today don't show on this track. Write something new, then claim again.";
    return { phase: null, status: { tone: "neutral", text: reason } };
  }
  return { phase: "done", status: { tone: "ok", text: `Done for today: ${credits} credits added to your workspace.` } };
}

/**
 * Today's challenge, pinned above the lyrics while the artist writes it (the Challenges page's
 * "Take the challenge" opens the Studio with `?challenge=<key>`). A quiet band, not a panel:
 * a hairline on its start edge, the prompt in one paragraph, and one row that says how the
 * credits come or offers the claim. That row keeps its 44px whether it holds words or the
 * button, so the lyrics below never move when the claim appears mid-sentence.
 *
 * Opening it records where the album's lyrics stand (`/api/challenges/open`), so what is
 * written from here is what pays. The claim saves anything unsaved first, then asks the server
 * (`/api/challenges/complete`), which checks the lyrics written today against that baseline;
 * it is offered once the track on screen has written lyrics. Hide drops it (and the address
 * parameter); the Challenges page still has the prompt.
 */
export function ChallengeBand({
  challenge,
  albumId,
  trackNumber,
  trackWritten,
  beforeClaim,
  onClaimed,
  onHide,
}: {
  challenge: DailyChallenge;
  albumId: string;
  /** The track on screen: the claim is for it. */
  trackNumber: number | null;
  /** Whether that track has written lyrics (`@/lib/lyrics`): only then is the claim offered. */
  trackWritten: boolean;
  /** Saves what is unsaved; resolves false when the save failed. */
  beforeClaim: () => Promise<boolean>;
  /** A claim paid: the frame (the credits meter) refreshes. */
  onClaimed: () => void;
  onHide: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("opening");
  const [todayTitle, setTodayTitle] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  // The claim button went (paid, or the day's claim was made elsewhere): focus goes to Hide.
  const [claimGone, setClaimGone] = useState(false);
  // A "not yet" about one track is dropped when another track comes on screen.
  const [statusTrack, setStatusTrack] = useState(trackNumber);
  if (statusTrack !== trackNumber) {
    setStatusTrack(trackNumber);
    if (status?.tone !== "ok") setStatus(null);
  }
  const hideRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/challenges/open", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ challengeKey: challenge.key, albumId }),
        });
        const body = (await response.json().catch(() => null)) as
          | { active?: unknown; done?: unknown; todayTitle?: unknown }
          | null;
        if (cancelled) return;
        if (typeof body?.todayTitle === "string") setTodayTitle(body.todayTitle);
        // Unreachable or refused: the claim still asks the server, which decides.
        setPhase(!response.ok ? "open" : body?.active === false ? "ended" : body?.done ? "done" : "open");
      } catch {
        if (!cancelled) setPhase("open");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [albumId, challenge.key]);

  // The claim button goes once it has paid: focus moves to the band's Hide, after the commit.
  useLayoutEffect(() => {
    if (claimGone) hideRef.current?.focus();
  }, [claimGone]);

  async function claim() {
    if (claiming) return;
    setClaiming(true);
    setStatus(null);
    try {
      if (!(await beforeClaim())) {
        setStatus({
          tone: "danger",
          text: "The latest lyrics aren't saved yet, so they can't be checked. Save, then claim again.",
        });
        return;
      }
      const response = await fetch("/api/challenges/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          challengeKey: challenge.key,
          albumId,
          ...(trackNumber ? { trackNumber } : {}),
          from: "studio",
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: unknown; credited?: unknown; reason?: unknown }
        | null;
      const outcome = claimOutcome(response.ok, body, challenge.credits);
      if (outcome.phase) {
        setPhase(outcome.phase);
        setClaimGone(true);
      }
      setStatus(outcome.status);
      if (response.ok && body?.credited !== false) onClaimed();
    } catch {
      setStatus({ tone: "danger", text: "The claim didn't go through: check your connection, then claim again." });
    } finally {
      setClaiming(false);
    }
  }

  const credits = `${challenge.credits} credits`;
  const claimable = phase === "open" && trackWritten;

  return (
    <div
      role="group"
      aria-labelledby="studio-challenge-title"
      className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-2 border-l-2 border-line-strong pl-3"
    >
      <p className="min-w-0 max-w-[65ch] pt-2.5 text-sm leading-relaxed text-ink-2">
        <strong id="studio-challenge-title" className="font-semibold text-ink">
          Today’s challenge: {challenge.title}.
        </strong>{" "}
        <span id={CHALLENGE_PROMPT_ID}>{challenge.description}</span>
      </p>
      <IconButton id={HIDE_ID} ref={hideRef} label="Hide today’s challenge" onClick={onHide} className="-mr-2">
        <X className="h-4 w-4" aria-hidden="true" />
      </IconButton>
      <div className="col-span-2 flex min-h-11 min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        {claimable ? (
          <Button tone="secondary" busy={claiming} onClick={() => void claim()} className="-ml-px">
            {claiming ? "Checking…" : `Claim ${credits}`}
          </Button>
        ) : phase === "done" ? (
          // Said once: after a claim here, the live line below says it instead.
          status ? null : (
            <p className="min-w-0 max-w-[65ch] text-sm text-ok">Done for today. A new prompt comes at 00:00 UTC.</p>
          )
        ) : phase === "ended" ? (
          <p className="min-w-0 max-w-[65ch] text-sm text-ink-2">
            This challenge was for another day
            {todayTitle ? <>; today’s is “{todayTitle}”</> : null}.{" "}
            <Link
              href="/app/challenges"
              className="inline-flex min-h-11 items-center font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
            >
              Open Challenges
            </Link>
          </p>
        ) : (
          <p className="min-w-0 max-w-[65ch] text-xs leading-relaxed text-ink-3">
            Claim the {credits} here once this track has lyrics written today.
          </p>
        )}
        <LiveStatus message={status?.text ?? null} tone={status?.tone} className="min-w-0 max-w-[65ch]" />
      </div>
    </div>
  );
}
