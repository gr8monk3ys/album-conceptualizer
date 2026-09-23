"use client";

import { ChevronDown } from "lucide-react";

import { ChipListEditor } from "@/components/studio/chip-list-editor";
import type { StudioAlbum } from "@/components/studio/studio-model";
import { Field, inputClass, textareaClass } from "@/components/ui";
import { cn } from "@/lib/utils";

type AlbumPatch = Partial<
  Pick<StudioAlbum, "title" | "artist" | "primary_genre" | "concept_summary" | "central_themes" | "recurring_motifs">
>;

/**
 * The album-level fields the Studio edits alongside the tracks. Always open in the wide
 * three-column layout; a disclosure below the editor on narrower screens.
 */
export const ALBUM_THEMES_INPUT_ID = "album-central-themes";

export function AlbumDetails({
  album,
  onChange,
  open,
  onOpenChange,
  className,
}: {
  album: StudioAlbum;
  onChange: (patch: AlbumPatch) => void;
  /** Whether the disclosure is expanded below the wide layout (always shown at 2xl). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}) {
  return (
    <section
      id="album-details"
      aria-labelledby="album-details-title"
      className={cn("min-w-0 scroll-mt-40 border-t border-line pt-5", className)}
    >
      <h2 id="album-details-title" className="text-lg font-semibold text-ink">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="album-details-body"
          onClick={() => onOpenChange(!open)}
          className="-mx-2 inline-flex min-h-11 items-center gap-2 rounded px-2 hover:bg-hover 2xl:hidden"
        >
          Album details
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
        </button>
        <span className="hidden 2xl:inline">Album details</span>
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-2">
        The concept every track answers to. Themes and motifs here become suggestions in each song’s story.
      </p>

      <div id="album-details-body" className={cn("mt-4 flex-col gap-4", open ? "flex" : "hidden 2xl:flex")}>
        <Field label="Album title" htmlFor="album-title">
          <input
            id="album-title"
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
            placeholder="Alt pop"
          />
        </Field>
        <Field label="Concept summary" htmlFor="album-concept">
          <textarea
            id="album-concept"
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
          placeholder="identity, memory, change"
          hint="The ideas the whole record carries. The coherence report checks each track against them."
        />
        <ChipListEditor
          id="album-recurring-motifs"
          label="Recurring motifs"
          noun="recurring motif"
          values={album.recurring_motifs ?? []}
          onChange={(next) => onChange({ recurring_motifs: next })}
          placeholder="A phrase or image"
          hint="Images, phrases or sounds that come back across tracks."
        />
      </div>
    </section>
  );
}
