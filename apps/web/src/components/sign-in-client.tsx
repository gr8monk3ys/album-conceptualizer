"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

type SignInFormState = {
  devEmail: string;
  devName: string;
  magicEmail: string;
};

export function SignInClient({
  githubEnabled,
  emailEnabled,
  devLoginEnabled,
}: {
  githubEnabled: boolean;
  emailEnabled: boolean;
  devLoginEnabled: boolean;
}) {
  const [callbackUrl] = useState(() => {
    if (typeof window === "undefined") return "/app";
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("callbackUrl") ?? "/app";
    // Prevent open redirect: only allow relative paths, reject protocol-relative URLs
    return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/app";
  });
  const [form, setForm] = useState<SignInFormState>({
    devEmail: "dev@example.com",
    devName: "Dev User",
    magicEmail: "",
  });

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,rgba(109,94,252,0.06),rgba(255,62,165,0.025)_30%,transparent_68%)]">
      <main className="relative mx-auto flex min-h-screen max-w-[1100px] items-center px-6 py-16">
        <div className="grid w-full grid-cols-1 gap-10 lg:grid-cols-2">
          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-xs text-[var(--muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              Blueprint workflow for concept albums
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--text)] md:text-5xl">
              Album Conceptualizer
            </h1>
            <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-[var(--muted)] md:text-base">
              Plan a cohesive concept album with AI-assisted lyrics, chord progressions, narrative
              structure, and exportable artifacts for your DAW.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              {githubEnabled ? (
                <button
                  type="button"
                  onClick={() => signIn("github", { callbackUrl })}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90"
                >
                  Continue with GitHub
                </button>
              ) : null}
            </div>

            {emailEnabled ? (
              <div className="mt-5 rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(0,0,0,0.25)] p-4">
                <div className="text-xs font-semibold text-[var(--text)]">Email magic link</div>
                <div className="mt-1 text-xs text-[var(--muted2)]">
                  We&apos;ll email you a secure sign-in link.
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={form.magicEmail}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        magicEmail: e.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                    placeholder="you@example.com"
                    type="email"
                    autoComplete="email"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const email = form.magicEmail.trim();
                      if (!email) return;
                      void signIn("email", {
                        email,
                        callbackUrl,
                      });
                    }}
                    className="rounded-2xl bg-[rgba(255,255,255,0.10)] px-5 py-3 text-sm font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.14)]"
                  >
                    Send link
                  </button>
                </div>
              </div>
            ) : null}

            {devLoginEnabled ? (
              <div className="mt-5 rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(0,0,0,0.25)] p-4">
                <div className="text-xs font-semibold text-[var(--text)]">Dev login</div>
                <div className="mt-1 text-xs text-[var(--muted2)]">
                  Enabled because `NEXT_PUBLIC_ENABLE_DEV_LOGIN=1`. Do not use this in production.
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    value={form.devEmail}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        devEmail: e.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                    placeholder="email"
                    autoComplete="off"
                  />
                  <input
                    value={form.devName}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        devName: e.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                    placeholder="name"
                    autoComplete="off"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    signIn("credentials", {
                      email: form.devEmail,
                      name: form.devName,
                      callbackUrl,
                    })
                  }
                  className="mt-3 w-full rounded-2xl bg-[rgba(255,255,255,0.10)] px-5 py-3 text-sm font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.14)]"
                >
                  Continue (dev)
                </button>
              </div>
            ) : null}

            {!githubEnabled && !emailEnabled && !devLoginEnabled ? (
              <div className="mt-5 rounded-2xl border border-[rgba(255,173,173,0.45)] bg-[rgba(140,24,24,0.25)] p-4 text-xs text-[rgba(255,220,220,0.95)]">
                No auth provider is configured yet. Set GitHub OAuth or Email auth in your
                environment.
              </div>
            ) : null}

            <div className="mt-6 text-xs text-[var(--muted2)]">
              By continuing you agree to the Terms. Subscriptions are handled by Stripe.
            </div>
          </div>

          <div className="hidden rounded-[32px] border border-[var(--border)] bg-[rgba(255,255,255,0.035)] p-4 [content-visibility:auto] [contain-intrinsic-size:420px] lg:block">
              <div className="rounded-[28px] border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.2)] p-5">
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
      </main>
    </div>
  );
}
