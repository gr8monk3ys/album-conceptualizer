"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { RelativeTime } from "@/components/relative-time";
import { Button, Field, Panel, StatusMessage, selectClass, textareaClass } from "@/components/ui";
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
function WrittenFor({ link, albums }: { link: ChallengeLink; albums: ChallengeAlbumOption[] }) {
  const album = albums.find((option) => option.id === link.albumId);
  if (!album) return null;
  const track = link.trackNumber ? album.tracks.find((t) => t.number === link.trackNumber) : undefined;
  const href = `/app/albums/${album.id}/studio${track ? `?song=${track.number}` : ""}`;
  return (
    <p className="max-w-[65ch] text-sm text-ink-2">
      Written for{" "}
      <Link
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
 * Today's prompt as a small form: say what you drafted, optionally pick the album and track
 * it was written for (the completion then links back to it), and mark it done.
 */
export function DailyChallengeCard({
  day,
  challenge,
  completed,
  completionNote,
  completionLink,
  completionTime,
  albums,
}: {
  day: string;
  challenge: DailyChallenge;
  completed: boolean;
  /** The note saved with today's completion. */
  completionNote: string | null;
  completionLink: ChallengeLink | null;
  completionTime: string | null;
  /** The workspace's albums, newest first, for the optional "Written for" choice. */
  albums: ChallengeAlbumOption[];
}) {
  const router = useRouter();
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [albumId, setAlbumId] = useState("");
  const [trackNumber, setTrackNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justLinked, setJustLinked] = useState<ChallengeLink | null>(null);
  const [justCompleted, setJustCompleted] = useState(false);
  const note = noteDraft ?? completionNote ?? "";
  const done = justCompleted || completed;
  const remaining = Math.max(0, MIN_NOTE - note.trim().length);
  const selectedAlbum = albums.find((album) => album.id === albumId) ?? null;
  const link = done ? (justLinked ?? completionLink) : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (done || remaining > 0) return;
    setSubmitting(true);
    setError(null);
    const chosen: ChallengeLink | null = selectedAlbum
      ? { albumId: selectedAlbum.id, trackNumber: trackNumber ? Number(trackNumber) : null }
      : null;
    try {
      const response = await fetch("/api/challenges/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          challengeKey: challenge.key,
          notes: note.trim(),
          ...(chosen ? { albumId: chosen.albumId } : {}),
          ...(chosen?.trackNumber ? { trackNumber: chosen.trackNumber } : {}),
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
        throw new Error(
          typeof body?.error === "string" && body.error
            ? body.error
            : "The challenge wasn't marked complete. Try again in a moment.",
        );
      }
      setJustLinked(chosen);
      setJustCompleted(true);
      // Refresh the server-rendered credit balance and streak without losing this message.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The challenge wasn't marked complete. Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel>
      <section aria-labelledby="challenge-title">
        <h2 id="challenge-title" className="type-display text-2xl text-ink">
          {challenge.title}
        </h2>
        <p className="type-catalog mt-2 text-xs text-ink-2">
          <time dateTime={day} className="type-figure">
            {day}
          </time>
          <span aria-hidden="true"> · </span>
          <span className="type-figure">{challenge.credits}</span> credits
        </p>
        <p className="mt-3 max-w-[65ch] text-sm leading-relaxed text-ink">{challenge.description}</p>

        <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
          {!done && albums.length ? (
            <div className="flex flex-wrap gap-x-4 gap-y-4">
              <Field
                htmlFor="challenge-album"
                label="Written for (optional)"
                hint="The album you wrote it in. Today's entry links back to it."
                className="min-w-0 flex-1 basis-56"
              >
                <select
                  id="challenge-album"
                  value={albumId}
                  onChange={(event) => {
                    setAlbumId(event.target.value);
                    setTrackNumber("");
                  }}
                  aria-describedby="challenge-album-hint"
                  className={selectClass}
                >
                  <option value="">No album</option>
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
                    <option value="">Whole album</option>
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

          <Field
            htmlFor="challenge-note"
            label="What did you write?"
            hint={
              done
                ? "Your note for today."
                : remaining > 0
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
              readOnly={done}
              aria-describedby="challenge-note-hint"
              className={textareaClass}
              placeholder="Drafted the chorus and locked a C–Am–F–G loop."
            />
          </Field>

          {link ? <WrittenFor link={link} albums={albums} /> : null}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {done ? null : (
              <Button tone="primary" type="submit" disabled={submitting || remaining > 0}>
                {submitting ? "Saving…" : `${challenge.cta} · earn ${challenge.credits} credits`}
              </Button>
            )}
            {done ? (
              <StatusMessage tone="ok">
                {justCompleted ? (
                  `Done for today. ${challenge.credits} credits added to your workspace.`
                ) : (
                  <>
                    Done for today
                    {completionTime ? (
                      <>
                        {" "}
                        (<RelativeTime date={completionTime} />)
                      </>
                    ) : null}
                    . A new prompt arrives at 00:00 UTC.
                  </>
                )}
              </StatusMessage>
            ) : null}
            {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}
          </div>
        </form>
      </section>
    </Panel>
  );
}
