"use client";

import { ChevronDown } from "lucide-react";

import { ChipListEditor } from "@/components/studio/chip-list-editor";
import type { StudioAlbum } from "@/components/studio/studio-model";
import { Field, inputClass, textareaClass } from "@/components/ui";
import { cn } from "@/lib/utils";

type AlbumPatch = Partial<
  Pick<StudioAlbum, "title" | "artist" | "primary_genre" | "concept_summary" | "central_themes" | "recurring_motifs">
>;

/** Deep-link targets: `?focus=album` (see `albumFocusTarget`) and `?focus=album-motifs`. */
export const ALBUM_TITLE_INPUT_ID = "album-title";
export const ALBUM_CONCEPT_INPUT_ID = "album-concept";
export const ALBUM_THEMES_INPUT_ID = "album-central-themes";
export const ALBUM_MOTIFS_INPUT_ID = "album-recurring-motifs";

/**
 * Where `?focus=album` lands: the first album field still empty, in the order the record
 * needs them (the concept, then its central themes), or the title when both are set.
 */
export function albumFocusTarget(album: Pick<StudioAlbum, "concept_summary" | "central_themes">): string {
  if (!album.concept_summary?.trim()) return ALBUM_CONCEPT_INPUT_ID;
  if (!(album.central_themes ?? []).some((theme) => theme.trim())) return ALBUM_THEMES_INPUT_ID;
  return ALBUM_TITLE_INPUT_ID;
}

/**
 * The album-level fields the Studio edits alongside the tracks, as a collapsed disclosure at the
 * very bottom of the editor column, named for its reach ("all tracks") so it never reads as
 * part of the current track.
 */
export function AlbumDetails({
  album,
  onChange,
  open,
  onOpenChange,
  className,
}: {
  album: StudioAlbum;
  onChange: (patch: AlbumPatch) => void;
  /** Whether the disclosure is expanded. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}) {
  return (
    <section
      id="album-details"
      aria-labelledby="album-details-title"
      className={cn("min-w-0 border-t border-line pt-5", className)}
    >
      <h2 id="album-details-title" className="text-lg font-semibold text-ink">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="album-details-body"
          onClick={() => onOpenChange(!open)}
          className="-mx-2 inline-flex min-h-11 items-center gap-2 rounded px-2 transition-colors hover:bg-hover"
        >
          Album details (all tracks)
          <ChevronDown className={cn("h-4 w-4 transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
        </button>
      </h2>
      <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-ink-2">
        The concept every track answers to. Themes and motifs set here are offered in each
        song’s story, and the central themes become the columns of the track list.
      </p>

      <div id="album-details-body" hidden={!open} className="mt-4 flex-col gap-4 [&:not([hidden])]:flex">
        <Field label="Album title" htmlFor={ALBUM_TITLE_INPUT_ID}>
          <input
            id={ALBUM_TITLE_INPUT_ID}
            value={album.title ?? ""}
            onChange={(e) => onChange({ title: e.target.value })}
            maxLength={200}
            className={inputClass}
          />
        </Field>
        <Field label="Artist" htmlFor="album-artist">
          <input
            id="album-artist"
            value={album.artist ?? ""}
            onChange={(e) => onChange({ artist: e.target.value || null })}
            className={inputClass}
            placeholder="Artist name"
          />
        </Field>
        <Field label="Primary genre" htmlFor="album-genre">
          <input
            id="album-genre"
            value={album.primary_genre ?? ""}
            onChange={(e) => onChange({ primary_genre: e.target.value || null })}
            className={inputClass}
            placeholder="e.g. Alt pop"
          />
        </Field>
        <Field label="Concept summary" htmlFor={ALBUM_CONCEPT_INPUT_ID}>
          <textarea
            id={ALBUM_CONCEPT_INPUT_ID}
            value={album.concept_summary ?? ""}
            onChange={(e) => onChange({ concept_summary: e.target.value || null })}
            rows={5}
            className={textareaClass}
            placeholder="One paragraph describing the album concept."
          />
        </Field>
        <ChipListEditor
          id={ALBUM_THEMES_INPUT_ID}
          label="Central themes"
          noun="central theme"
          values={album.central_themes ?? []}
          onChange={(next) => onChange({ central_themes: next })}
          placeholder="e.g. identity, memory, change"
          hint="The ideas the whole record carries. The coherence report checks each track for them."
        />
        <ChipListEditor
          id={ALBUM_MOTIFS_INPUT_ID}
          label="Album motifs"
          noun="album motif"
          values={album.recurring_motifs ?? []}
          onChange={(next) => onChange({ recurring_motifs: next })}
          placeholder="A phrase or image"
          hint="Images, phrases or sounds that come back across tracks. Each track tags the ones it uses in its story."
        />
      </div>
    </section>
  );
}
