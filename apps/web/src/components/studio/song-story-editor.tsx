"use client";

import { ChevronDown } from "lucide-react";
import { memo, type ReactNode } from "react";

import { ChipListEditor } from "@/components/studio/chip-list-editor";
import { carriedThemes, type StudioSong } from "@/components/studio/studio-model";
import { sameKeys } from "@/components/studio/use-stable-event";
import { Field, inputClass } from "@/components/ui";
import { carriedThemesPhrase } from "@/lib/theme-keys";
import { cn } from "@/lib/utils";

export const SONG_STORY_ID = "song-story";
/** Deep-link targets inside the story (`?focus=story|role|song-themes|motifs|characters`). */
export const STORY_FOCUS_TARGETS = {
  /** The Story note (`narrative_summary`). */
  story: "song-narrative-summary",
  /** The Role (`narrative_position`). */
  role: "song-narrative-position",
  themes: "song-themes",
  motifs: "song-motifs",
  characters: "song-characters",
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

/** The folded Role and Story note's toggle, and the fields it shows (`StoryFieldsFold`). */
export const STORY_FIELDS_TOGGLE_ID = "song-story-fields-toggle";
export const STORY_FIELDS_BODY_ID = "song-story-fields";

/** A Story note's first words ("She leaves before the storm…"), whole words, at most `words`. */
export function storyNoteExcerpt(note: string | null | undefined, words = 6): string {
  const all = (note ?? "").trim().split(/\s+/).filter(Boolean);
  if (all.length <= words) return all.join(" ");
  return `${all.slice(0, words).join(" ").replace(/[,;:.!?…—–-]+$/, "")}…`;
}

/**
 * The folded Role and Story note in one line: the role or "No role yet", the Story note's first
 * words or "no Story note yet", and, when the album has themes, which of them the track carries
 * ("Opening · She leaves before the storm. · Carries tide"). Each separator is held to the item
 * before it (a no-break space), so a wrapped line never starts with a dot.
 */
export function storyFieldsSummary(song: StudioSong, albumThemes: readonly string[] = []): string {
  const themes = albumThemes.filter((t) => t.trim());
  return [
    song.narrative_position?.trim() || "No role yet",
    storyNoteExcerpt(song.narrative_summary) || "no Story note yet",
    themes.length ? carriedThemesPhrase(carriedThemes(song.themes, themes), themes.length) : null,
  ]
    .filter(Boolean)
    .join("\u00a0· ");
}

/**
 * Below the 42rem single-column layout (a phone, enlarged text) the track's Role, Story note and
 * album-theme toggles fold into one line under the title, so the lyrics come within a screen of
 * the Studio's top; the line says what they hold, and a deep link to either field opens it.
 * From 42rem the toggle is gone and the fields are always in view, as the Coherence report asks
 * every track for them.
 */
export function StoryFieldsFold({
  summary,
  open,
  onOpenChange,
  children,
}: {
  summary: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <h3 className="text-base text-ink @2xl/studio:hidden">
        <button
          id={STORY_FIELDS_TOGGLE_ID}
          type="button"
          aria-expanded={open}
          aria-controls={STORY_FIELDS_BODY_ID}
          onClick={() => onOpenChange(!open)}
          className="-mx-2 flex min-h-11 w-full min-w-0 flex-col gap-0.5 rounded border border-transparent px-2 py-1.5 text-left transition-colors hover:bg-hover"
        >
          {/* The name and Edit/Hide on one line, what the fields hold under them. */}
          <span className="flex min-w-0 flex-wrap items-center justify-between gap-x-3">
            <span className="min-w-0 break-words font-semibold">Role and Story note</span>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-ink">
              {open ? "Hide" : "Edit"}
              <ChevronDown
                className={cn("h-4 w-4 transition-transform motion-reduce:transition-none", open && "rotate-180")}
                aria-hidden="true"
              />
            </span>
          </span>
          <span className="min-w-0 max-w-[65ch] break-words text-sm text-ink-2">{summary}</span>
        </button>
      </h3>
      <div id={STORY_FIELDS_BODY_ID} className={cn("flex min-w-0 flex-col gap-4", !open && "@max-2xl/studio:hidden")}>
        {children}
      </div>
    </div>
  );
}

/**
 * The track's Role and Story note, under its title (above the lyrics): the two things the
 * coherence report asks of every track first. In view from 42rem; below it they fold into
 * `StoryFieldsFold`'s one line. Role is defined where it is asked.
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
          placeholder="e.g. Opening"
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
          placeholder="e.g. She leaves before the storm."
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
type SongStoryEditorProps = {
  song: StudioSong;
  albumThemes: string[];
  albumMotifs: string[];
  onChange: <K extends StoryField>(key: K, value: StudioSong[K]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** SongStoryEditor's memo test: what it shows of the track (themes, motifs, characters). */
export function sameSongStoryProps(prev: SongStoryEditorProps, next: SongStoryEditorProps): boolean {
  return (
    sameKeys(prev, next, ["albumThemes", "albumMotifs", "onChange", "open", "onOpenChange"]) &&
    (prev.song === next.song || sameKeys(prev.song, next.song, ["themes", "motifs", "characters"]))
  );
}

/** Memoized, so a keystroke in the lyrics doesn't re-render the track's chip editors. */
export const SongStoryEditor = memo(SongStoryEditorView, sameSongStoryProps);

function SongStoryEditorView({
  song,
  albumThemes,
  albumMotifs,
  onChange,
  open,
  onOpenChange,
}: SongStoryEditorProps) {
  const bodyId = `${SONG_STORY_ID}-body`;
  return (
    <section id={SONG_STORY_ID} aria-labelledby={`${SONG_STORY_ID}-name`} className="border-t border-line pt-4">
      <h3 id={`${SONG_STORY_ID}-title`} className="text-base text-ink">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => onOpenChange(!open)}
          className="-mx-2 flex min-h-11 w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded border border-transparent px-2 py-1.5 text-left transition-colors hover:bg-hover"
        >
          <span id={`${SONG_STORY_ID}-name`} className="font-semibold">
            Themes and motifs
          </span>
          <span className="min-w-0 break-words text-sm text-ink-2">{storySummary(song)}</span>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-ink">
            {open ? "Hide" : "Edit"}
            <ChevronDown className={cn("h-4 w-4 transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
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
            id={STORY_FOCUS_TARGETS.characters}
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
