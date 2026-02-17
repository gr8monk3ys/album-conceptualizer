/** Voice memo API client for recording and playback endpoints. */
import { api, getToken } from "./client";
import type { VoiceMemo } from "./types";
import { config } from "../config/env";

const BASE_URL = config.apiUrl;

export const voiceMemosApi = {
  list: (albumId: string, songId?: string) => {
    const params = songId ? `?songId=${songId}` : "";
    return api.get<VoiceMemo[]>(`/api/albums/${albumId}/voice-memos${params}`);
  },

  upload: async (
    albumId: string,
    audioUri: string,
    durationMs: number,
    songId?: string,
    sectionId?: string,
    title?: string,
  ): Promise<VoiceMemo> => {
    const formData = new FormData();

    const ext = audioUri.split(".").pop() ?? "m4a";
    formData.append("audio", {
      uri: audioUri,
      name: `recording.${ext}`,
      type: `audio/${ext}`,
    } as unknown as Blob);

    formData.append("durationMs", String(durationMs));
    if (songId) formData.append("songId", songId);
    if (sectionId) formData.append("sectionId", sectionId);
    if (title) formData.append("title", title);

    const token = await getToken();
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(
      `${BASE_URL}/api/albums/${albumId}/voice-memos`,
      {
        method: "POST",
        body: formData,
        headers,
      },
    );

    if (!response.ok) {
      throw new Error("Failed to upload voice memo");
    }

    return response.json();
  },

  delete: (albumId: string, memoId: string) =>
    api.delete(`/api/albums/${albumId}/voice-memos/${memoId}`),
};
