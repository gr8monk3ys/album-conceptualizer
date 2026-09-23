import { SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Album Conceptualizer",
  description:
    "Build concept albums that hold together with narrative, lyrics, harmony, collaboration, and export-ready handoff.",
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,rgba(109,94,252,0.06),rgba(255,62,165,0.025)_30%,transparent_68%)]">
      <div className="relative mx-auto flex max-w-[1200px] flex-col px-6 pb-16 pt-8 md:pt-10">
        <SiteHeader />

        <main className="mt-14 grid grid-cols-1 items-start gap-10 md:mt-20 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-line bg-raised px-3 py-1 text-xs text-ink-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              AI workspace for concept albums
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-ink md:text-6xl">
              Build a concept album that actually holds together.
            </h1>
            <p className="mt-5 max-w-[62ch] text-sm leading-relaxed text-ink-2 md:text-base">
              Turn one idea into a coherent album blueprint with an album bible, tracklist, lyrics
              drafts, chord progressions, narrative arcs, comments, versions, and export-ready
              handoff for your DAW.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <form action="/sign-in">
                <button
                  type="submit"
                  className="rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-accent-ink hover:brightness-110"
                >
                  Start your first album
                </button>
              </form>
              <form action="/app/create">
                <button
                  type="submit"
                  className="rounded-2xl border border-line bg-raised px-6 py-3 text-sm font-semibold text-ink hover:bg-hover"
                >
                  See the workflow
                </button>
              </form>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3 [content-visibility:auto] [contain-intrinsic-size:220px]">
              {[
                { k: "Album bible", v: "Themes, motifs, references, and narrative rules" },
                { k: "DAW handoff", v: "MIDI, ChordPro, MusicXML, JSON export packs" },
                { k: "Publish + remix", v: "Share blueprints and fork stronger ideas" },
              ].map((item) => (
                <div
                  key={item.k}
                  className="rounded-2xl border border-line bg-raised p-4"
                >
                  <div className="text-sm font-semibold text-ink">{item.k}</div>
                  <div className="mt-1 text-xs leading-relaxed text-ink-2">{item.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden rounded-[32px] border border-line bg-raised p-4 [content-visibility:auto] [contain-intrinsic-size:420px] lg:block">
            <div className="rounded-[28px] border border-line bg-sunken p-5">
                <div className="text-xs text-ink-3">How it works</div>
                <div className="mt-2 text-lg font-semibold text-ink">
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
                      className="rounded-2xl border border-line bg-raised px-4 py-3 text-sm text-ink-2"
                    >
                      {line}
                    </div>
                  ))}
                </div>
                <div className="mt-5 text-xs text-ink-3">
                  Not an audio generator. A blueprint that makes your audio better.
                </div>
            </div>
          </div>
        </main>

        <footer className="mt-16 flex flex-col gap-3 border-t border-line pt-6 text-xs text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:mt-20">
          <div>Built for artists, producers, and bands who care about coherence.</div>
          <div className="flex shrink-0 items-center gap-4">
            <form action="/sign-in">
              <button type="submit" className="hover:text-ink">
                Sign in
              </button>
            </form>
            <form action="/app">
              <button type="submit" className="hover:text-ink">
                App
              </button>
            </form>
          </div>
        </footer>
      </div>
    </div>
  );
}
