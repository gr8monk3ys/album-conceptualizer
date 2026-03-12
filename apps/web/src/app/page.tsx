import Link from "next/link";

export const metadata = {
  title: "Album Conceptualizer",
  description:
    "Build concept albums that hold together with narrative, lyrics, harmony, collaboration, and export-ready handoff.",
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,rgba(109,94,252,0.06),rgba(255,62,165,0.025)_30%,transparent_68%)]">
      <div className="relative mx-auto flex min-h-screen max-w-[1200px] flex-col px-6 py-14">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[linear-gradient(135deg,rgba(255,62,165,0.9),rgba(109,94,252,0.76))]">
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
            <form action="/sign-in">
              <button
                type="submit"
                className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
              >
                Sign in
              </button>
            </form>
            <form action="/app">
              <button
                type="submit"
                className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90"
              >
                Open app
              </button>
            </form>
          </div>
        </header>

        <main className="mt-14 grid flex-1 grid-cols-1 items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-xs text-[var(--muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              AI workspace for concept albums
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-[var(--text)] md:text-6xl">
              Build a concept album that actually holds together.
            </h1>
            <p className="mt-5 max-w-[62ch] text-sm leading-relaxed text-[var(--muted)] md:text-base">
              Turn one idea into a coherent album blueprint with an album bible, tracklist, lyrics
              drafts, chord progressions, narrative arcs, comments, versions, and export-ready
              handoff for your DAW.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <form action="/sign-in">
                <button
                  type="submit"
                  className="rounded-2xl bg-[linear-gradient(90deg,var(--accent2),var(--accent))] px-6 py-3 text-sm font-semibold text-black hover:brightness-110"
                >
                  Start your first album
                </button>
              </form>
              <form action="/app/create">
                <button
                  type="submit"
                  className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-6 py-3 text-sm font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
                >
                  See the workflow
                </button>
              </form>
            </div>

            <div className="mt-8 hidden grid-cols-1 gap-3 sm:grid sm:grid-cols-3 [content-visibility:auto] [contain-intrinsic-size:220px]">
              {[
                { k: "Album bible", v: "Themes, motifs, references, and narrative rules" },
                { k: "DAW handoff", v: "MIDI, ChordPro, MusicXML, JSON export packs" },
                { k: "Publish + remix", v: "Share blueprints and fork stronger ideas" },
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

          <div className="hidden rounded-[32px] border border-[var(--border)] bg-[rgba(255,255,255,0.035)] p-4 [content-visibility:auto] [contain-intrinsic-size:420px] lg:block">
            <div className="rounded-[28px] border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.2)] p-5">
                <div className="text-xs text-[var(--muted2)]">How it works</div>
                <div className="mt-2 text-lg font-semibold text-[var(--text)]">
                  The before-the-DAW workflow
                </div>
                <div className="mt-4 space-y-3">
                  {[
                    "Start with a concept, not a blank session.",
                    "Shape tracks, motifs, lyrics, and comments in one workspace.",
                    "Export a clean handoff pack or publish the blueprint for remix.",
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
                  Not an audio generator. A blueprint that makes your audio better.
                </div>
            </div>
          </div>
        </main>

        <footer className="mt-12 flex items-center justify-between gap-4 text-xs text-[var(--muted2)]">
          <div>Built for artists, producers, and bands who care about coherence.</div>
          <div className="flex items-center gap-3">
            <Link href="/terms" className="hover:text-[var(--text)]">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-[var(--text)]">
              Privacy
            </Link>
            <Link href="/support" className="hover:text-[var(--text)]">
              Support
            </Link>
            <form action="/sign-in">
              <button type="submit" className="hover:text-[var(--text)]">
                Sign in
              </button>
            </form>
            <form action="/app">
              <button type="submit" className="hover:text-[var(--text)]">
                App
              </button>
            </form>
          </div>
        </footer>
      </div>
    </div>
  );
}
