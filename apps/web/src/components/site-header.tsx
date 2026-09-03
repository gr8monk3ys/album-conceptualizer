import Link from "next/link";

/**
 * Marketing/auth header. Shared by `/` and `/sign-in` (which is where `/app`
 * lands for signed-out visitors) so both routes carry the same branding and the
 * same way back out.
 */
export function SiteHeader() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <Link href="/" className="flex min-w-0 items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,rgba(255,62,165,0.9),rgba(109,94,252,0.76))]">
          <span className="text-[13px] font-semibold tracking-wide text-black/80">AC</span>
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-semibold tracking-tight text-[var(--text)]">
            Album Conceptualizer
          </div>
          <div className="hidden text-xs text-[var(--muted2)] sm:block">
            Blueprints, not raw audio.
          </div>
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-2">
        <form action="/sign-in">
          <button
            type="submit"
            className="whitespace-nowrap rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
          >
            Sign in
          </button>
        </form>
        <form action="/app">
          <button
            type="submit"
            className="whitespace-nowrap rounded-full bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90"
          >
            Open app
          </button>
        </form>
      </div>
    </header>
  );
}
