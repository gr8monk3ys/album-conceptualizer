"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, type Ref } from "react";

import { RelativeTime } from "@/components/relative-time";
import { Button, ButtonLink, Field, LiveStatus, Panel, selectClass } from "@/components/ui";
import { challengeStudioHref, type DailyChallenge } from "@/server/challenges";

export type ChallengeAlbumOption = {
  id: string;
  title: string;
  /** In sequence; `written` when the track already has written lyrics (`@/lib/lyrics`). */
  tracks: Array<{ number: number; title: string; written?: boolean }>;
};

/** The album (and optionally the track) an entry was written for. */
export type ChallengeLink = { albumId: string; trackNumber: number | null };

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Where a new challenge is best written: the first track with no lyrics yet, else the first. */
export function suggestedTrack(album: ChallengeAlbumOption | null | undefined): number | null {
  if (!album?.tracks.length) return null;
  return (album.tracks.find((track) => !track.written) ?? album.tracks[0]).number;
}

/** Where a completed challenge was written: the album (and track) it links back to. */
function WrittenFor({
  link,
  albums,
  ref,
}: {
  link: ChallengeLink;
  albums: ChallengeAlbumOption[];
  ref?: Ref<HTMLAnchorElement>;
}) {
  const album = albums.find((option) => option.id === link.albumId);
  if (!album) return null;
  const track = link.trackNumber ? album.tracks.find((t) => t.number === link.trackNumber) : undefined;
  const href = `/app/albums/${album.id}/studio${track ? `?song=${track.number}` : ""}`;
  return (
    <p className="max-w-[65ch] text-sm text-ink-2">
      Written in{" "}
      <Link
        ref={ref}
        href={href}
        className="inline-flex min-h-11 items-center break-words font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
      >
        {album.title}
        {track ? ` · ${pad(track.number)} ${track.title}` : ""}
      </Link>
    </p>
  );
}

/**
 * Today's prompt, and the way into writing it. Choose the album and track, then "Take the
 * challenge" opens that track in the Studio with the prompt pinned above its lyrics, where
 * the credits are claimed once the lyrics are written (the Studio's challenge band). The
 * credits are paid for writing the album shows: the server checks that the track has lyrics
 * written today (UTC), measured against where its lyrics stood before (the day's baseline).
 *
 * For writing already done today, "Claim" asks the same check from here for the chosen track;
 * when it doesn't pay yet, the reason is said in one line and the claim can be made again.
 */
export function DailyChallengeCard({
  day,
  challenge,
  completion,
  albums,
}: {
  day: string;
  challenge: DailyChallenge;
  /** Today's saved entry, if any: with credits it is final; at 0 it can be checked again. */
  completion: {
    note: string;
    link: ChallengeLink | null;
    time: string;
    creditsEarned: number;
  } | null;
  /** The workspace's albums, most recently edited first. */
  albums: ChallengeAlbumOption[];
}) {
  const router = useRouter();
  // The album last edited (or the one a saved entry names) is where writing most likely goes.
  const [albumId, setAlbumId] = useState(completion?.link?.albumId ?? albums[0]?.id ?? "");
  const selectedAlbum = albums.find((album) => album.id === albumId) ?? null;
  const [trackChoice, setTrackChoice] = useState<string>(() => {
    const saved = completion?.link?.trackNumber;
    const initial = saved ?? suggestedTrack(albums.find((album) => album.id === albumId));
    return initial ? String(initial) : "";
  });
  const trackNumber = trackChoice ? Number(trackChoice) : null;
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "neutral" | "danger"; text: string } | null>(null);
  const [justLinked, setJustLinked] = useState<ChallengeLink | null>(null);
  const [justEarned, setJustEarned] = useState(false);
  const writtenForRef = useRef<HTMLAnchorElement>(null);
  const done = justEarned || Boolean(completion && completion.creditsEarned > 0);
  const link = done ? (justLinked ?? completion?.link ?? null) : null;
  const savedWithoutCredits = !done && Boolean(completion);
  const note = completion?.note?.trim() ?? "";

  // The claim goes once the credits are earned: focus moves to what replaced it, the link to
  // where it was written, after the commit (never left on the page body).
  useLayoutEffect(() => {
    if (justEarned) writtenForRef.current?.focus();
  }, [justEarned]);

  async function claim() {
    if (submitting || done || !selectedAlbum) return;
    setSubmitting(true);
    setStatus(null);
    const chosen: ChallengeLink = { albumId: selectedAlbum.id, trackNumber };
    try {
      const response = await fetch("/api/challenges/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          challengeKey: challenge.key,
          albumId: chosen.albumId,
          ...(chosen.trackNumber ? { trackNumber: chosen.trackNumber } : {}),
          from: "page",
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: unknown; credited?: unknown; reason?: unknown }
        | null;
      if (!response.ok) {
        throw new Error(
          typeof body?.error === "string" && body.error
            ? body.error
            : "The claim didn't go through. Try again in a moment.",
        );
      }
      if (body?.credited === false) {
        setStatus({
          tone: "neutral",
          text:
            typeof body.reason === "string" && body.reason
              ? body.reason
              : "No credits yet: the lyrics written today don't show on the album. Write them in the Studio, then check again.",
        });
      } else {
        setJustLinked(chosen);
        setJustEarned(true);
        setStatus({ tone: "ok", text: `Done for today. ${challenge.credits} credits added to your workspace.` });
      }
      // Refresh the server-rendered credit balance and streak without losing this message.
      router.refresh();
    } catch (err) {
      setStatus({
        tone: "danger",
        text: err instanceof Error ? err.message : "The claim didn't go through. Try again in a moment.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const settledLine =
    done && !justEarned ? (
      <>
        Done for today
        {completion?.time ? (
          <>
            {" "}
            (<RelativeTime date={completion.time} />)
          </>
        ) : null}
        .
      </>
    ) : null;

  return (
    <Panel>
      <section aria-labelledby="challenge-title">
        <h2 id="challenge-title" className="text-lg font-semibold text-ink">
          {challenge.title}
        </h2>
        <p className="type-catalog mt-1 text-xs text-ink-2">
          <time dateTime={day} className="type-figure">
            {day}
          </time>
          <span aria-hidden="true"> · </span>
          <span className="type-figure">{challenge.credits}</span> credits
          {/* The one place the card names the clock: "today" everywhere below means this day. */}
          <span aria-hidden="true"> · </span>
          New prompt at <span className="type-figure">00:00</span> UTC
        </p>
        <p className="mt-3 max-w-[65ch] text-sm leading-relaxed text-ink">{challenge.description}</p>

        {!albums.length && !done ? (
          <p className="mt-5 max-w-[65ch] text-sm leading-relaxed text-ink-2">
            A challenge is written in an album, and the credits come when its lyrics show the
            writing.{" "}
            <Link
              href="/app/create"
              className="inline-flex min-h-11 items-center font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
            >
              Create an album
            </Link>{" "}
            first, then come back.
          </p>
        ) : done ? (
          <div className="mt-5 flex flex-col gap-4">
            {note ? (
              // Once the credits are paid the entry is final: the note reads as saved text.
              <div className="flex flex-col gap-1.5">
                <h3 className="text-sm font-semibold text-ink">What you wrote</h3>
                <p className="max-w-[65ch] whitespace-pre-line break-words border-l-2 border-line-strong pl-3 text-sm leading-relaxed text-ink">
                  {note}
                </p>
              </div>
            ) : null}
            {link ? <WrittenFor ref={writtenForRef} link={link} albums={albums} /> : null}
            {settledLine ? <p className="text-sm text-ok">{settledLine}</p> : null}
            <p className="max-w-[65ch] text-xs leading-relaxed text-ink-3">
              Today&apos;s challenge is complete. Tomorrow&apos;s prompt comes at 00:00 UTC.
            </p>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-4">
            <div className="flex flex-wrap gap-x-4 gap-y-4">
              <Field htmlFor="challenge-album" label="Write it in" className="min-w-0 flex-1 basis-56">
                <select
                  id="challenge-album"
                  value={albumId}
                  onChange={(event) => {
                    setAlbumId(event.target.value);
                    const next = suggestedTrack(albums.find((album) => album.id === event.target.value));
                    setTrackChoice(next ? String(next) : "");
                    setStatus(null);
                  }}
                  className={selectClass}
                >
                  {albums.map((album) => (
                    <option key={album.id} value={album.id}>
                      {album.title}
                    </option>
                  ))}
                </select>
              </Field>
              {selectedAlbum && selectedAlbum.tracks.length ? (
                <Field htmlFor="challenge-track" label="Track" className="min-w-0 flex-1 basis-56">
                  <select
                    id="challenge-track"
                    value={trackChoice}
                    onChange={(event) => {
                      setTrackChoice(event.target.value);
                      setStatus(null);
                    }}
                    className={selectClass}
                  >
                    {selectedAlbum.tracks.map((track) => (
                      <option key={track.number} value={String(track.number)}>
                        {pad(track.number)} {track.title}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
            </div>

            {selectedAlbum ? (
              <div className="flex flex-col gap-1.5">
                <div>
                  <ButtonLink tone="primary" href={challengeStudioHref(selectedAlbum.id, challenge.key, trackNumber)}>
                    Take the challenge
                  </ButtonLink>
                </div>
                <p className="max-w-[65ch] text-xs leading-relaxed text-ink-3">
                  Opens the track in the Studio with this prompt above its lyrics. Claim the{" "}
                  {challenge.credits} credits there once they&apos;re written.
                </p>
              </div>
            ) : null}

            {/* For writing already done today: the same check, asked from here. */}
            <div className="flex flex-col gap-2 border-t border-line pt-4">
              {/* Said once: after a check, the status line below gives the reason instead. */}
              {savedWithoutCredits && status ? null : (
                <p className="max-w-[65ch] text-sm text-ink-2">
                  {savedWithoutCredits
                    ? "Your entry is saved without credits: the album didn't show lyrics written today yet. Once they're in, check again."
                    : "Already written it today? Claim the credits for the track above."}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Button tone="secondary" onClick={() => void claim()} busy={submitting}>
                  {submitting
                    ? "Checking…"
                    : savedWithoutCredits
                      ? `Check again · earn ${challenge.credits} credits`
                      : `Claim ${challenge.credits} credits`}
                </Button>
              </div>
            </div>
          </div>
        )}
        {/* One status for the card, mounted whatever it shows, so a claim that pays is said
            even though the claim itself gives way to where it was written. */}
        <LiveStatus message={status?.text ?? null} tone={status?.tone} className="mt-3 max-w-[65ch]" />
      </section>
    </Panel>
  );
}
