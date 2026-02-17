/** Voice memo hooks -- React Query wrappers for voice memo endpoints. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { voiceMemosApi } from "../api/voice-memos";

// ── Query keys ───────────────────────────────────────────────────────
const keys = {
  all: ["voice-memos"] as const,
  list: (albumId: string, songId?: string) =>
    [...keys.all, albumId, songId] as const,
};

// ── Queries ──────────────────────────────────────────────────────────

export function useVoiceMemos(albumId: string, songId?: string) {
  return useQuery({
    queryKey: keys.list(albumId, songId),
    queryFn: () => voiceMemosApi.list(albumId, songId),
    enabled: !!albumId,
  });
}

// ── Mutations ────────────────────────────────────────────────────────

export function useUploadVoiceMemo(albumId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      audioUri: string;
      durationMs: number;
      songId?: string;
      sectionId?: string;
      title?: string;
    }) =>
      voiceMemosApi.upload(
        albumId,
        params.audioUri,
        params.durationMs,
        params.songId,
        params.sectionId,
        params.title,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all });
    },
  });
}

export function useDeleteVoiceMemo(albumId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (memoId: string) => voiceMemosApi.delete(albumId, memoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all });
    },
  });
}
