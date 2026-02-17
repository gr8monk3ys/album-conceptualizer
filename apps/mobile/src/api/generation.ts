/**
 * AI Generation API — triggers album, song, and section generation via the Next.js proxy.
 *
 * NOTE: The `/api/albums/:id/generate`, `/api/albums/:id/songs/:songId/generate`,
 * and section generate routes do not exist in the backend yet. Calling these will
 * result in 404 errors. The studio screen handles these gracefully with alert dialogs.
 */
import { api } from "./client";

// ── Input types ──────────────────────────────────────────────────────

export interface GenerateAlbumInput {
  /** Album concept/premise override (uses album's conceptSummary if omitted) */
  concept?: string;
  /** Reference artists/albums for style guidance */
  references?: string;
  /** Target audience description */
  audience?: string;
  /** Creative constraints */
  constraints?: string;
  /** Desired number of tracks */
  trackCount?: number;
}

export interface GenerateSongInput {
  /** Where this song sits in the album narrative arc */
  narrativePosition?: string;
  /** Thematic focus for this track */
  themes?: string[];
  /** Desired emotional trajectory */
  emotionalArc?: string;
  /** Mood/atmosphere */
  mood?: string;
  /** Section structure (e.g., "Verse-Chorus-Verse-Chorus-Bridge-Chorus") */
  songStructure?: string;
}

export interface GenerateSectionInput {
  /** Whether to generate/regenerate lyrics */
  generateLyrics?: boolean;
  /** Whether to generate/regenerate chord progression */
  generateChords?: boolean;
  /** Additional creative direction */
  context?: string;
  /** Desired mood for this section */
  mood?: string;
}

// ── Response types ───────────────────────────────────────────────────

export interface GenerateAlbumResult {
  /** Whether the generation completed successfully */
  status: "completed" | "failed" | "partial";
  /** Generated album vision / concept */
  vision?: unknown;
  /** Generated style profile */
  style?: unknown;
  /** Generated narrative structure */
  narrative?: unknown;
  /** Error message if failed */
  error?: string;
  [key: string]: unknown;
}

export interface GenerateSongResult {
  status: "completed" | "failed" | "partial";
  /** Generated lyrics by section */
  lyrics?: unknown;
  /** Generated chord progressions */
  chords?: unknown;
  /** Production notes */
  production?: unknown;
  /** Narrative validation */
  validation?: unknown;
  error?: string;
  [key: string]: unknown;
}

export interface GenerateSectionResult {
  status: "completed" | "failed" | "partial";
  /** Generated lyrics text */
  lyrics?: string;
  /** Generated chord progression */
  chordProgression?: string[];
  /** Narrative function of this section */
  narrativeFunction?: string;
  /** Emotional arc description */
  emotionalArc?: string;
  error?: string;
  [key: string]: unknown;
}

// ── API functions ────────────────────────────────────────────────────

export const generationApi = {
  /**
   * Trigger full album generation (vision, style, narrative structure).
   * This is a long-running operation — the backend coordinates multiple AI agents.
   */
  generateAlbum: (albumId: string, data?: GenerateAlbumInput) =>
    api.post<GenerateAlbumResult>(
      `/api/albums/${albumId}/generate`,
      data ?? {},
    ),

  /**
   * Generate/regenerate a single song (lyrics, chords, production notes).
   */
  generateSong: (
    albumId: string,
    songId: string,
    data?: GenerateSongInput,
  ) =>
    api.post<GenerateSongResult>(
      `/api/albums/${albumId}/songs/${songId}/generate`,
      data ?? {},
    ),

  /**
   * Generate/regenerate content for a single section (lyrics, chords).
   */
  generateSection: (
    albumId: string,
    songId: string,
    sectionId: string,
    data?: GenerateSectionInput,
  ) =>
    api.post<GenerateSectionResult>(
      `/api/albums/${albumId}/songs/${songId}/sections/${sectionId}/generate`,
      data ?? {},
    ),
};
