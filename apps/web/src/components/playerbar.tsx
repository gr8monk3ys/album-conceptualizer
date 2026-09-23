"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown, Loader2, Pause, Play, Repeat2, Square, Volume2, X } from "lucide-react";

import { INSTRUMENT_LABELS, usePlayer, type PreviewInstrument } from "@/components/player/player-provider";
import { IconButton, buttonClass, selectClass } from "@/components/ui";
import { cn } from "@/lib/utils";

function formatClock(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const whole = Math.floor(totalSeconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * The live signal of the preview, drawn in the muted ink colour. Decorative for readers.
 * It animates only while the preview plays; otherwise, and when the reader prefers reduced
 * motion, it draws one still frame.
 */
function Waveform({ getWaveform, playing }: { getWaveform: () => Uint8Array | null; playing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;
    // The canvas carries `text-ink-3`, so the stroke follows the palette token. Read once.
    const stroke = getComputedStyle(canvasEl).color;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.floor(canvasEl.clientWidth * dpr));
      const height = Math.max(1, Math.floor(canvasEl.clientHeight * dpr));
      if (canvasEl.width !== width || canvasEl.height !== height) {
        canvasEl.width = width;
        canvasEl.height = height;
      }
      const w = width / dpr;
      const h = height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      ctx.strokeStyle = stroke;
      ctx.beginPath();

      const data = playing ? getWaveform() : null;
      if (data && data.length) {
        const stride = Math.max(1, Math.floor(data.length / 160));
        for (let i = 0; i < data.length; i += stride) {
          const x = (i / Math.max(1, data.length - 1)) * w;
          const v = (data[i] - 128) / 128;
          const y = h / 2 + v * (h / 2) * 0.92;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      } else {
        // At rest: a flat line through the middle.
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
      }
      ctx.stroke();

      if (playing && !still) raf = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [getWaveform, playing]);

  return <canvas ref={canvasRef} aria-hidden="true" className="hidden h-8 w-24 flex-none text-ink-3 sm:block" />;
}

function InstrumentSelect({ id }: { id: string }) {
  const player = usePlayer();
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <label htmlFor={id} className="text-xs text-ink-2">
        Instrument
      </label>
      <select
        id={id}
        value={player.instrument}
        onChange={(e) => void player.setInstrument(e.target.value as PreviewInstrument)}
        className={cn(selectClass, "w-auto")}
        disabled={player.status === "loading"}
      >
        {(Object.keys(INSTRUMENT_LABELS) as PreviewInstrument[]).map((value) => (
          <option key={value} value={value}>
            {INSTRUMENT_LABELS[value]}
          </option>
        ))}
      </select>
    </div>
  );
}

function VolumeSlider({ id }: { id: string }) {
  const player = usePlayer();
  return (
    <div className="flex min-h-11 min-w-0 flex-wrap items-center gap-2">
      <Volume2 className="h-4 w-4 text-ink-2" aria-hidden="true" />
      <label htmlFor={id} className="text-xs text-ink-2">
        Volume
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={player.volume}
        onChange={(e) => player.setVolume(Number(e.target.value))}
        aria-valuetext={`${Math.round(player.volume * 100)}%`}
        className="min-h-11 w-24 accent-ink-2"
      />
    </div>
  );
}

/** The player collapses to one row on short screens (a phone on its side). */
const SHORT_SCREEN = "(max-height: 500px)";
/** The docked player never takes more than this share of the viewport's height. */
const MAX_SHARE = 0.4;

function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function PlayPauseButton() {
  const player = usePlayer();
  const playing = player.status === "playing";
  const loading = player.status === "loading" || player.instrumentLoading;
  const canPlay = !loading && (player.status === "ready" || player.status === "paused" || playing);
  return (
    <IconButton
      label={playing ? "Pause" : "Play"}
      onClick={() => {
        if (!canPlay) return;
        if (playing) player.pause();
        else void player.play();
      }}
      disabled={!canPlay}
      className="border border-line-strong text-ink"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : playing ? (
        <Pause className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Play className="h-4 w-4" aria-hidden="true" />
      )}
    </IconButton>
  );
}

/**
 * The preview player, docked to the bottom of the viewport once a preview has loaded. It opens
 * only for a preview that loaded (a failed one is explained where it was asked for, with
 * Retry), never takes more than 40% of the viewport's height (scrolling inside itself past
 * that), folds to one row (title, Play, Close) on short screens or whenever the full player
 * wouldn't fit, and Close stops playback and removes it.
 */
export function Playerbar() {
  const player = usePlayer();
  const barRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [barHeight, setBarHeight] = useState(0);
  const [tooTall, setTooTall] = useState(false);
  const shortScreen = useMediaQuery(SHORT_SCREEN);

  // Docked once a preview is ready; it stays docked while the next one loads, and leaves on
  // Close or a failed load.
  const settled = player.status === "ready" || player.status === "playing" || player.status === "paused";
  const [docked, setDocked] = useState(false);
  if (settled && !docked) setDocked(true);
  if ((player.status === "idle" || player.status === "error") && docked) setDocked(false);

  const compact = shortScreen || tooTall;
  const playing = player.status === "playing";
  const loading = player.status === "loading" || player.instrumentLoading;
  const title = player.nowPlaying?.title ?? "Preview";
  const subtitle =
    player.status === "loading"
      ? "Loading preview…"
      : player.instrumentLoading
        ? "Loading instrument…"
        : (player.nowPlaying?.subtitle ?? "");

  // While the bar is docked, the page's bottom scroll padding matches it, so a control that
  // receives focus near the bottom of the viewport scrolls clear of the bar, not under it.
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      const height = Math.ceil(el.getBoundingClientRect().height);
      setBarHeight(height);
      root.style.scrollPaddingBottom = `${height + 16}px`;
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty("scroll-padding-bottom");
    };
  }, [docked]);

  // The full player folds to one row when it would need more than its share of the viewport
  // (enlarged text, a small window). A resize gives the full player another try.
  useEffect(() => {
    const content = contentRef.current;
    if (!docked || compact || !content) return;
    const observer = new ResizeObserver(() => {
      if (content.getBoundingClientRect().height > window.innerHeight * MAX_SHARE) setTooTall(true);
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [docked, compact]);

  useEffect(() => {
    if (!docked) return;
    const retry = () => setTooTall(false);
    window.addEventListener("resize", retry);
    return () => window.removeEventListener("resize", retry);
  }, [docked]);

  function close() {
    const returnTo = player.close();
    const target = returnTo ? document.getElementById(returnTo) : null;
    if (target) target.focus();
  }

  if (!docked) return null;

  const closeButton = (
    <IconButton label="Close preview player" onClick={close}>
      <X className="h-4 w-4" aria-hidden="true" />
    </IconButton>
  );

  const status = player.notice ?? subtitle;

  return (
    <>
      {/* Keeps the end of the page reachable above the docked bar, whatever its height. */}
      <div aria-hidden="true" style={{ height: barHeight }} />
      <section
        ref={barRef}
        aria-label="Preview player"
        className="fixed inset-x-0 bottom-0 z-40 max-h-[40dvh] overflow-y-auto border-t border-line-strong bg-raised md:left-[var(--sidebar-w,min(16rem,33vw))]"
      >
        {compact ? (
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 md:px-8">
            <p className="min-w-0 flex-1 truncate text-sm text-ink" title={subtitle ? `${title} · ${subtitle}` : title}>
              <span className="font-semibold">{title}</span>
              {status ? <span className="text-ink-2"> · {status}</span> : null}
            </p>
            <span role="status" className="sr-only">
              {player.notice ?? (player.status === "loading" ? "Loading preview…" : "")}
            </span>
            <PlayPauseButton />
            {closeButton}
          </div>
        ) : (
          <div ref={contentRef} className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2 md:px-8">
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1 basis-40">
                <p className="truncate text-sm font-semibold text-ink">{title}</p>
                <p role="status" className={cn("text-xs", player.notice ? "text-warn" : "truncate text-ink-2")}>
                  {status}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <PlayPauseButton />
                <IconButton label="Stop" onClick={() => player.stop()} disabled={loading}>
                  <Square className="h-4 w-4" aria-hidden="true" />
                </IconButton>
                <IconButton
                  label="Repeat"
                  aria-pressed={player.loop}
                  onClick={() => player.toggleLoop()}
                  disabled={loading}
                  className={player.loop ? "bg-selected text-ink" : undefined}
                >
                  <Repeat2 className="h-4 w-4" aria-hidden="true" />
                </IconButton>
              </div>

              <div className="hidden flex-wrap items-center gap-x-4 gap-y-1 md:flex">
                <InstrumentSelect id="player-instrument" />
                <VolumeSlider id="player-volume" />
              </div>

              {closeButton}
            </div>

            <div className="flex min-w-0 items-center gap-3">
              <span className="type-figure min-w-10 text-xs text-ink-2">{formatClock(player.position)}</span>
              <input
                type="range"
                min={0}
                max={Math.max(player.duration, 0.01)}
                step={0.1}
                value={Math.min(player.position, player.duration || 0)}
                disabled={!player.duration}
                onChange={(e) => player.seek(Number(e.target.value))}
                aria-label="Position"
                aria-valuetext={`${formatClock(player.position)} of ${formatClock(player.duration)}`}
                className="min-h-11 min-w-0 flex-1 accent-ink"
              />
              <span className="type-figure min-w-10 text-right text-xs text-ink-2">
                {formatClock(player.duration)}
              </span>
              <Waveform getWaveform={player.getWaveform} playing={playing} />
            </div>

            {/* On small screens the sound settings live in a disclosure, still one tap away. */}
            <details className="group w-full md:hidden">
              <summary
                className={cn(
                  buttonClass("ghost"),
                  "-ml-2 cursor-pointer list-none justify-start px-2 [&::-webkit-details-marker]:hidden",
                )}
              >
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                Sound options
              </summary>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-1">
                <InstrumentSelect id="player-instrument-mobile" />
                <VolumeSlider id="player-volume-mobile" />
              </div>
            </details>
          </div>
        )}
      </section>
    </>
  );
}
