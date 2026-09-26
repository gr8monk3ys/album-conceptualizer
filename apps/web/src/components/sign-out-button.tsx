"use client";

import { LogOut } from "lucide-react";

/** next-auth's own sign-out endpoint: a GET shows its confirmation page, a POST signs out. */
export const SIGN_OUT_PAGE = "/api/auth/signout";

type SignOutClient = { signOut: (options: { callbackUrl: string }) => Promise<unknown> };

/** Posts `fields` to `action` as an ordinary form, so the browser follows the redirect. */
function submitForm(action: string, fields: Record<string, string>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.append(input);
  }
  document.body.append(form);
  form.submit();
}

/**
 * Signs out without next-auth's client: fetch the CSRF token and post the sign-out form, which
 * lands on the front page as the client would. Only if that can't start (offline) does it open
 * next-auth's own page, which asks once more and works without this page's scripts.
 */
export async function postSignOut(
  fetcher: typeof fetch = (input, init) => fetch(input, init),
  submit: (action: string, fields: Record<string, string>) => void = submitForm,
  navigate: (href: string) => void = (href) => window.location.assign(href),
) {
  try {
    const response = await fetcher("/api/auth/csrf", { credentials: "same-origin" });
    const { csrfToken } = (await response.json()) as { csrfToken?: unknown };
    if (typeof csrfToken !== "string" || !csrfToken) throw new Error("No CSRF token.");
    submit(SIGN_OUT_PAGE, { csrfToken, callbackUrl: "/" });
  } catch {
    navigate(SIGN_OUT_PAGE);
  }
}

// next-auth's client is loaded when the button is pressed, not with the page: it sits in the
// sidebar and the mobile sheet on every app screen, and its module (with its Babel runtime)
// was evaluated in the start-up task of each of them only to sign out. Should it not load
// (a deploy replaced the chunk, or the network dropped) or signing out fail, the press still
// signs out, by posting next-auth's sign-out form itself.
export async function signOutToFrontPage(
  load: () => Promise<SignOutClient> = () => import("next-auth/react"),
  fallback: () => Promise<void> = () => postSignOut(),
) {
  try {
    const { signOut } = await load();
    await signOut({ callbackUrl: "/" });
  } catch {
    await fallback();
  }
}

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => void signOutToFrontPage()}
      // A row in the account block's tight list, like the Settings and Help rows above it: the
      // focus ring is drawn inside it so the row below (or the scrolling column) can't clip it.
      className="flex min-h-11 w-full items-center gap-3 rounded px-3 text-sm text-ink-2 transition-colors hover:bg-hover hover:text-ink focus-visible:-outline-offset-2"
    >
      <LogOut className="h-4 w-4 text-ink-3" aria-hidden="true" />
      Sign out
    </button>
  );
}
