import Link from "next/link";

export const metadata = {
  title: "Album Conceptualizer",
  description: "Plan cohesive concept albums with narrative, chords, and export-ready structure.",
};

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_20%_20%,rgba(109,94,252,0.25),transparent_55%),radial-gradient(circle_at_80%_10%,rgba(255,62,165,0.22),transparent_45%),radial-gradient(circle_at_40%_90%,rgba(50,213,131,0.12),transparent_55%),var(--bg)]">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="relative mx-auto flex min-h-screen max-w-[1200px] flex-col px-6 py-14">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[radial-gradient(circle_at_30%_25%,rgba(255,62,165,0.9),rgba(109,94,252,0.8))] shadow-[0_10px_30px_rgba(109,94,252,0.2)]">
              <span className="text-[13px] font-semibold tracking-wide text-black/80">AC</span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight text-[var(--text)]">
                Album Conceptualizer
              </div>
              <div className="text-xs text-[var(--muted2)]">Blueprints, not raw audio.</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/sign-in"
              className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
            >
              Sign in
            </Link>
            <Link
              href="/app"
              className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90"
            >
              Open app
            </Link>
          </div>
        </header>

        <main className="mt-14 grid flex-1 grid-cols-1 items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-xs text-[var(--muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              Suno-inspired workflow for album planning
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-[var(--text)] md:text-6xl">
              Make a concept album people can actually finish.
            </h1>
            <p className="mt-5 max-w-[62ch] text-sm leading-relaxed text-[var(--muted)] md:text-base">
              Turn a single idea into a cohesive album blueprint: tracklist, lyrics drafts, chord
              progressions, narrative arcs, and export packs for your DAW. Subscriptions and teams
              are built in from day one.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/sign-in"
                className="rounded-2xl bg-[linear-gradient(90deg,var(--accent2),var(--accent))] px-6 py-3 text-sm font-semibold text-black shadow-[0_20px_60px_rgba(255,62,165,0.15)] hover:brightness-110"
              >
                Get started
              </Link>
              <Link
                href="/app/create"
                className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-6 py-3 text-sm font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
              >
                See the dashboard
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { k: "Album canvas", v: "Narrative + themes that stay coherent" },
                { k: "Export packs", v: "MIDI, ChordPro, MusicXML, JSON" },
                { k: "Workspaces", v: "Stripe plans and team collaboration" },
              ].map((item) => (
                <div
                  key={item.k}
                  className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4"
                >
                  <div className="text-sm font-semibold text-[var(--text)]">{item.k}</div>
                  <div className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{item.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-10 rounded-[44px] bg-[radial-gradient(circle_at_30%_30%,rgba(255,62,165,0.18),transparent_55%),radial-gradient(circle_at_70%_10%,rgba(109,94,252,0.18),transparent_55%)] blur-2xl" />
            <div className="relative rounded-[32px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-4 shadow-[0_30px_110px_rgba(0,0,0,0.6)]">
              <div className="rounded-[28px] border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.35)] p-5">
                <div className="text-xs text-[var(--muted2)]">Why it feels different</div>
                <div className="mt-2 text-lg font-semibold text-[var(--text)]">
                  Your creative operating system
                </div>
                <div className="mt-4 space-y-3">
                  {[
                    "Start from a concept, not a blank DAW session.",
                    "Keep motifs consistent across tracks.",
                    "Export clean assets for collaboration.",
                  ].map((line) => (
                    <div
                      key={line}
                      className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--muted)]"
                    >
                      {line}
                    </div>
                  ))}
                </div>
                <div className="mt-5 text-xs text-[var(--muted2)]">
                  Not a Suno clone: we don’t generate audio. We generate the blueprint that makes
                  your audio better.
                </div>
              </div>
            </div>
          </div>
        </main>

        <footer className="mt-12 flex items-center justify-between gap-4 text-xs text-[var(--muted2)]">
          <div>Built for creators who care about coherence.</div>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="hover:text-[var(--text)]">
              Sign in
            </Link>
            <Link href="/app" className="hover:text-[var(--text)]">
              App
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
