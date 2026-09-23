"use client";

import { ChipListEditor } from "@/components/studio/chip-list-editor";
import type { StudioSong } from "@/components/studio/studio-model";
import { Field, inputClass, textareaClass } from "@/components/ui";

export const SONG_STORY_ID = "song-story";
export const STORY_FOCUS_TARGETS = {
  story: "song-narrative-position",
  themes: "song-themes",
} as const;

type StoryField = "narrative_position" | "narrative_summary" | "themes" | "motifs" | "characters";

/**
 * Where this track sits in the album's story and what it carries: its narrative role, a
 * summary, and the themes, motifs and characters the coherence report reads.
 */
export function SongStoryEditor({
  song,
  albumThemes,
  albumMotifs,
  onChange,
}: {
  song: StudioSong;
  albumThemes: string[];
  albumMotifs: string[];
  onChange: <K extends StoryField>(key: K, value: StudioSong[K]) => void;
}) {
  return (
    <section
      id={SONG_STORY_ID}
      aria-labelledby={`${SONG_STORY_ID}-title`}
      className="scroll-mt-40 border-t border-line pt-5"
    >
      <h3 id={`${SONG_STORY_ID}-title`} className="text-base font-semibold text-ink">
        Song story
      </h3>
      <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-ink-2">
        What this track does for the record. The coherence report and the spine read these.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4">
        <Field
          label="Narrative position"
          htmlFor={STORY_FOCUS_TARGETS.story}
          hint="A short role in the arc, like “inciting incident”, “turning point” or “aftermath”."
        >
          <input
            id={STORY_FOCUS_TARGETS.story}
            value={song.narrative_position ?? ""}
            onChange={(e) => onChange("narrative_position", e.target.value || null)}
            maxLength={120}
            aria-describedby={`${STORY_FOCUS_TARGETS.story}-hint`}
            className={inputClass}
            placeholder="Inciting incident"
          />
        </Field>

        <Field label="Narrative summary" htmlFor="song-narrative-summary">
          <textarea
            id="song-narrative-summary"
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
          id="song-motifs"
          label="Motifs"
          noun="motif"
          values={song.motifs ?? []}
          onChange={(next) => onChange("motifs", next)}
          suggestions={albumMotifs}
          suggestionsLabel={albumMotifs.length ? "From the album’s recurring motifs:" : undefined}
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
    </section>
  );
}
