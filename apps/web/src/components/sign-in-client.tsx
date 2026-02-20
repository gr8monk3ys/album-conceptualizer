"use client";

import { useEffect, useState } from "react";
import { getProviders, signIn, type ClientSafeProvider } from "next-auth/react";

type SignInFormState = {
  devEmail: string;
  devName: string;
  magicEmail: string;
};

type ProvidersState = {
  providers: Record<string, ClientSafeProvider>;
  loaded: boolean;
};

export function SignInClient() {
  const enableDevLogin = process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "1";
  const [callbackUrl] = useState(() => {
    if (typeof window === "undefined") return "/app";
    const params = new URLSearchParams(window.location.search);
    return params.get("callbackUrl") ?? "/app";
  });
  const [form, setForm] = useState<SignInFormState>({
    devEmail: "dev@example.com",
    devName: "Dev User",
    magicEmail: "",
  });
  const [providerState, setProviderState] = useState<ProvidersState>({
    providers: {},
    loaded: false,
  });
  const providers = providerState.providers;
  const providersLoaded = providerState.loaded;

  useEffect(() => {
    let cancelled = false;
    void getProviders()
      .then((value) => {
        if (!cancelled) {
          setProviderState((prev) => ({ ...prev, providers: value ?? {} }));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setProviderState((prev) => ({ ...prev, loaded: true }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const githubProvider = providers.github;
  const emailProvider = Object.values(providers).find((provider) => provider.type === "email");
  const oauthProviders = Object.values(providers).filter(
    (provider) => provider.type === "oauth" && provider.id !== "github",
  );

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
              {githubProvider ? (
                <button
                  type="button"
                  onClick={() => signIn(githubProvider.id, { callbackUrl })}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black shadow-[0_20px_70px_rgba(0,0,0,0.4)] hover:bg-white/90"
                >
                  Continue with GitHub
                </button>
              ) : null}
              {oauthProviders.length > 0
                ? oauthProviders.map((provider) => (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => signIn(provider.id, { callbackUrl })}
                      className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black shadow-[0_20px_70px_rgba(0,0,0,0.4)] hover:bg-white/90"
                    >
                      Continue with {provider.name}
                    </button>
                  ))
                : null}
              <button
                type="button"
                onClick={() => signIn(undefined, { callbackUrl })}
                className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-5 py-3 text-sm font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
              >
                More options
              </button>
            </div>

            {emailProvider ? (
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
                      void signIn(emailProvider.id, {
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

            {enableDevLogin ? (
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

            {providersLoaded &&
            !githubProvider &&
            !emailProvider &&
            !oauthProviders.length &&
            !enableDevLogin ? (
              <div className="mt-5 rounded-2xl border border-[rgba(255,173,173,0.45)] bg-[rgba(140,24,24,0.25)] p-4 text-xs text-[rgba(255,220,220,0.95)]">
                No auth provider is configured yet. Set GitHub OAuth or Email auth in your
                environment.
              </div>
            ) : null}

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
