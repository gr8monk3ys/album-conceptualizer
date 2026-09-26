"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Download, Tags } from "lucide-react";

import { Button, StatusMessage, buttonClass } from "@/components/ui";
import {
  TAG_KINDS,
  countTags,
  describeAddedTags,
  isAlbumMatch,
  type TagKind,
  type TrackTagProposal,
  type TrackTags,
} from "@/lib/tag-proposals";

type Status = { tone: "ok" | "danger" | "neutral"; text: string } | null;

const KIND_LABEL: Record<TagKind, { many: string; one: string }> = {
  themes: { many: "Themes", one: "theme" },
  motifs: { many: "Motifs", one: "motif" },
  characters: { many: "Characters", one: "character" },
};

function pad(trackNumber: number) {
  return String(trackNumber).padStart(2, "0");
}

function tagKey(trackNumber: number, kind: TagKind, tag: string) {
  return `${trackNumber}\u0000${kind}\u0000${tag}`;
}

function allKeys(proposals: TrackTagProposal[]) {
  return new Set(
    proposals.flatMap((track) => TAG_KINDS.flatMap((kind) => track[kind].map((tag) => tagKey(track.trackNumber, kind, tag)))),
  );
}

/** The proposals that are the album's own themes, motifs and characters: ticked to start with. */
function albumMatchKeys(proposals: TrackTagProposal[]) {
  return new Set(
    proposals.flatMap((track) =>
      TAG_KINDS.flatMap((kind) =>
        track[kind].filter((tag) => isAlbumMatch(track, kind, tag)).map((tag) => tagKey(track.trackNumber, kind, tag)),
      ),
    ),
  );
}

async function errorFrom(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string" && body.error ? body.error : fallback;
}

/**
 * Suggest tags from the lyrics, or take the Bible away as Markdown or PDF. Tagging never
 * writes on its own: it lists what the lyrics suggest per track as dashed suggestions (the
 * album's own themes, motifs and characters the lyrics mention come first and ticked; any other
 * word is marked "New tag" and left unticked), adds only what the artist ticks, then says
 * exactly what it added.
 */
export function BibleActions({ albumId, className }: { albumId: string; className?: string }) {
  const router = useRouter();
  const headingId = useId();
  const [phase, setPhase] = useState<"idle" | "loading" | "review" | "applying">("idle");
  const [proposals, setProposals] = useState<TrackTagProposal[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Status>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const reviewing = phase === "review" || phase === "applying";

  useEffect(() => {
    if (phase === "review") headingRef.current?.focus();
  }, [phase]);

  function close(nextStatus: Status) {
    setPhase("idle");
    setProposals([]);
    setSelected(new Set());
    setStatus(nextStatus);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  async function suggest() {
    setPhase("loading");
    setStatus(null);
    try {
      const res = await fetch(`/api/albums/${albumId}/autotag`, { cache: "no-store" });
      if (!res.ok) throw new Error(await errorFrom(res, "No tags could be suggested. Try again in a moment."));
      const body = (await res.json()) as { proposals: TrackTagProposal[]; writtenTracks: number };
      if (!body.proposals.length) {
        setPhase("idle");
        setStatus({
          tone: "neutral",
          text: body.writtenTracks
            ? "Nothing new to suggest. Tags come from words and names that repeat in a track's written lyrics, and those are already tagged."
            : "No track has lyrics of its own yet, so there's nothing to tag from. Placeholder lines don't count.",
        });
        return;
      }
      setProposals(body.proposals);
      setSelected(albumMatchKeys(body.proposals));
      setPhase("review");
    } catch (err) {
      setPhase("idle");
      setStatus({
        tone: "danger",
        text: err instanceof Error ? err.message : "No tags could be suggested. Try again in a moment.",
      });
    }
  }

  async function apply() {
    const accept: TrackTags[] = proposals
      .map((track) => ({
        trackNumber: track.trackNumber,
        themes: track.themes.filter((tag) => selected.has(tagKey(track.trackNumber, "themes", tag))),
        motifs: track.motifs.filter((tag) => selected.has(tagKey(track.trackNumber, "motifs", tag))),
        characters: track.characters.filter((tag) => selected.has(tagKey(track.trackNumber, "characters", tag))),
      }))
      .filter((track) => countTags([track]) > 0);
    if (!accept.length) return;
    setPhase("applying");
    setStatus(null);
    try {
      const res = await fetch(`/api/albums/${albumId}/autotag`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accept }),
      });
      if (!res.ok) throw new Error(await errorFrom(res, "The tags weren't added. Try again in a moment."));
      const body = (await res.json()) as { added: TrackTags[] };
      close({ tone: "ok", text: describeAddedTags(body.added) });
      // The theme map, the spine and the motif index read these tags: redraw them now.
      router.refresh();
    } catch (err) {
      setPhase("review");
      setStatus({
        tone: "danger",
        text: err instanceof Error ? err.message : "The tags weren't added. Try again in a moment.",
      });
    }
  }

  function toggle(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const total = countTags(proposals);
  const matches = albumMatchKeys(proposals).size;
  const chosen = selected.size;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          ref={triggerRef}
          onClick={() => void suggest()}
          busy={phase === "loading"}
          disabled={phase === "review" || phase === "applying"}
        >
          <Tags className="h-4 w-4" aria-hidden="true" />
          {phase === "loading" ? "Reading the lyrics…" : "Tag from lyrics"}
        </Button>
        <a href={`/api/albums/${albumId}/bible/markdown`} className={buttonClass("ghost")} download>
          <Download className="h-4 w-4" aria-hidden="true" />
          <span>
            <span className="sr-only">Download the Bible as </span>Markdown
          </span>
        </a>
        <a href={`/api/albums/${albumId}/bible/pdf`} className={buttonClass("ghost")} download>
          <Download className="h-4 w-4" aria-hidden="true" />
          <span>
            <span className="sr-only">Download the Bible as </span>PDF
          </span>
        </a>
      </div>

      {reviewing ? (
        <div
          role="group"
          aria-labelledby={headingId}
          className="mt-4 flex flex-col gap-4 border-t border-line pt-4"
          onKeyDown={(event) => {
            if (event.key === "Escape" && phase === "review") {
              event.stopPropagation();
              close(null);
            }
          }}
        >
          <div>
            <h3 id={headingId} ref={headingRef} tabIndex={-1} className="text-base font-semibold text-ink">
              Tags from the lyrics
            </h3>
            <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-ink-2">
              {total === 1 ? "1 suggestion" : `${total} suggestions`} on{" "}
              {proposals.length === 1 ? "1 track" : `${proposals.length} tracks`}.{" "}
              {matches
                ? `${matches === 1 ? "1 is" : `${matches} are`} the album's own themes, motifs or characters that the lyrics mention, and ${matches === 1 ? "it is" : "they are"} ticked. `
                : ""}
              {matches < total
                ? "Words marked New tag repeat in the lyrics but aren't in the album yet: tick the ones you want. "
                : ""}
              Nothing is added until you choose.
            </p>
          </div>

          <ul className="divide-y divide-line border-y border-line">
            {proposals.map((track) => (
              <li key={track.trackNumber} className="py-3">
                <fieldset className="min-w-0 border-0 p-0">
                  <legend className="flex min-w-0 flex-wrap items-baseline gap-x-3 text-sm">
                    <span className="type-figure font-semibold text-ink-3">{pad(track.trackNumber)}</span>
                    <span className="min-w-0 break-words font-semibold text-ink">{track.title}</span>
                  </legend>
                  <div className="mt-2 flex flex-col gap-2">
                    {TAG_KINDS.filter((kind) => track[kind].length).map((kind) => (
                      <div key={kind} className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                        <span className="type-catalog min-w-0 basis-24 text-xs text-ink-3">{KIND_LABEL[kind].many}</span>
                        {track[kind].map((tag) => {
                          const key = tagKey(track.trackNumber, kind, tag);
                          const isNew = !isAlbumMatch(track, kind, tag);
                          return (
                            <label
                              key={key}
                              className="inline-flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-sm border border-dashed border-line-strong px-3 text-sm text-ink-2 transition-colors hover:bg-hover has-[:checked]:text-ink"
                            >
                              <input
                                type="checkbox"
                                checked={selected.has(key)}
                                onChange={() => toggle(key)}
                                disabled={phase === "applying"}
                                className="h-4 w-4 shrink-0 accent-ink"
                              />
                              {/* One text node run for the name: "tally, new theme for track 2", never a
                                  stray space before the comma between flex items. */}
                              <span className="min-w-0 break-words">
                                {tag}
                                <span className="sr-only">{`, ${isNew ? "new " : ""}${KIND_LABEL[kind].one} for track ${track.trackNumber}`}</span>
                              </span>
                              {isNew ? (
                                <span aria-hidden="true" className="type-catalog text-xs text-ink-3">
                                  New tag
                                </span>
                              ) : null}
                            </label>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </fieldset>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              tone="primary"
              onClick={() => void apply()}
              disabled={!chosen}
              busy={phase === "applying"}
            >
              {phase === "applying" ? "Adding…" : chosen === 1 ? "Add 1 tag" : `Add ${chosen} tags`}
            </Button>
            <Button
              tone="ghost"
              onClick={() => setSelected(chosen === total ? new Set() : allKeys(proposals))}
              disabled={phase === "applying"}
            >
              {chosen === total ? "Untick all" : "Tick all"}
            </Button>
            <Button tone="ghost" onClick={() => close(null)} disabled={phase === "applying"}>
              Cancel
            </Button>
            {!chosen ? <p className="min-w-0 text-sm text-ink-3">Tick at least one tag to add it.</p> : null}
          </div>
        </div>
      ) : null}

      {status ? (
        <StatusMessage tone={status.tone} className="mt-2">
          {status.text}
        </StatusMessage>
      ) : null}
    </div>
  );
}
