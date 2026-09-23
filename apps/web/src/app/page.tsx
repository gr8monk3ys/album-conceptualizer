import type { Metadata } from "next";
import Link from "next/link";

import { ExampleAlbum } from "@/components/landing/example-album";
import { Wordmark } from "@/components/sidebar";
import { SiteHeader } from "@/components/site-header";
import { ButtonLink } from "@/components/ui";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { FREE_PROJECT_LIMIT, planMonthlyCredits } from "@/server/plan";

export const metadata: Metadata = {
  title: { absolute: "Album Conceptualizer" },
  description:
    "Plan a concept album that holds together: a narrative arc, an Album Bible, lyrics and chords for every track, and a clean handoff to your DAW.",
};

const MOVES = [
  {
    title: "Plan the arc",
    body: "Start from one idea. Name the album, set its narrative arc and themes, and sketch the tracklist in three short steps. An optional AI brainstorm can suggest a direction; you decide what stays.",
  },
  {
    title: "Write inside the sequence",
    body: "Draft sections, lyrics and chords track by track with the whole record in view. The Album Bible and the Coherence report show which tracks carry the themes and which ones drift.",
  },
  {
    title: "Hand off to your DAW or generator",
    body: "Export MIDI, ChordPro, MusicXML or JSON, or a handoff pack written for the tool you use next. The blueprint leaves with its structure intact.",
  },
];

const FOOTER_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "/sign-in", label: "Sign in" },
  { href: "/app", label: "Open your workspace" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-ground">
      <div className="mx-auto flex max-w-[1200px] flex-col px-4 pb-10 pt-4 sm:px-6 md:pt-6">
        <SiteHeader />

        <main className="flex flex-col">
          <section className="grid grid-cols-[minmax(0,1fr)] gap-x-12 gap-y-10 pt-12 md:pt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
            <div className="min-w-0">
              <h1 className="type-display text-display-xl max-w-[16ch] text-ink">
                Build a concept album that actually holds together.
              </h1>
              <p className="mt-6 max-w-[48ch] text-base leading-relaxed text-ink-2">
                Album Conceptualizer turns one idea into an album blueprint: a sequenced tracklist,
                a narrative arc, the themes each track carries, and lyric and chord drafts for every
                section. Then it hands the record to your DAW without losing the thread.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/sign-in" tone="primary" className="px-5">
                  Start your first album
                </ButtonLink>
                <ButtonLink href="#how-it-works" tone="secondary" className="px-5">
                  See how it works
                </ButtonLink>
              </div>
              {/* What it costs, said plainly before anyone signs up. */}
              <p className="mt-4 max-w-[48ch] text-sm leading-relaxed text-ink-2">
                The free plan comes with {planMonthlyCredits("free")} credits a month and up to{" "}
                {FREE_PROJECT_LIMIT} albums. Creating an album uses {CREDIT_COSTS.albumCreate}.
              </p>
              <p className="mt-6 max-w-[48ch] text-sm leading-relaxed text-ink-3">
                Not an audio generator. It plans the record so the audio you make later has
                something to hold on to.
              </p>
            </div>

            <ExampleAlbum className="border-t border-line-strong pt-6 lg:border-t-0 lg:pt-0" />
          </section>

          <section
            id="how-it-works"
            aria-labelledby="how-it-works-title"
            className="mt-20 border-t border-line pt-8 md:mt-24"
          >
            <h2 id="how-it-works-title" className="type-display text-2xl text-ink md:text-3xl">
              How it works
            </h2>
            <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-ink-2">
              The album is the unit, not the song. Three moves take it from an idea to a session.
            </p>
            <ol className="mt-8 grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-3">
              {MOVES.map((move) => (
                <li key={move.title} className="min-w-0 border-t border-line-strong pt-4">
                  <h3 className="text-lg font-semibold text-ink">{move.title}</h3>
                  <p className="mt-2 max-w-[48ch] text-sm leading-relaxed text-ink-2">{move.body}</p>
                </li>
              ))}
            </ol>
          </section>
        </main>

        <footer className="mt-20 flex flex-col gap-4 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between md:mt-24">
          <div className="min-w-0">
            <Wordmark />
            <p className="mt-1 text-xs text-ink-3">Plan concept albums that hold together.</p>
          </div>
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-2">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-11 items-center rounded px-2 text-sm text-ink-2 hover:text-ink hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </footer>
      </div>
    </div>
  );
}
