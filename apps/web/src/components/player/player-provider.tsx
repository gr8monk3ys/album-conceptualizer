"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type * as ToneModule from "tone";
import type { Player as SoundfontPlayer } from "soundfont-player";

import {
  PreviewError,
  instrumentSwitchMessage,
  type PreviewFailure,
  type PreviewInstrument,
} from "@/components/player/preview-errors";

export { PREVIEW_FAILED_MESSAGE, INSTRUMENT_LABELS, previewErrorMessage } from "@/components/player/preview-errors";
export type { PreviewInstrument } from "@/components/player/preview-errors";

type PlayerStatus = "idle" | "loading" | "ready" | "playing" | "paused" | "error";

type NowPlaying = {
  kind: "midi";
  title: string;
  subtitle?: string;
};

type LoadMidiInput = {
  midi: ArrayBuffer;
  title: string;
  subtitle?: string;
  /** The control that started the preview; focus returns to it when the player is closed. */
  returnFocusId?: string;
};

type PlayerApi = {
  status: PlayerStatus;
  nowPlaying: NowPlaying | null;
  duration: number;
  position: number;
  volume: number;
  loop: boolean;
  instrument: PreviewInstrument;
  instrumentLoading: boolean;
  error: string | null;
  /** A problem that didn't stop the preview (an instrument that didn't load), in plain words. */
  notice: string | null;
  arm: () => Promise<void>;
  /** Loads a preview. Rejects with a PreviewError (its message names the cause) when it can't. */
  loadMidi: (input: LoadMidiInput) => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  seek: (seconds: number) => void;
  setVolume: (value: number) => void;
  toggleLoop: () => void;
  setInstrument: (instrument: PreviewInstrument) => Promise<void>;
  getWaveform: () => Uint8Array | null;
  /** Stops playback and unloads the preview (the docked player goes away). Returns the id of the control that started it. */
  close: () => string | null;
};

/** The stable part of the player: what a screen needs to start a preview. */
export type PlayerControls = Pick<PlayerApi, "arm" | "loadMidi" | "play">;

const PlayerContext = createContext<PlayerApi | null>(null);
const PlayerControlsContext = createContext<PlayerControls | null>(null);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type Tone = typeof ToneModule;

// The audio stack (Tone, the MIDI parser and the soundfont loader) is loaded on the first
// preview, not with the page, and the AudioContext is only created after that user gesture.
let tonePromise: Promise<Tone> | null = null;
function loadTone(): Promise<Tone> {
  tonePromise ??= import("tone").catch((err: unknown) => {
    tonePromise = null;
    throw err;
  });
  return tonePromise;
}

type PlayerProviderProps = { children: ReactNode };

function usePlayerProviderRender({ children }: PlayerProviderProps) {
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [loop, setLoop] = useState(false);
  const [instrument, setInstrumentState] = useState<PreviewInstrument>("piano");
  const [instrumentLoading, setInstrumentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const masterGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const waveformBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const instrumentsRef = useRef<Map<PreviewInstrument, SoundfontPlayer>>(new Map());
  const loadedNotesRef = useRef<Map<PreviewInstrument, Set<string>>>(new Map());
  const activeInstrumentRef = useRef<SoundfontPlayer | null>(null);

  const partRef = useRef<
    ToneModule.Part<{ time: number; name: string; duration: number; velocity: number }> | null
  >(null);
  // Set once the audio stack has loaded; every transport call reads it.
  const toneRef = useRef<Tone | null>(null);

  const rafRef = useRef<number | null>(null);
  const durationRef = useRef(0);
  const positionRef = useRef(0);
  const loopRef = useRef(false);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    loopRef.current = loop;
    if (partRef.current) {
      partRef.current.loop = loop;
      if (loop) partRef.current.loopEnd = durationRef.current;
    }
  }, [loop]);

  const currentMidiNotesRef = useRef<string[]>([]);
  const lastInputRef = useRef<LoadMidiInput | null>(null);

  const ensureTone = useCallback(async () => {
    if (!toneRef.current) toneRef.current = await loadTone();
    return toneRef.current;
  }, []);

  function getAudioContext(tone: Tone): AudioContext {
    return tone.getContext().rawContext as AudioContext;
  }

  const ensureAudioGraph = useCallback(async () => {
    const tone = await ensureTone();
    if (masterGainRef.current && analyserRef.current && waveformBufferRef.current) return tone;

    const ac = getAudioContext(tone);
    const master = ac.createGain();
    master.gain.value = volume;
    const analyser = ac.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.85;
    master.connect(analyser);
    analyser.connect(ac.destination);

    masterGainRef.current = master;
    analyserRef.current = analyser;
    waveformBufferRef.current = new Uint8Array(analyser.fftSize);
    return tone;
  }, [ensureTone, volume]);

  function stopAllSound() {
    for (const instrumentPlayer of instrumentsRef.current.values()) {
      try {
        instrumentPlayer.stop();
      } catch {
        // ignore
      }
    }
  }

  const setVolume = useCallback((value: number) => {
    const next = clamp(value, 0, 1);
    setVolumeState(next);
    const tone = toneRef.current;
    if (masterGainRef.current && tone) {
      masterGainRef.current.gain.setTargetAtTime(next, getAudioContext(tone).currentTime, 0.03);
    }
  }, []);

  const stopInternal = useCallback((opts?: { keepPosition?: number }) => {
    const tone = toneRef.current;
    if (tone) {
      tone.Transport.stop();
      tone.Transport.cancel(0);
      tone.Transport.seconds = 0;
    }
    stopAllSound();
    const keep = opts?.keepPosition;
    setStatus((prev) => (prev === "idle" ? "idle" : "ready"));
    if (typeof keep === "number") {
      setPosition(keep);
      positionRef.current = keep;
    } else {
      setPosition(0);
      positionRef.current = 0;
    }
  }, []);

  const stop = useCallback(() => stopInternal(), [stopInternal]);

  const pause = useCallback(() => {
    if (status !== "playing") return;
    toneRef.current?.Transport.pause();
    stopAllSound();
    setStatus("paused");
  }, [status]);

  const seek = useCallback((seconds: number) => {
    if (!durationRef.current) return;
    const next = clamp(seconds, 0, durationRef.current);
    if (toneRef.current) toneRef.current.Transport.seconds = next;
    setPosition(next);
    positionRef.current = next;
  }, []);

  const arm = useCallback(async () => {
    // Needs a user gesture in most browsers. Call from click handlers (Play/Preview).
    const tone = await ensureTone();
    await tone.start();
  }, [ensureTone]);

  const ensureInstrumentLoaded = useCallback(
    async (next: PreviewInstrument, requiredNotes: string[]) => {
      const tone = await ensureAudioGraph();
      const dest = masterGainRef.current;
      if (!dest) throw new Error("Audio output not initialized.");

      const existing = instrumentsRef.current.get(next);
      const previouslyLoaded = loadedNotesRef.current.get(next);
      const needsReload =
        !existing ||
        !previouslyLoaded ||
        requiredNotes.some((note) => !previouslyLoaded.has(note));

      if (!needsReload) {
        activeInstrumentRef.current = existing;
        return existing;
      }

      setInstrumentLoading(true);
      try {
        const ac = getAudioContext(tone);
        const { default: Soundfont } = await import("soundfont-player");
        const soundfontSet = process.env.NEXT_PUBLIC_SOUNDFONT || "MusyngKite";
        const fromBase = process.env.NEXT_PUBLIC_SOUNDFONT_BASE_URL;

        const instrumentName =
          next === "piano"
            ? "acoustic_grand_piano"
            : next === "epiano"
              ? "electric_piano_1"
              : next === "strings"
                ? "string_ensemble_1"
                : "pad_2_warm";

        const nextNotes = new Set<string>([...(previouslyLoaded ?? []), ...requiredNotes]);
        const player = await Soundfont.instrument(ac, instrumentName, {
          soundfont: soundfontSet,
          ...(fromBase ? { from: fromBase } : {}),
          notes: Array.from(nextNotes),
        });

        player.connect(dest);
        instrumentsRef.current.set(next, player);
        loadedNotesRef.current.set(next, nextNotes);
        activeInstrumentRef.current = player;
        return player;
      } finally {
        setInstrumentLoading(false);
      }
    },
    [ensureAudioGraph],
  );

  const setInstrument = useCallback(
    async (next: PreviewInstrument) => {
      const previous = instrument;
      setInstrumentState(next);
      setNotice(null);
      if (!currentMidiNotesRef.current.length) return;
      try {
        await ensureInstrumentLoaded(next, currentMidiNotesRef.current);
      } catch (err) {
        // The preview keeps the instrument it already has; say so instead of failing it.
        console.warn("preview_instrument_failed", err);
        setInstrumentState(previous);
        const kept = instrumentsRef.current.get(previous);
        if (kept) activeInstrumentRef.current = kept;
        setNotice(instrumentSwitchMessage(next, previous));
      }
    },
    [ensureInstrumentLoaded, instrument],
  );

  const loadMidi = useCallback(
    async (input: LoadMidiInput) => {
      lastInputRef.current = input;
      setStatus("loading");
      setError(null);
      setNotice(null);
      setNowPlaying({ kind: "midi", title: input.title, subtitle: input.subtitle });
      setDuration(0);
      setPosition(0);
      // Whatever was playing stops now, so a load that fails never leaves sound running
      // without a player to stop it.
      toneRef.current?.Transport.stop();
      stopAllSound();

      // Each step names its own cause, so the artist hears what failed and what to do.
      let step: PreviewFailure = "audio";
      try {
        const [tone, { Midi }] = await Promise.all([ensureAudioGraph(), import("@tonejs/midi")]);

        tone.Transport.stop();
        tone.Transport.seconds = 0;
        tone.Transport.cancel(0);
        stopAllSound();
        if (partRef.current) {
          partRef.current.dispose();
          partRef.current = null;
        }

        step = "file";
        const parsed = new Midi(input.midi);
        const bpm = parsed.header.tempos[0]?.bpm ?? 120;
        tone.Transport.bpm.value = bpm;

        const events: Array<{
          time: number;
          name: string;
          duration: number;
          velocity: number;
        }> = [];

        for (const track of parsed.tracks) {
          for (const note of track.notes) {
            events.push({
              time: note.time,
              name: note.name,
              duration: note.duration,
              velocity: note.velocity,
            });
          }
        }

        events.sort((a, b) => a.time - b.time);
        const uniqueNotes = Array.from(new Set(events.map((evt) => evt.name))).sort();
        currentMidiNotesRef.current = uniqueNotes;

        const totalDuration =
          typeof parsed.duration === "number" && Number.isFinite(parsed.duration)
            ? parsed.duration
            : events.reduce((max, evt) => Math.max(max, evt.time + evt.duration), 0);

        setDuration(totalDuration);
        durationRef.current = totalDuration;

        step = "instrument";
        await ensureInstrumentLoaded(instrument, uniqueNotes);
        step = "audio";

        const part = new tone.Part((time, value) => {
          const instrumentPlayer = activeInstrumentRef.current;
          if (!instrumentPlayer) return;

          // soundfont-player expects absolute audio context times (Tone uses same context).
          instrumentPlayer.play(value.name, time, {
            gain: clamp(value.velocity * 0.85, 0, 1),
            duration: Math.max(0.02, value.duration),
          });
        }, events).start(0);

        part.loop = loopRef.current;
        if (loopRef.current) part.loopEnd = totalDuration;
        partRef.current = part;

        setStatus("ready");
      } catch (err) {
        // Keep the technical reason for debugging; the artist sees the cause and Retry, where
        // they asked for the preview (the docked player doesn't open for a failed one).
        console.warn("preview_load_failed", err);
        const failure = new PreviewError(step, instrument);
        setError(failure.message);
        setStatus("error");
        throw failure;
      }
    },
    [ensureAudioGraph, ensureInstrumentLoaded, instrument],
  );

  const play = useCallback(async () => {
    if (!partRef.current) return;
    if (instrumentLoading) return;
    const tone = await ensureTone();

    // If we ended the previous playback, restart from the beginning.
    if (durationRef.current && positionRef.current >= durationRef.current - 0.01) {
      tone.Transport.seconds = 0;
      setPosition(0);
      positionRef.current = 0;
    }

    await arm();
    tone.Transport.start();
    setStatus("playing");
  }, [arm, ensureTone, instrumentLoading]);

  const close = useCallback(() => {
    stopInternal();
    partRef.current?.dispose();
    partRef.current = null;
    currentMidiNotesRef.current = [];
    durationRef.current = 0;
    setDuration(0);
    setStatus("idle");
    setNowPlaying(null);
    setError(null);
    setNotice(null);
    const returnFocusId = lastInputRef.current?.returnFocusId ?? null;
    lastInputRef.current = null;
    return returnFocusId;
  }, [stopInternal]);

  const toggleLoop = useCallback(() => {
    setLoop((prev) => !prev);
  }, []);

  useEffect(() => {
    if (status !== "playing") {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    const tone = toneRef.current;
    if (!tone) return;
    const tick = () => {
      const next = tone.Transport.seconds;
      setPosition(next);
      positionRef.current = next;

      if (!loopRef.current && durationRef.current && next >= durationRef.current - 0.01) {
        stopInternal({ keepPosition: durationRef.current });
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [status, stopInternal]);

  useEffect(() => {
    const instruments = instrumentsRef.current;
    const loadedNotes = loadedNotesRef.current;
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      partRef.current?.dispose();
      stopAllSound();
      instruments.clear();
      loadedNotes.clear();
      masterGainRef.current?.disconnect();
      analyserRef.current?.disconnect();
    };
  }, []);

  const getWaveform = useCallback(() => {
    const analyser = analyserRef.current;
    const buf = waveformBufferRef.current;
    if (!analyser || !buf) return null;
    analyser.getByteTimeDomainData(buf);
    return buf;
  }, []);

  const api = useMemo<PlayerApi>(
    () => ({
      status,
      nowPlaying,
      duration,
      position,
      volume,
      loop,
      instrument,
      instrumentLoading,
      error,
      notice,
      arm,
      loadMidi,
      play,
      pause,
      stop,
      seek,
      setVolume,
      toggleLoop,
      setInstrument,
      getWaveform,
      close,
    }),
    [
      arm,
      close,
      duration,
      error,
      getWaveform,
      instrument,
      instrumentLoading,
      loadMidi,
      loop,
      nowPlaying,
      notice,
      pause,
      play,
      position,
      seek,
      setInstrument,
      setVolume,
      status,
      stop,
      toggleLoop,
      volume,
    ],
  );

  // Screens that only start previews read this context, so they do not re-render on every
  // playback frame while the position ticks.
  const controls = useMemo<PlayerControls>(() => ({ arm, loadMidi, play }), [arm, loadMidi, play]);

  return (
    <PlayerControlsContext.Provider value={controls}>
      <PlayerContext.Provider value={api}>{children}</PlayerContext.Provider>
    </PlayerControlsContext.Provider>
  );
}

export function PlayerProvider(props: PlayerProviderProps) {
  return usePlayerProviderRender(props);
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within a PlayerProvider.");
  return ctx;
}

export function usePlayerControls() {
  const ctx = useContext(PlayerControlsContext);
  if (!ctx) throw new Error("usePlayerControls must be used within a PlayerProvider.");
  return ctx;
}
