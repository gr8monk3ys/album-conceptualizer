"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";

import { SiteHeader } from "@/components/site-header";
import { Button, Field, inputClass } from "@/components/ui";
import { DEFAULT_CALLBACK_PATH, safeCallbackPath } from "@/lib/sign-in-callback";
import type { SignInErrorMessage } from "@/lib/sign-in-errors";

type SignInFormState = {
  devEmail: string;
  devName: string;
  magicEmail: string;
};

type Method = "github" | "email" | "dev";

export function SignInClient({
  githubEnabled,
  emailEnabled,
  devLoginEnabled,
  error = null,
  authOrigin = null,
}: {
  githubEnabled: boolean;
  emailEnabled: boolean;
  devLoginEnabled: boolean;
  /** Why the last sign-in failed (from `?error=`), mapped to plain words on the server. */
  error?: SignInErrorMessage | null;
  /** The site's origin as the auth server knows it (NEXTAUTH_URL), which a failed sign-in writes
   * into `callbackUrl`; accepted alongside this page's own origin. */
  authOrigin?: string | null;
}) {
  const errorRef = useRef<HTMLDivElement>(null);
  // Arriving from a failed sign-in, focus goes to the message so it is read first and the next
  // Tab reaches the sign-in methods; never taken from something the person already focused.
  useEffect(() => {
    if (!error) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    errorRef.current?.focus();
  }, [error]);
  // Where the person was going. A failed attempt comes back with it as an absolute URL, which is
  // kept when it is this site's own; anything else goes to the app (lib/sign-in-callback.ts).
  const [callbackUrl] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_CALLBACK_PATH;
    const params = new URLSearchParams(window.location.search);
    return safeCallbackPath(params.get("callbackUrl"), [window.location.origin, authOrigin]);
  });
  const [form, setForm] = useState<SignInFormState>({
    devEmail: "dev@example.com",
    devName: "Dev User",
    magicEmail: "",
  });
  const [magicError, setMagicError] = useState<string | null>(null);

  // One primary action on the page: the first sign-in method this server offers.
  const primary: Method | null = githubEnabled
    ? "github"
    : emailEnabled
      ? "email"
      : devLoginEnabled
        ? "dev"
        : null;

  function sendMagicLink() {
    const email = form.magicEmail.trim();
    if (!email) {
      setMagicError("Enter the email address you want the sign-in link sent to.");
      return;
    }
    setMagicError(null);
    void signIn("email", { email, callbackUrl });
  }

  return (
    <div className="min-h-screen bg-ground">
      <div className="mx-auto flex max-w-[1200px] flex-col px-4 pb-16 pt-4 sm:px-6 md:pt-6">
        <SiteHeader showSignIn={false} />

        <main className="mt-12 w-full max-w-[34rem] md:mt-16">
          {/* The header above already names the product; the page names what it's for. */}
          <h1 className="type-display text-display-lg break-words text-ink">Sign in</h1>
          <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-ink-2">
            Sign in to plan, write and export your concept albums. Your first sign-in sets up your
            workspace.
          </p>

          <div className="mt-8 flex flex-col">
            {error ? (
              // Server-rendered with the page, so it is there before hydration.
              <div
                ref={errorRef}
                role="alert"
                tabIndex={-1}
                id="sign-in-error"
                className="mb-6 rounded border border-danger/60 bg-danger-soft p-4 text-sm leading-relaxed text-danger"
              >
                <p className="max-w-[65ch] font-semibold">{error.title}</p>
                <p className="mt-1 max-w-[65ch]">{error.body}</p>
              </div>
            ) : null}

            {githubEnabled ? (
              <div className="border-t border-line py-6">
                <Button
                  tone={primary === "github" ? "primary" : "secondary"}
                  onClick={() => signIn("github", { callbackUrl })}
                  className="w-full sm:w-auto"
                >
                  Continue with GitHub
                </Button>
              </div>
            ) : null}

            {emailEnabled ? (
              <section aria-labelledby="magic-link-title" className="border-t border-line py-6">
                <h2 id="magic-link-title" className="text-base font-semibold text-ink">
                  Email me a sign-in link
                </h2>
                <p className="mt-1 max-w-[65ch] text-sm text-ink-2">
                  We&apos;ll send a one-time link. Open it on this device to sign in.
                </p>
                <form
                  className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
                  onSubmit={(event) => {
                    event.preventDefault();
                    sendMagicLink();
                  }}
                  noValidate
                >
                  <Field
                    label="Email address"
                    htmlFor="magic-email"
                    error={magicError}
                    className="min-w-0 flex-1"
                  >
                    <input
                      id="magic-email"
                      value={form.magicEmail}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, magicEmail: e.target.value }));
                        if (magicError) setMagicError(null);
                      }}
                      className={inputClass}
                      placeholder="you@example.com"
                      type="email"
                      autoComplete="email"
                      aria-invalid={magicError ? true : undefined}
                      aria-describedby={magicError ? "magic-email-error" : undefined}
                    />
                  </Field>
                  <Button type="submit" tone={primary === "email" ? "primary" : "secondary"}>
                    Send link
                  </Button>
                </form>
              </section>
            ) : null}

            {devLoginEnabled ? (
              <section aria-labelledby="dev-login-title" className="border-t border-line py-6">
                <h2 id="dev-login-title" className="text-base font-semibold text-ink">
                  Dev login
                </h2>
                <p className="mt-1 max-w-[65ch] text-sm text-ink-2">
                  Development sign-in is enabled on this server.
                </p>
                {/* Not a <form>: a click before hydration must not reload the page. */}
                <div className="mt-4 flex flex-col gap-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Email" htmlFor="dev-email">
                      <input
                        id="dev-email"
                        value={form.devEmail}
                        onChange={(e) => setForm((prev) => ({ ...prev, devEmail: e.target.value }))}
                        className={inputClass}
                        placeholder="email"
                        autoComplete="off"
                      />
                    </Field>
                    <Field label="Name" htmlFor="dev-name">
                      <input
                        id="dev-name"
                        value={form.devName}
                        onChange={(e) => setForm((prev) => ({ ...prev, devName: e.target.value }))}
                        className={inputClass}
                        placeholder="name"
                        autoComplete="off"
                      />
                    </Field>
                  </div>
                  <Button
                    tone={primary === "dev" ? "primary" : "secondary"}
                    className="w-full sm:w-auto sm:self-start"
                    onClick={() =>
                      void signIn("credentials", {
                        email: form.devEmail,
                        name: form.devName,
                        callbackUrl,
                      })
                    }
                  >
                    Continue (dev)
                  </Button>
                </div>
              </section>
            ) : null}

            {primary === null ? (
              <div className="rounded border border-danger/60 bg-danger-soft p-4 text-sm leading-relaxed text-danger">
                <p className="font-semibold">Sign-in isn&apos;t available here yet.</p>
                <p className="mt-1">
                  This server has no sign-in method turned on. If you run it, enable GitHub or email
                  sign-in in its settings and reload this page.
                </p>
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
