import { z } from "zod";

export const SectionSchema = z
  .object({
    id: z.string().optional(),
    section_type: z.string().min(1),
    order: z.number().int().min(0),
    lyrics: z.string().optional().nullable(),
    chord_progression: z.array(z.string()).optional(),
    notes: z.string().optional().nullable(),
    duration_bars: z.number().int().optional().nullable(),
    narrative_function: z.string().optional().nullable(),
    emotional_arc: z.string().optional().nullable(),
    key: z.string().optional().nullable(),
    tempo_modifier: z.string().optional().nullable(),
    dynamics: z.string().optional().nullable(),
  })
  .passthrough();

export const SongSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().min(1).max(200),
    track_number: z.number().int().min(1),
    sections: z.array(SectionSchema).optional().default([]),
    // Metadata
    duration_estimate: z.string().optional().nullable(),
    duration_seconds: z.number().int().optional().nullable(),
    key: z.string().optional().nullable(),
    tempo: z.number().int().optional().nullable(),
    time_signature: z.string().optional().nullable(),
    // Narrative
    narrative_position: z.string().optional().nullable(),
    narrative_summary: z.string().optional().nullable(),
    chronological_order: z.number().int().optional().nullable(),
    // Thematic
    themes: z.array(z.string()).optional().default([]),
    motifs: z.array(z.string()).optional().default([]),
    characters: z.array(z.string()).optional().default([]),
    // Style
    genre_tags: z.array(z.string()).optional().default([]),
    mood_tags: z.array(z.string()).optional().default([]),
    reference_tracks: z.array(z.string()).optional().default([]),
    // Production
    production_notes: z.string().optional().nullable(),
    instrumentation: z.array(z.string()).optional().default([]),
  })
  .passthrough();

export const AlbumJsonSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().min(1).max(200),
    artist: z.string().optional().nullable(),
    songs: z.array(SongSchema),
    // Metadata
    created_at: z.string().optional().nullable(),
    updated_at: z.string().optional().nullable(),
    // Album-level narrative
    concept_summary: z.string().optional().nullable(),
    narrative_structure: z.string().optional().nullable(),
    // Album-level style
    primary_genre: z.string().optional().nullable(),
    secondary_genres: z.array(z.string()).optional().default([]),
    era_influence: z.string().optional().nullable(),
    release_year: z.number().int().optional().nullable(),
    // Thematic elements
    central_themes: z.array(z.string()).optional().default([]),
    recurring_motifs: z.array(z.string()).optional().default([]),
    // Reference materials
    reference_albums: z.array(z.string()).optional().default([]),
    visual_inspiration: z.array(z.string()).optional().default([]),
  })
  .passthrough();

export type AlbumJson = z.infer<typeof AlbumJsonSchema>;

