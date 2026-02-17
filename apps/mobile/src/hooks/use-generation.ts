/** AI Generation hooks — React Query mutations for triggering AI generation. */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { generationApi } from "../api/generation";
import type {
  GenerateAlbumInput,
  GenerateSectionInput,
  GenerateSongInput,
} from "../api/generation";

// ── Query keys (same as use-albums to enable cross-invalidation) ────
const albumKeys = {
  all: ["albums"] as const,
  detail: (id: string) => ["albums", id] as const,
};

// ── Album generation ────────────────────────────────────────────────

/**
 * Trigger full album generation (vision crew).
 * On success, invalidates the album detail query so the UI picks up
 * any new songs, themes, or structural changes.
 */
export function useGenerateAlbum(albumId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data?: GenerateAlbumInput) =>
      generationApi.generateAlbum(albumId, data),
    onSuccess: () => {
      // Refresh the album detail + list since generation may create songs
      qc.invalidateQueries({ queryKey: albumKeys.detail(albumId) });
      qc.invalidateQueries({ queryKey: albumKeys.all });
    },
  });
}

// ── Song generation ──────────────────────────────────────────────────

/**
 * Generate/regenerate a single song (lyrics, chords, production notes).
 * On success, invalidates the album detail query so updated song data
 * appears in the UI.
 */
export function useGenerateSong(albumId: string, songId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data?: GenerateSongInput) =>
      generationApi.generateSong(albumId, songId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: albumKeys.detail(albumId) });
    },
  });
}

// ── Section generation ───────────────────────────────────────────────

/**
 * Generate/regenerate content for a single section.
 * On success, invalidates the album detail query so the new lyrics
 * and chords appear in the section cards.
 */
export function useGenerateSection(
  albumId: string,
  songId: string,
  sectionId: string,
) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data?: GenerateSectionInput) =>
      generationApi.generateSection(albumId, songId, sectionId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: albumKeys.detail(albumId) });
    },
  });
}
