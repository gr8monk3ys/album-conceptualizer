"use client";

import { signIn } from "next-auth/react";

export default function SignInPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_20%_20%,rgba(109,94,252,0.25),transparent_55%),radial-gradient(circle_at_80%_10%,rgba(255,62,165,0.22),transparent_45%),radial-gradient(circle_at_40%_90%,rgba(50,213,131,0.12),transparent_55%),var(--bg)]">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="relative mx-auto flex min-h-screen max-w-[1100px] items-center px-6 py-16">
        <div className="grid w-full grid-cols-1 gap-10 lg:grid-cols-2">
          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-xs text-[var(--muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              Concept albums, but Suno-style workflow
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--text)] md:text-5xl">
              Album Conceptualizer
            </h1>
            <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-[var(--muted)] md:text-base">
              Plan a cohesive concept album with AI-assisted lyrics, chord progressions, narrative
              structure, and exportable artifacts for your DAW.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => signIn("github", { callbackUrl: "/app" })}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black shadow-[0_20px_70px_rgba(0,0,0,0.4)] hover:bg-white/90"
              >
                Continue with GitHub
              </button>
              <button
                type="button"
                onClick={() => signIn(undefined, { callbackUrl: "/app" })}
                className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-5 py-3 text-sm font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
              >
                More options
              </button>
            </div>

            <div className="mt-6 text-xs text-[var(--muted2)]">
              By continuing you agree to the Terms. Subscriptions are handled by Stripe.
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-8 rounded-[40px] bg-[radial-gradient(circle_at_30%_30%,rgba(255,62,165,0.18),transparent_55%),radial-gradient(circle_at_70%_10%,rgba(109,94,252,0.18),transparent_55%)] blur-2xl" />
            <div className="relative rounded-[32px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-4 shadow-[0_30px_110px_rgba(0,0,0,0.6)]">
              <div className="rounded-[28px] border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.35)] p-5">
                <div className="text-xs text-[var(--muted2)]">Preview</div>
                <div className="mt-1 text-lg font-semibold text-[var(--text)]">
                  From idea to export bundle
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3">
                  {[
                    {
                      title: "Album canvas",
                      desc: "Tracklist, themes, and narrative arc in one view.",
                    },
                    {
                      title: "Song editor",
                      desc: "Sections, lyrics drafts, and chord loops per track.",
                    },
                    {
                      title: "Export",
                      desc: "MIDI, ChordPro, MusicXML, and JSON handoff packs.",
                    },
                  ].map((card) => (
                    <div
                      key={card.title}
                      className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-4"
                    >
                      <div className="text-sm font-semibold text-[var(--text)]">
                        {card.title}
                      </div>
                      <div className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                        {card.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

