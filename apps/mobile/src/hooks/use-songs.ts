/** Song & Section hooks — React Query wrappers for song/section CRUD. */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { songsApi } from "../api/songs";
import type {
  CreateSectionInput,
  CreateSongInput,
  UpdateSectionInput,
  UpdateSongInput,
} from "../api/songs";
import type { Album } from "../api/types";

// ── Query keys (reuse album detail key to invalidate) ────────────────
const albumKeys = {
  all: ["albums"] as const,
  detail: (id: string) => ["albums", id] as const,
};

// ── Song mutations ──────────────────────────────────────────────────

export function useCreateSong(albumId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSongInput) => songsApi.create(albumId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: albumKeys.detail(albumId) });
    },
  });
}

export function useUpdateSong(albumId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      songId,
      data,
    }: {
      songId: string;
      data: UpdateSongInput;
    }) => songsApi.update(albumId, songId, data),

    // ── Optimistic update ─────────────────────────────────────────────
    // Immediately reflect the change in the UI cache so the user sees
    // instant feedback, even when offline.  If the mutation fails the
    // previous snapshot is restored.
    onMutate: async ({ songId, data }) => {
      // Cancel any in-flight refetches so they don't overwrite our optimistic value
      await qc.cancelQueries({ queryKey: albumKeys.detail(albumId) });

      // Snapshot the previous album data for rollback
      const previousAlbum = qc.getQueryData<Album>(albumKeys.detail(albumId));

      // Optimistically patch the song inside the album cache
      if (previousAlbum) {
        qc.setQueryData<Album>(albumKeys.detail(albumId), {
          ...previousAlbum,
          songs: previousAlbum.songs.map((song) =>
            song.id === songId ? { ...song, ...data } : song,
          ),
        });
      }

      return { previousAlbum };
    },

    // Rollback on error
    onError: (_err, _vars, context) => {
      if (context?.previousAlbum) {
        qc.setQueryData<Album>(
          albumKeys.detail(albumId),
          context.previousAlbum,
        );
      }
    },

    // Always refetch after mutation settles to ensure server state is in sync
    onSettled: () => {
      qc.invalidateQueries({ queryKey: albumKeys.detail(albumId) });
    },
  });
}

export function useDeleteSong(albumId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (songId: string) => songsApi.delete(albumId, songId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: albumKeys.detail(albumId) });
    },
  });
}

// ── Section mutations ───────────────────────────────────────────────

export function useCreateSection(albumId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      songId,
      data,
    }: {
      songId: string;
      data: CreateSectionInput;
    }) => songsApi.createSection(albumId, songId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: albumKeys.detail(albumId) });
    },
  });
}

export function useUpdateSection(albumId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      songId,
      sectionId,
      data,
    }: {
      songId: string;
      sectionId: string;
      data: UpdateSectionInput;
    }) => songsApi.updateSection(albumId, songId, sectionId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: albumKeys.detail(albumId) });
    },
  });
}

export function useDeleteSection(albumId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      songId,
      sectionId,
    }: {
      songId: string;
      sectionId: string;
    }) => songsApi.deleteSection(albumId, songId, sectionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: albumKeys.detail(albumId) });
    },
  });
}
