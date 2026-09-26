import { sectionLabels, sectionTypeLabel, type StudioSection } from "@/components/studio/studio-model";

/**
 * Where a comment or task sits, named the way every other surface names a track: its number,
 * its title and the section's label as the Studio shows it ("01 · Low Tide Leaving · Verse 1"),
 * never by position alone ("Track 1 · Section 1").
 */
export type SectionPlace = {
  trackNumber: number;
  /** The track's title; left out when it is blank. */
  songTitle?: string | null;
  /** The Studio's label for the section, "Verse 1", "Chorus 2" (`sectionLabels`). */
  sectionLabel: string;
};

function pad(trackNumber: number) {
  return String(trackNumber).padStart(2, "0");
}

/** "01 · Low Tide Leaving · Verse 1": a heading or a line of its own. */
export function sectionPlaceLine(place: SectionPlace): string {
  const title = place.songTitle?.trim();
  return [pad(place.trackNumber), title, place.sectionLabel].filter(Boolean).join(" · ");
}

/** "Low Tide Leaving, Verse 1": the same place inside a sentence ("the comment on …"). */
export function sectionPlacePhrase(place: SectionPlace): string {
  const title = place.songTitle?.trim();
  return `${title || `track ${place.trackNumber}`}, ${place.sectionLabel}`;
}

type PlaceSong = {
  track_number: number;
  title?: string | null;
  sections?: Array<Pick<StudioSection, "section_type"> & { id?: string | null }> | null;
};

/**
 * Every section of the album by its id, with where it sits now. A comment keeps the track
 * number it was left on, but tracks move; the section's id finds it wherever it is.
 */
export function sectionPlaces(songs: readonly PlaceSong[]): Map<string, SectionPlace> {
  const places = new Map<string, SectionPlace>();
  for (const song of songs) {
    const sections = song.sections ?? [];
    const labels = sectionLabels(sections as StudioSection[]);
    sections.forEach((section, index) => {
      if (!section.id) return;
      places.set(section.id, {
        trackNumber: song.track_number,
        songTitle: song.title,
        sectionLabel: labels[index] ?? sectionTypeLabel(section.section_type),
      });
    });
  }
  return places;
}

/**
 * The place for a comment or task: found by its section id when the section still exists,
 * otherwise from what it recorded (the track by its number, the section by its type).
 */
export function placeFor(
  places: Map<string, SectionPlace>,
  songs: readonly PlaceSong[],
  item: { sectionId: string | null; songTrackNumber: number | null; sectionType: string | null },
): SectionPlace | null {
  const found = item.sectionId ? places.get(item.sectionId) : undefined;
  if (found) return found;
  if (!item.songTrackNumber) return null;
  const song = songs.find((entry) => entry.track_number === item.songTrackNumber);
  return {
    trackNumber: item.songTrackNumber,
    songTitle: song?.title ?? null,
    sectionLabel: sectionTypeLabel(item.sectionType),
  };
}
