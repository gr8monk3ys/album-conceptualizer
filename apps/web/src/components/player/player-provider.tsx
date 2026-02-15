"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as Tone from "tone";
import { Midi } from "@tonejs/midi";

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
};

type PlayerApi = {
  status: PlayerStatus;
  nowPlaying: NowPlaying | null;
  duration: number;
  position: number;
  volume: number;
  loop: boolean;
  error: string | null;
  arm: () => Promise<void>;
  loadMidi: (input: LoadMidiInput) => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  seek: (seconds: number) => void;
  setVolume: (value: number) => void;
  toggleLoop: () => void;
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
  const [error, setError] = useState<string | null>(null);

  const gainRef = useRef<Tone.Gain | null>(null);
  const synthRef = useRef<Tone.PolySynth<Tone.Synth> | null>(null);
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

  const setVolume = useCallback((value: number) => {
    const next = clamp(value, 0, 1);
    setVolumeState(next);
    if (gainRef.current) {
      gainRef.current.gain.rampTo(next, 0.05);
    }
  }, []);

  const stopInternal = useCallback((opts?: { keepPosition?: number }) => {
    Tone.Transport.stop();
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

  const loadMidi = useCallback(
    async (input: LoadMidiInput) => {
      setStatus("loading");
      setError(null);
      setNowPlaying({ kind: "midi", title: input.title, subtitle: input.subtitle });
      setDuration(0);
      setPosition(0);

      try {
        Tone.Transport.stop();
        Tone.Transport.seconds = 0;
        if (partRef.current) {
          partRef.current.dispose();
          partRef.current = null;
        }
        Tone.Transport.cancel(0);

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

        const totalDuration =
          typeof parsed.duration === "number" && Number.isFinite(parsed.duration)
            ? parsed.duration
            : events.reduce((max, evt) => Math.max(max, evt.time + evt.duration), 0);

        setDuration(totalDuration);
        durationRef.current = totalDuration;

        if (!gainRef.current) {
          gainRef.current = new Tone.Gain(volume).toDestination();
        }
        gainRef.current.gain.value = volume;

        if (!synthRef.current) {
          synthRef.current = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "triangle" },
            envelope: { attack: 0.01, decay: 0.12, sustain: 0.2, release: 0.55 },
          }).connect(gainRef.current);
        }

        const part = new Tone.Part((time, value) => {
          synthRef.current?.triggerAttackRelease(value.name, value.duration, time, value.velocity);
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
    [volume],
  );

  const play = useCallback(async () => {
    if (!partRef.current) return;

    // If we ended the previous playback, restart from the beginning.
    if (durationRef.current && positionRef.current >= durationRef.current - 0.01) {
      Tone.Transport.seconds = 0;
      setPosition(0);
      positionRef.current = 0;
    }

    await arm();
    Tone.Transport.start();
    setStatus("playing");
  }, [arm]);

  const toggleLoop = useCallback(() => {
    setLoop((prev) => !prev);
  }, []);

  useEffect(() => {
    if (status !== "playing") {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    const tick = () => {
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
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [status, stopInternal]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      partRef.current?.dispose();
      synthRef.current?.dispose();
      gainRef.current?.dispose();
    };
  }, []);

  const api = useMemo<PlayerApi>(
    () => ({
      status,
      nowPlaying,
      duration,
      position,
      volume,
      loop,
      error,
      arm,
      loadMidi,
      play,
      pause,
      stop,
      seek,
      setVolume,
      toggleLoop,
    }),
    [
      arm,
      duration,
      error,
      loadMidi,
      loop,
      nowPlaying,
      pause,
      play,
      position,
      seek,
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
