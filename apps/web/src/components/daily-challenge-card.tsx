"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, type FormEvent, type Ref } from "react";

import { RelativeTime } from "@/components/relative-time";
import { Button, Field, LiveStatus, Panel, selectClass, textareaClass } from "@/components/ui";
import type { DailyChallenge } from "@/server/challenges";

const MIN_NOTE = 10;

export type ChallengeAlbumOption = {
  id: string;
  title: string;
  tracks: Array<{ number: number; title: string }>;
};

/** The album (and optionally the track) an entry was written for. */
export type ChallengeLink = { albumId: string; trackNumber: number | null };

/** The server's limit on a challenge note. */
const NOTE_MAX = 800;

function pad(n: number) {
  return String(n).padStart(2, "0");
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
 * Today's prompt as a small form: pick the album (and optionally the track) it was written
 * in, say what you drafted, and send it. The credits are paid for writing the album shows:
 * the server checks that the linked track (or album) has lyrics written today (UTC). When it
 * doesn't, the note is saved with no credits, the reason is said in one line, and the form
 * stays open to check again once the writing is in.
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
  /** The workspace's albums, newest first, for the "Written in" choice. */
  albums: ChallengeAlbumOption[];
}) {
  const router = useRouter();
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [albumId, setAlbumId] = useState(completion?.link?.albumId ?? "");
  const [trackNumber, setTrackNumber] = useState(
    completion?.link?.trackNumber ? String(completion.link.trackNumber) : "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "neutral" | "danger"; text: string } | null>(null);
  const [justLinked, setJustLinked] = useState<ChallengeLink | null>(null);
  const [justEarned, setJustEarned] = useState(false);
  const writtenForRef = useRef<HTMLAnchorElement>(null);
  const note = noteDraft ?? completion?.note ?? "";
  const done = justEarned || Boolean(completion && completion.creditsEarned > 0);
  const remaining = Math.max(0, MIN_NOTE - note.trim().length);
  const selectedAlbum = albums.find((album) => album.id === albumId) ?? null;
  const link = done ? (justLinked ?? completion?.link ?? null) : null;
  const canSend = !done && remaining === 0 && Boolean(selectedAlbum);

  // The send button goes once the credits are earned: focus moves to what replaced it, the
  // link to where it was written, after the commit (never left on the page body).
  useLayoutEffect(() => {
    if (justEarned) writtenForRef.current?.focus();
  }, [justEarned]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting || !canSend || !selectedAlbum) return;
    setSubmitting(true);
    setStatus(null);
    const chosen: ChallengeLink = {
      albumId: selectedAlbum.id,
      trackNumber: trackNumber ? Number(trackNumber) : null,
    };
    try {
      const response = await fetch("/api/challenges/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          challengeKey: challenge.key,
          notes: note.trim(),
          albumId: chosen.albumId,
          ...(chosen.trackNumber ? { trackNumber: chosen.trackNumber } : {}),
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: unknown; credited?: unknown; reason?: unknown }
        | null;
      if (!response.ok) {
        throw new Error(
          typeof body?.error === "string" && body.error
            ? body.error
            : "The entry wasn't saved. Try again in a moment.",
        );
      }
      if (body?.credited === false) {
        setStatus({
          tone: "neutral",
          text:
            typeof body.reason === "string" && body.reason
              ? body.reason
              : "Note saved, no credits yet: the lyrics written today didn't show on the album. Write them in the Studio, then check again.",
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
        text: err instanceof Error ? err.message : "The entry wasn't saved. Try again in a moment.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const savedWithoutCredits = !done && Boolean(completion);
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
        . A new prompt arrives at 00:00 UTC.
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
        ) : (
          <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
            {!done ? (
              <div className="flex flex-wrap gap-x-4 gap-y-4">
                <Field
                  htmlFor="challenge-album"
                  label="Written in"
                  hint="Credits are paid when this album (or the track you choose) has lyrics written today, UTC."
                  className="min-w-0 flex-1 basis-56"
                >
                  <select
                    id="challenge-album"
                    value={albumId}
                    required
                    onChange={(event) => {
                      setAlbumId(event.target.value);
                      setTrackNumber("");
                    }}
                    className={selectClass}
                  >
                    <option value="" disabled>
                      Choose an album
                    </option>
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
                      value={trackNumber}
                      onChange={(event) => setTrackNumber(event.target.value)}
                      className={selectClass}
                    >
                      <option value="">Any track</option>
                      {selectedAlbum.tracks.map((track) => (
                        <option key={track.number} value={String(track.number)}>
                          {pad(track.number)} {track.title}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : null}
              </div>
            ) : null}

            {done ? (
              // Once the credits are paid the entry is final: the note reads as saved text, not
              // a field that looks editable (no box, no resize handle), with a line saying so.
              <div className="flex flex-col gap-1.5">
                <h3 className="text-sm font-semibold text-ink">
                  What you wrote
                </h3>
                <p className="max-w-[65ch] whitespace-pre-line break-words border-l-2 border-line-strong pl-3 text-sm leading-relaxed text-ink"
                >
                  {note}
                </p>
                <p className="max-w-[65ch] text-xs leading-relaxed text-ink-3">
                  Today&apos;s entry is complete, so its note can&apos;t be changed. Tomorrow&apos;s
                  prompt gets a fresh one.
                </p>
              </div>
            ) : (
              <Field
                htmlFor="challenge-note"
                label="What did you write?"
                hint={
                  remaining > 0
                    ? `A sentence is enough: what you drafted. ${remaining} more ${remaining === 1 ? "character" : "characters"} to go.`
                    : "A sentence is enough: what you drafted."
                }
              >
                <textarea
                  id="challenge-note"
                  value={note}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  rows={4}
                  maxLength={NOTE_MAX}
                  className={textareaClass}
                  placeholder="e.g. Drafted the chorus and locked a C–Am–F–G loop."
                />
              </Field>
            )}

            {link ? <WrittenFor ref={writtenForRef} link={link} albums={albums} /> : null}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {done ? null : (
                <Button
                  tone="primary"
                  type="submit"
                  busy={submitting}
                  disabled={!submitting && !canSend}
                >
                  {submitting
                    ? "Checking…"
                    : savedWithoutCredits
                      ? `Check again · earn ${challenge.credits} credits`
                      : `${challenge.cta} · earn ${challenge.credits} credits`}
                </Button>
              )}
              {settledLine ? <p className="text-sm text-ok">{settledLine}</p> : null}
              <LiveStatus message={status?.text ?? null} tone={status?.tone} className="max-w-[65ch]" />
            </div>
            {savedWithoutCredits && !status ? (
              <p className="max-w-[65ch] text-sm text-ink-2">
                Your note is saved without credits: the album didn&apos;t show lyrics written
                today yet. Write them in the Studio, then check again.
              </p>
            ) : null}
            {savedWithoutCredits && selectedAlbum ? (
              <Link
                href={`/app/albums/${selectedAlbum.id}/studio${trackNumber ? `?song=${trackNumber}&focus=lyrics` : ""}`}
                className="inline-flex min-h-11 items-center self-start break-words text-sm font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
              >
                Open {selectedAlbum.title} in the Studio
              </Link>
            ) : null}
          </form>
        )}
      </section>
    </Panel>
  );
}
