/** Audio API — preview rendering and AI generation endpoints. */
import { api } from "./client";
import type { AudioGenResult, AudioPreviewInput } from "./types";

export const audioApi = {
  /** Render a chord progression preview as MP3. */
  previewMp3: (chords: string[], key: string, tempo: number) =>
    api.post<{ url: string }>("/api/audio/preview/mp3", {
      chords,
      key,
      tempo,
    } satisfies AudioPreviewInput),

  /** Render a chord progression preview as MIDI. */
  previewMidi: (chords: string[], key: string, tempo: number) =>
    api.post<{ url: string }>("/api/midi/preview", {
      chords,
      key,
      tempo,
    } satisfies AudioPreviewInput),

  /** Generate audio from a text prompt using AI. */
  generate: (prompt: string, duration: number) =>
    api.post<AudioGenResult>("/api/audio/generate", { prompt, duration }),

  /** Generate audio from structured song data. */
  generateFromSong: (songData: object) =>
    api.post<AudioGenResult>("/api/audio/generate-from-song", songData),
};
