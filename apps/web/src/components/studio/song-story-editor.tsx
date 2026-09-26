"use client";

import { ChevronDown } from "lucide-react";

import { ChipListEditor } from "@/components/studio/chip-list-editor";
import type { StudioSong } from "@/components/studio/studio-model";
import { Field, inputClass } from "@/components/ui";
import { cn } from "@/lib/utils";

export const SONG_STORY_ID = "song-story";
/** Deep-link targets inside the story (`?focus=story|role|song-themes|motifs`). */
export const STORY_FOCUS_TARGETS = {
  /** The Story note (`narrative_summary`). */
  story: "song-narrative-summary",
  /** The Role (`narrative_position`). */
  role: "song-narrative-position",
  themes: "song-themes",
  motifs: "song-motifs",
} as const;

type StoryField = "themes" | "motifs" | "characters";

/** "grief, signal · 2 motifs": what the track carries in one line, or what is still missing. */
export function storySummary(song: StudioSong): string {
  const themes = (song.themes ?? []).filter((t) => t.trim());
  const shown = themes.slice(0, 3).join(", ");
  const more = themes.length > 3 ? ` +${themes.length - 3}` : "";
  const motifs = (song.motifs ?? []).filter((m) => m.trim()).length;
  const characters = (song.characters ?? []).filter((c) => c.trim()).length;
  return [
    themes.length ? `${shown}${more}` : "no themes yet",
    motifs ? `${motifs} ${motifs === 1 ? "motif" : "motifs"}` : null,
    characters ? `${characters} ${characters === 1 ? "character" : "characters"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The track's Role and Story note, always in view under its title, key and tempo: the two
 * things the coherence report asks of every track first, so they are never behind a
 * disclosure. Role is defined where it is asked.
 */
export function SongStoryFields({
  song,
  onChange,
}: {
  song: StudioSong;
  onChange: <K extends "narrative_position" | "narrative_summary">(key: K, value: StudioSong[K]) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 @lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <Field
        label="Role"
        htmlFor={STORY_FOCUS_TARGETS.role}
        hint={<span className="block max-w-[65ch]">Role: the track’s job in the story — opening, turn, climax…</span>}
      >
        <input
          id={STORY_FOCUS_TARGETS.role}
          value={song.narrative_position ?? ""}
          onChange={(e) => onChange("narrative_position", e.target.value || null)}
          maxLength={120}
          className={inputClass}
          placeholder="Opening"
        />
      </Field>
      <Field
        label="Story note"
        htmlFor={STORY_FOCUS_TARGETS.story}
        hint={
          <span className="block max-w-[65ch]">
            What happens in this track, in a line. The coherence report reads it for every track.
          </span>
        }
      >
        <input
          id={STORY_FOCUS_TARGETS.story}
          value={song.narrative_summary ?? ""}
          onChange={(e) => onChange("narrative_summary", e.target.value || null)}
          className={inputClass}
          placeholder="She leaves the city before the storm reaches it."
        />
      </Field>
    </div>
  );
}

/**
 * What this track carries through the record: its themes, motifs and characters, which the
 * coherence report and the spine read. Collapsed to a one-line summary so the writing surface
 * comes first; it expands in place. (Role and Story note sit under the track title instead.)
 */
export function SongStoryEditor({
  song,
  albumThemes,
  albumMotifs,
  onChange,
  open,
  onOpenChange,
}: {
  song: StudioSong;
  albumThemes: string[];
  albumMotifs: string[];
  onChange: <K extends StoryField>(key: K, value: StudioSong[K]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const bodyId = `${SONG_STORY_ID}-body`;
  return (
    <section id={SONG_STORY_ID} aria-labelledby={`${SONG_STORY_ID}-name`} className="border-t border-line pt-4">
      <h3 id={`${SONG_STORY_ID}-title`} className="text-base text-ink">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => onOpenChange(!open)}
          className="-mx-2 flex min-h-11 w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded px-2 py-1.5 text-left transition-colors hover:bg-hover"
        >
          <span id={`${SONG_STORY_ID}-name`} className="font-semibold">
            Themes and motifs
          </span>
          <span className="min-w-0 break-words text-sm text-ink-2">{storySummary(song)}</span>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-ink">
            {open ? "Hide" : "Edit"}
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
          </span>
        </button>
      </h3>

      <div id={bodyId} hidden={!open} className="mt-3">
        <p className="max-w-[65ch] text-sm leading-relaxed text-ink-2">
          What this track carries through the record. The coherence report and the spine read these.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4">
          <ChipListEditor
            id={STORY_FOCUS_TARGETS.themes}
            label="Themes"
            noun="theme"
            values={song.themes ?? []}
            onChange={(next) => onChange("themes", next)}
            suggestions={albumThemes}
            suggestionsLabel={albumThemes.length ? "From the album’s central themes:" : undefined}
            placeholder="Add a theme"
            hint={albumThemes.length ? undefined : "Set the album’s central themes to get suggestions here."}
          />

          <ChipListEditor
            id={STORY_FOCUS_TARGETS.motifs}
            label="Motifs"
            noun="motif"
            values={song.motifs ?? []}
            onChange={(next) => onChange("motifs", next)}
            suggestions={albumMotifs}
            suggestionsLabel={albumMotifs.length ? "From the album’s motifs:" : undefined}
            placeholder="An image, phrase or sound that returns"
          />

          <ChipListEditor
            id="song-characters"
            label="Characters"
            noun="character"
            values={song.characters ?? []}
            onChange={(next) => onChange("characters", next)}
            placeholder="Who appears in this song"
          />
        </div>
      </div>
    </section>
  );
}
