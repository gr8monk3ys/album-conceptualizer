"use client";

import { ChevronDown } from "lucide-react";

import { ChipListEditor } from "@/components/studio/chip-list-editor";
import type { StudioSong } from "@/components/studio/studio-model";
import { Field, inputClass, textareaClass } from "@/components/ui";
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

type StoryField = "narrative_position" | "narrative_summary" | "themes" | "motifs" | "characters";

/** "Inciting incident · grief, signal": the story in one line, or what is still missing. */
export function storySummary(song: StudioSong): string {
  const position = song.narrative_position?.trim() || "No role yet";
  const themes = (song.themes ?? []).filter((t) => t.trim());
  const shown = themes.slice(0, 3).join(", ");
  const more = themes.length > 3 ? ` +${themes.length - 3}` : "";
  return `${position} · ${themes.length ? `${shown}${more}` : "no themes yet"}`;
}

/**
 * Where this track sits in the album's story and what it carries: its role, a story note,
 * and the themes, motifs and characters the coherence report reads. Collapsed to a
 * one-line summary so the writing surface comes first; it expands in place.
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
            Song story
          </span>
          <span className="min-w-0 break-words text-sm text-ink-2">{storySummary(song)}</span>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-ink">
            {open ? "Hide story" : "Edit story"}
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
          </span>
        </button>
      </h3>

      <div id={bodyId} hidden={!open} className="mt-3">
        <p className="max-w-[65ch] text-sm leading-relaxed text-ink-2">
          What this track does for the record. The coherence report and the spine read these.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4">
          <Field
            label="Role"
            htmlFor={STORY_FOCUS_TARGETS.role}
            hint={
              <span className="block max-w-[65ch]">
                A short role in the arc: “inciting incident”, “turning point”, “aftermath”.
              </span>
            }
          >
            <input
              id={STORY_FOCUS_TARGETS.role}
              value={song.narrative_position ?? ""}
              onChange={(e) => onChange("narrative_position", e.target.value || null)}
              maxLength={120}
              className={inputClass}
              placeholder="Inciting incident"
            />
          </Field>

          <Field label="Story note" htmlFor={STORY_FOCUS_TARGETS.story}>
            <textarea
              id={STORY_FOCUS_TARGETS.story}
              value={song.narrative_summary ?? ""}
              onChange={(e) => onChange("narrative_summary", e.target.value || null)}
              rows={3}
              className={textareaClass}
              placeholder="What happens in this song, in a sentence or two."
            />
          </Field>

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
