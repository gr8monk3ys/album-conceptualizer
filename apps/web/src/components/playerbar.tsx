import { Play, Repeat2, SkipBack, SkipForward, Volume2 } from "lucide-react";

export function Playerbar() {
  return (
    <div className="pointer-events-auto fixed bottom-4 left-1/2 z-50 w-[min(1120px,calc(100vw-32px))] -translate-x-1/2 rounded-2xl border border-[var(--border)] bg-[rgba(15,16,21,0.78)] px-4 py-3 shadow-[0_30px_80px_rgba(0,0,0,0.6)] backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-10 w-10 flex-none rounded-xl bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.25),rgba(255,255,255,0.06))]" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[var(--text)]">
              Neon Draft (preview)
            </div>
            <div className="truncate text-xs text-[var(--muted2)]">Album Conceptualizer</div>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-[var(--muted)]">
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-[rgba(255,255,255,0.06)]"
              aria-label="Previous"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full bg-white text-black hover:bg-white/90"
              aria-label="Play"
            >
              <Play className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-[rgba(255,255,255,0.06)]"
              aria-label="Next"
            >
              <SkipForward className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-[rgba(255,255,255,0.06)]"
              aria-label="Repeat"
            >
              <Repeat2 className="h-4 w-4" />
            </button>
          </div>

          <div className="flex w-full max-w-[520px] items-center gap-3">
            <div className="text-[11px] tabular-nums text-[var(--muted2)]">0:23</div>
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
              <div className="absolute inset-y-0 left-0 w-[38%] rounded-full bg-[linear-gradient(90deg,var(--accent2),var(--accent))]" />
            </div>
            <div className="text-[11px] tabular-nums text-[var(--muted2)]">1:00</div>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Volume2 className="h-4 w-4 text-[var(--muted2)]" />
          <div className="h-2 w-24 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
            <div className="h-full w-[70%] rounded-full bg-[rgba(255,255,255,0.24)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
