"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as Tone from "tone";
import { Midi } from "@tonejs/midi";
import Soundfont, { type Player as SoundfontPlayer } from "soundfont-player";

type PlayerStatus = "idle" | "loading" | "ready" | "playing" | "paused" | "error";

export type PreviewInstrument = "piano" | "epiano" | "strings" | "pad";

type NowPlaying = {
  kind: "midi";
  title: string;
  subtitle?: string;
};

type LoadMidiInput = {
  midi: ArrayBuffer;
  title: string;
  subtitle?: string;
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
  arm: () => Promise<void>;
  loadMidi: (input: LoadMidiInput) => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  seek: (seconds: number) => void;
  setVolume: (value: number) => void;
  toggleLoop: () => void;
  setInstrument: (instrument: PreviewInstrument) => Promise<void>;
  getWaveform: () => Uint8Array | null;
};

const PlayerContext = createContext<PlayerApi | null>(null);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [loop, setLoop] = useState(false);
  const [instrument, setInstrumentState] = useState<PreviewInstrument>("piano");
  const [instrumentLoading, setInstrumentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const masterGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const waveformBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const instrumentsRef = useRef<Map<PreviewInstrument, SoundfontPlayer>>(new Map());
  const loadedNotesRef = useRef<Map<PreviewInstrument, Set<string>>>(new Map());
  const activeInstrumentRef = useRef<SoundfontPlayer | null>(null);

  const partRef = useRef<
    Tone.Part<{ time: number; name: string; duration: number; velocity: number }> | null
  >(null);

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

  function getAudioContext(): AudioContext {
    return Tone.getContext().rawContext as AudioContext;
  }

  const ensureAudioGraph = useCallback(() => {
    if (masterGainRef.current && analyserRef.current && waveformBufferRef.current) return;

    const ac = getAudioContext();
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
  }, [volume]);

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
    if (masterGainRef.current) {
      masterGainRef.current.gain.setTargetAtTime(next, getAudioContext().currentTime, 0.03);
    }
  }, []);

  const stopInternal = useCallback((opts?: { keepPosition?: number }) => {
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
    stopAllSound();
    const keep = opts?.keepPosition;
    Tone.Transport.seconds = 0;
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
    Tone.Transport.pause();
    stopAllSound();
    setStatus("paused");
  }, [status]);

  const seek = useCallback((seconds: number) => {
    if (!durationRef.current) return;
    const next = clamp(seconds, 0, durationRef.current);
    Tone.Transport.seconds = next;
    setPosition(next);
    positionRef.current = next;
  }, []);

  const arm = useCallback(async () => {
    // Needs a user gesture in most browsers. Call from click handlers (Play/Preview).
    await Tone.start();
  }, []);

  const ensureInstrumentLoaded = useCallback(
    async (next: PreviewInstrument, requiredNotes: string[]) => {
      ensureAudioGraph();
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
        const ac = getAudioContext();
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
      setInstrumentState(next);
      if (currentMidiNotesRef.current.length) {
        await ensureInstrumentLoaded(next, currentMidiNotesRef.current);
      }
    },
    [ensureInstrumentLoaded],
  );

  const loadMidi = useCallback(
    async (input: LoadMidiInput) => {
      setStatus("loading");
      setError(null);
      setNowPlaying({ kind: "midi", title: input.title, subtitle: input.subtitle });
      setDuration(0);
      setPosition(0);

      try {
        ensureAudioGraph();

        Tone.Transport.stop();
        Tone.Transport.seconds = 0;
        Tone.Transport.cancel(0);
        stopAllSound();
        if (partRef.current) {
          partRef.current.dispose();
          partRef.current = null;
        }

        const parsed = new Midi(input.midi);
        const bpm = parsed.header.tempos[0]?.bpm ?? 120;
        Tone.Transport.bpm.value = bpm;

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

        await ensureInstrumentLoaded(instrument, uniqueNotes);

        const part = new Tone.Part((time, value) => {
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
        const message = err instanceof Error ? err.message : "Unable to load preview.";
        setError(message);
        setStatus("error");
      }
    },
    [ensureAudioGraph, ensureInstrumentLoaded, instrument],
  );

  const play = useCallback(async () => {
    if (!partRef.current) return;
    if (instrumentLoading) return;

    // If we ended the previous playback, restart from the beginning.
    if (durationRef.current && positionRef.current >= durationRef.current - 0.01) {
      Tone.Transport.seconds = 0;
      setPosition(0);
      positionRef.current = 0;
    }

    await arm();
    Tone.Transport.start();
    setStatus("playing");
  }, [arm, instrumentLoading]);

  const toggleLoop = useCallback(() => {
    setLoop((prev) => !prev);
  }, []);

  useEffect(() => {
    if (status !== "playing") {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    let mounted = true;

    const tick = () => {
      if (!mounted) return;

      const next = Tone.Transport.seconds;
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
      mounted = false;
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
    }),
    [
      arm,
      duration,
      error,
      getWaveform,
      instrument,
      instrumentLoading,
      loadMidi,
      loop,
      nowPlaying,
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

  return <PlayerContext.Provider value={api}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within a PlayerProvider.");
  return ctx;
}
