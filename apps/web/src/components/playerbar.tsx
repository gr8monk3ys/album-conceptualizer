"use client";

import { Pause, Play, Repeat2, SkipBack, SkipForward, Square, Volume2 } from "lucide-react";

import { usePlayer } from "@/components/player/player-provider";

function formatClock(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const whole = Math.floor(totalSeconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function Playerbar() {
  const player = usePlayer();

  const loaded = player.status !== "idle";
  const playing = player.status === "playing";
  const canPlay = loaded && player.status !== "loading" && player.status !== "error";
  const title = player.nowPlaying?.title ?? "No preview loaded";
  const subtitle =
    player.status === "loading"
      ? "Loading preview…"
      : player.status === "error"
        ? player.error ?? "Preview failed."
        : player.nowPlaying?.subtitle ?? "Load a section preview from Studio.";

  const ratio = player.duration ? Math.min(1, Math.max(0, player.position / player.duration)) : 0;

  return (
    <div className="pointer-events-auto fixed bottom-4 left-1/2 z-50 w-[min(1120px,calc(100vw-32px))] -translate-x-1/2 rounded-2xl border border-[var(--border)] bg-[rgba(15,16,21,0.78)] px-4 py-3 shadow-[0_30px_80px_rgba(0,0,0,0.6)] backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-10 w-10 flex-none rounded-xl bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.25),rgba(255,255,255,0.06))]" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[var(--text)]">{title}</div>
            <div className="truncate text-xs text-[var(--muted2)]">{subtitle}</div>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-[var(--muted)]">
            <button
              type="button"
              disabled
              className="grid h-9 w-9 place-items-center rounded-full opacity-40"
              aria-label="Previous (coming soon)"
              title="Previous (coming soon)"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (!canPlay) return;
                if (playing) player.pause();
                else void player.play();
              }}
              disabled={!canPlay}
              className="grid h-10 w-10 place-items-center rounded-full bg-white text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={playing ? "Pause" : "Play"}
              title={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!loaded) return;
                player.stop();
              }}
              disabled={!loaded || player.status === "loading"}
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-[rgba(255,255,255,0.06)] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Stop"
              title="Stop"
            >
              <Square className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled
              className="grid h-9 w-9 place-items-center rounded-full opacity-40"
              aria-label="Next (coming soon)"
              title="Next (coming soon)"
            >
              <SkipForward className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => player.toggleLoop()}
              disabled={!loaded || player.status === "loading"}
              className={[
                "grid h-9 w-9 place-items-center rounded-full hover:bg-[rgba(255,255,255,0.06)] disabled:cursor-not-allowed disabled:opacity-40",
                player.loop ? "bg-[rgba(109,94,252,0.20)] text-[var(--text)]" : "",
              ].join(" ")}
              aria-label={player.loop ? "Disable repeat" : "Enable repeat"}
              title={player.loop ? "Disable repeat" : "Enable repeat"}
            >
              <Repeat2 className="h-4 w-4" />
            </button>
          </div>

          <div className="flex w-full max-w-[520px] items-center gap-3">
            <div className="text-[11px] tabular-nums text-[var(--muted2)]">
              {formatClock(player.position)}
            </div>
            <button
              type="button"
              onPointerDown={(event) => {
                if (!player.duration) return;
                const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                const x = event.clientX - rect.left;
                const next = clamp((x / rect.width) * player.duration, 0, player.duration);
                player.seek(next);
              }}
              className="relative h-2 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]"
              aria-label="Seek"
              title="Seek"
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,var(--accent2),var(--accent))]"
                style={{ width: `${Math.round(ratio * 100)}%` }}
              />
            </button>
            <div className="text-[11px] tabular-nums text-[var(--muted2)]">
              {formatClock(player.duration)}
            </div>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Volume2 className="h-4 w-4 text-[var(--muted2)]" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={player.volume}
            onChange={(e) => player.setVolume(Number(e.target.value))}
            className="w-28 accent-[var(--accent)]"
            aria-label="Volume"
          />
        </div>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

