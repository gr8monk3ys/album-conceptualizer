"use client";

import { useEffect, useRef } from "react";
import { Loader2, Pause, Play, Repeat2, RotateCcw, Square, Volume2 } from "lucide-react";

import { usePlayer, type PreviewInstrument } from "@/components/player/player-provider";
import { Button, IconButton, selectClass } from "@/components/ui";
import { cn } from "@/lib/utils";

function formatClock(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const whole = Math.floor(totalSeconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** The live signal of the preview, drawn in the muted ink colour. Decorative for readers. */
function Waveform({ getWaveform }: { getWaveform: () => Uint8Array | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;
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

      const data = getWaveform();
      if (data && data.length) {
        ctx.lineWidth = 1;
        // The canvas carries `text-ink-3`, so the stroke follows the palette token.
        ctx.strokeStyle = getComputedStyle(canvasEl).color;
        ctx.beginPath();
        const stride = Math.max(1, Math.floor(data.length / 160));
        for (let i = 0; i < data.length; i += stride) {
          const x = (i / Math.max(1, data.length - 1)) * w;
          const v = (data[i] - 128) / 128;
          const y = h / 2 + v * (h / 2) * 0.92;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [getWaveform]);

  return <canvas ref={canvasRef} aria-hidden="true" className="hidden h-8 w-24 shrink-0 text-ink-3 sm:block" />;
}

/** The preview player, docked to the bottom of the viewport once a preview is loaded. */
export function Playerbar() {
  const player = usePlayer();

  const loaded = player.status !== "idle";
  const playing = player.status === "playing";
  const loading = player.status === "loading" || player.instrumentLoading;
  const failed = player.status === "error";
  const canPlay = loaded && !loading && !failed;
  const title = player.nowPlaying?.title ?? "Preview";
  const subtitle =
    player.status === "loading"
      ? "Loading preview…"
      : player.instrumentLoading
        ? "Loading instrument…"
        : (player.nowPlaying?.subtitle ?? "");

  if (!loaded) return null;

  return (
    <>
      {/* Keeps the end of the page reachable above the docked bar. */}
      <div aria-hidden="true" className="h-44 sm:h-32" />
      <section
        aria-label="Preview player"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line-strong bg-raised md:left-64"
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2 md:px-8">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
            <div className="min-w-0 flex-1 basis-40">
              <p className="truncate text-sm font-semibold text-ink">{title}</p>
              <p role="status" className={cn("truncate text-xs", failed ? "text-danger" : "text-ink-2")}>
                {failed ? (player.error ?? "Couldn't render this preview.") : subtitle}
              </p>
            </div>

            {failed ? (
              <Button tone="secondary" onClick={() => void player.retry()}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Retry
              </Button>
            ) : (
              <div className="flex items-center gap-1">
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
            )}

            <div className="hidden items-center gap-4 md:flex">
              <label className="flex items-center gap-2 text-xs text-ink-2">
                <span>Instrument</span>
                <select
                  value={player.instrument}
                  onChange={(e) => void player.setInstrument(e.target.value as PreviewInstrument)}
                  className={cn(selectClass, "w-auto")}
                  disabled={player.status === "loading"}
                >
                  <option value="piano">Piano</option>
                  <option value="epiano">Electric piano</option>
                  <option value="strings">Strings</option>
                  <option value="pad">Pad</option>
                </select>
              </label>
              <label className="flex min-h-11 items-center gap-2 text-xs text-ink-2">
                <Volume2 className="h-4 w-4" aria-hidden="true" />
                <span>Volume</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={player.volume}
                  onChange={(e) => player.setVolume(Number(e.target.value))}
                  className="w-24 accent-accent"
                />
              </label>
            </div>
          </div>

          {!failed ? (
            <div className="flex min-w-0 items-center gap-3">
              <span className="type-figure w-10 shrink-0 text-xs text-ink-2">{formatClock(player.position)}</span>
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
                className="min-h-11 min-w-0 flex-1 accent-accent"
              />
              <span className="type-figure w-10 shrink-0 text-right text-xs text-ink-2">
                {formatClock(player.duration)}
              </span>
              <Waveform getWaveform={player.getWaveform} />
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
