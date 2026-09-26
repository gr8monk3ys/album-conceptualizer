import { AlbumJsonSchema } from "@/server/album-json";
import { getAlbumTrackedEvents } from "@/server/analytics";
import { analyzeAlbumCoherence, coherenceFixHref, MIN_WRITTEN_TRACKS_FOR_SCORE } from "@/server/coherence";
import { STYLE_BIBLE_LOCKED_FIELDS } from "@/server/readiness";
import { listAlbumRoughDemos } from "@/server/rough-demos";
import { getAlbumStyleBible, summarizeStyleBible } from "@/server/style-bible";

export type AlbumOnboardingStep = {
  key: string;
  label: string;
  description: string;
  href: string;
  complete: boolean;
};

export type AlbumOnboardingSummary = {
  completeCount: number;
  totalCount: number;
  steps: AlbumOnboardingStep[];
};

function hasDirectionLocked(data: unknown) {
  const parsed = AlbumJsonSchema.safeParse(data);
  if (!parsed.success) return false;

  const album = parsed.data;
  return Boolean(
    album.concept_summary?.trim() &&
      (album.narrative_structure?.trim() ||
        album.central_themes.length > 0 ||
        album.reference_albums.length > 0),
  );
}

type SongProgress = { trackNumber: number; hasThemes: boolean };

function songProgress(data: unknown): SongProgress[] {
  const parsed = AlbumJsonSchema.safeParse(data);
  if (!parsed.success) return [];
  return parsed.data.songs
    .map((song) => ({
      trackNumber: song.track_number,
      hasThemes: song.themes.some((theme) => theme.trim().length > 0),
    }))
    .sort((left, right) => left.trackNumber - right.trackNumber);
}

function hasStyleBibleLocked(data: unknown) {
  const summary = summarizeStyleBible(getAlbumStyleBible(data));
  return summary.filledCount >= STYLE_BIBLE_LOCKED_FIELDS;
}

function hasRoughDemoCaptured(data: unknown) {
  return listAlbumRoughDemos(data).length > 0;
}

export async function getAlbumOnboardingSummary(input: {
  workspaceId: string;
  albumId: string;
  data: unknown;
  isPublic: boolean;
}) {
  const trackedEvents = await getAlbumTrackedEvents(input.workspaceId, input.albumId);
  const base = `/app/albums/${input.albumId}`;
  const songs = songProgress(input.data);
  const coherence = analyzeAlbumCoherence(input.data);
  const lyricTarget = Math.max(1, Math.min(MIN_WRITTEN_TRACKS_FOR_SCORE, songs.length));
  const lyricFix = coherence.issues.find((issue) => issue.id === "missing_lyrics")?.fix;
  const chordFix = coherence.issues.find((issue) => issue.id === "missing_chords")?.fix;
  const untagged = songs.find((song) => !song.hasThemes) ?? songs[0];

  // The saved blueprint is where the path starts, not a step on it: counting it would tick a
  // box on every fresh album. The checklist says "Blueprint saved" above the steps instead.
  const steps: AlbumOnboardingStep[] = [
    {
      key: "direction_locked",
      label: "Lock the direction",
      description: "Add a concept, a narrative shape, and at least one theme or reference album.",
      href: `${base}/studio?focus=album`,
      complete: hasDirectionLocked(input.data),
    },
    {
      key: "lyrics_written",
      label: lyricTarget === 1 ? "Write the lyrics" : "Write lyrics for two tracks",
      description: "Replace the placeholder lines. The Coherence report scores the album from here.",
      href: coherenceFixHref(input.albumId, lyricFix ?? { focus: "song" }),
      complete: coherence.stats.songsWithLyrics >= lyricTarget,
    },
    {
      // Kept as "bible_reviewed": tagging themes is what makes the Bible worth reviewing.
      key: "bible_reviewed",
      label: "Tag themes on a track",
      description: "Mark which of the album's themes a track carries so the Story bible can map them.",
      href: coherenceFixHref(input.albumId, { focus: "song-themes", trackNumber: untagged?.trackNumber }),
      complete: songs.some((song) => song.hasThemes),
    },
    {
      // Read through `@/lib/chords` (via the report): the starter loop is never "written".
      key: "chords_set",
      label: lyricTarget === 1 ? "Write the chords" : "Write chords for two tracks",
      description: "Change the starter loop into a progression of the track's own. The starter chords don't count.",
      href: coherenceFixHref(input.albumId, chordFix ?? { focus: "song" }),
      complete: coherence.stats.songsWithChords >= lyricTarget,
    },
    {
      key: "style_bible_locked",
      label: "Set the Sound bible",
      description: "Set at least three of the Sound bible's fields, such as the lead voice, sonic palette and mix priorities.",
      href: `${base}/style`,
      // Read from the album itself: a Sound bible saved and later cleared is not done.
      complete: hasStyleBibleLocked(input.data),
    },
    {
      key: "rough_demo_captured",
      label: "Capture a rough demo",
      description: "Save one memo, rehearsal take or riff sketch while the idea is fresh.",
      href: `${base}/demos`,
      complete: hasRoughDemoCaptured(input.data),
    },
    {
      key: "export_or_publish",
      label: "Export or publish",
      description: "Download a handoff pack for your DAW or collaborators, or publish the album to Discover.",
      href: `${base}/export`,
      // An export leaves no trace in the album itself, so this one reads the event log.
      complete: trackedEvents.has("album_export_requested") || input.isPublic,
    },
  ];

  return {
    steps,
    completeCount: steps.filter((step) => step.complete).length,
    totalCount: steps.length,
  } satisfies AlbumOnboardingSummary;
}
