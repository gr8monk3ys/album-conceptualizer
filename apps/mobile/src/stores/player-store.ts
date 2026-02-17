/** Audio player state — manages playback across screens. */
import { create } from "zustand";

interface PlayerState {
  /** URL of the currently loaded audio. */
  audioUrl: string | null;
  /** Title displayed in the mini player. */
  title: string | null;
  /** Subtitle (e.g. album name or chord progression). */
  subtitle: string | null;
  /** Whether audio is currently playing. */
  isPlaying: boolean;
  /** Playback position in milliseconds. */
  positionMs: number;
  /** Total duration in milliseconds. */
  durationMs: number;

  /** Load a new audio source. */
  load: (url: string, title: string, subtitle?: string) => void;
  /** Toggle play/pause. */
  togglePlay: () => void;
  /** Update playback position (called by the player component). */
  setPosition: (ms: number) => void;
  /** Update total duration. */
  setDuration: (ms: number) => void;
  /** Set playing state. */
  setIsPlaying: (playing: boolean) => void;
  /** Clear the player. */
  clear: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  audioUrl: null,
  title: null,
  subtitle: null,
  isPlaying: false,
  positionMs: 0,
  durationMs: 0,

  load: (url, title, subtitle) =>
    set({
      audioUrl: url,
      title,
      subtitle: subtitle ?? null,
      isPlaying: false,
      positionMs: 0,
      durationMs: 0,
    }),

  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setPosition: (ms) => set({ positionMs: ms }),
  setDuration: (ms) => set({ durationMs: ms }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  clear: () =>
    set({
      audioUrl: null,
      title: null,
      subtitle: null,
      isPlaying: false,
      positionMs: 0,
      durationMs: 0,
    }),
}));
