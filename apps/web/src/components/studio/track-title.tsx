"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

import { sharedTitleHint } from "@/components/studio/studio-model";
import { cn } from "@/lib/utils";

/** The title field's id: deep links, Add track and the skip link's fallback focus it. */
export const TRACK_TITLE_ID = "song-title";

/** A title is one line of words: line breaks typed or pasted become spaces. */
export function singleLineTitle(value: string): string {
  return value.replace(/[\r\n]+/g, " ");
}

/**
 * The textarea's height follows its text, so a long title wraps under the number like the
 * heading it replaces instead of scrolling sideways inside a one-line box. Measured again when
 * the title changes, when the field's width changes (a rotated phone, the columns folding) and
 * once the display font has loaded (it sets wider than the fallback).
 */
function useFitHeight(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "auto";
      const borders = el.offsetHeight - el.clientHeight;
      el.style.height = `${el.scrollHeight + borders}px`;
    };
    fit();
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fit();
    });
    observer.observe(el);
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) fit();
    });
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [ref, value]);
}

/**
 * The current track's heading is its title, edited in place: the two-digit number in Ash Ink,
 * then the title as a field set in the Headline size, so renaming a track happens where its
 * name is read instead of in a form below the lyrics. A hairline in the control colour under
 * the title says it can be edited; the focus ring shows while it is. The heading keeps one
 * accessible name ("Track 01: Storm Warning"); the field is "Track title".
 *
 * Under it, only when needed: the save error for an empty title (Coral), or, when another track
 * has the same title (trimmed, any casing), a line of guidance in Stone Ink naming it ("Track 03
 * is also called this."). A repeated title can be a deliberate reprise, so it is said, not
 * flagged. The hint's region is mounted empty, so it is announced when it appears.
 */
export function TrackTitle({
  headingId,
  trackNumber,
  title,
  sharedWith,
  onChange,
}: {
  headingId: string;
  trackNumber: number;
  title: string;
  /** Track numbers of the other tracks with the same title (`tracksSharingTitle`). */
  sharedWith: readonly number[];
  onChange: (title: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useFitHeight(ref, title);
  const number = String(trackNumber).padStart(2, "0");
  const empty = !title.trim();
  const hint = sharedTitleHint(sharedWith);
  const errorId = `${TRACK_TITLE_ID}-error`;
  const hintId = `${TRACK_TITLE_ID}-shared`;
  const describedBy = [empty ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <>
      <h2
        id={headingId}
        aria-label={`Track ${number}: ${title.trim() || "Untitled"}`}
        // The field's top padding is breathing room for the focus ring; pulled up by it, so the
        // title's line sits where the plain heading's did and the lyrics keep their place. A
        // size container, so the title steps down by the room its row has (below).
        className="@container -mt-1 flex min-w-0 items-start gap-x-2 text-2xl font-semibold text-ink"
      >
        {/* The number's line box is the field's height, so the two share a centre line and
            the number stays level with the title's first line when it wraps. Below a 16rem
            row (a phone at 200% text) it steps down to the spine's size, leaving the room to
            the title. */}
        <span
          aria-hidden="true"
          className="type-figure flex min-h-11 flex-none items-center text-3xl text-ink-3 @max-[16rem]:text-base"
        >
          {number}
        </span>
        <textarea
          ref={ref}
          id={TRACK_TITLE_ID}
          aria-label="Track title"
          value={title}
          rows={1}
          maxLength={200}
          spellCheck
          placeholder="e.g. Storm Warning"
          onChange={(event) => onChange(singleLineTitle(event.target.value))}
          onKeyDown={(event) => {
            // A title is one line: Enter adds no line break.
            if (event.key === "Enter") event.preventDefault();
          }}
          aria-invalid={empty ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            // The Headline size, capped by the row's width (`cqi`) with a 1rem floor, like the
            // release title: in a narrow row the title steps down instead of breaking inside a
            // word ("Warni/ng"). Wherever the row has room it is the full 1.5rem.
            "block min-h-11 w-full min-w-0 resize-none overflow-hidden rounded-sm border-0 border-b bg-transparent px-1 py-1.5 text-[length:max(1rem,min(1.5rem,13cqi))] font-semibold leading-8 text-ink transition-colors placeholder:font-normal placeholder:text-ink-3",
            empty ? "border-danger/60" : "border-line-control hover:border-ink-3",
          )}
        />
      </h2>
      {empty ? (
        <p id={errorId} className="mt-1 max-w-[65ch] text-sm text-danger">
          A track needs a title before it can be saved.
        </p>
      ) : null}
      <p id={hintId} aria-live="polite" className="max-w-[65ch] text-sm text-ink-2 mt-1 empty:absolute">
        {hint}
      </p>
    </>
  );
}
