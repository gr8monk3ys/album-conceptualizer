/**
 * What the sign-in page says when NextAuth sends someone back with `?error=<code>`.
 *
 * NextAuth (v4) redirects to `pages.signIn` for sign-in failures and to `pages.error` for the
 * rest; both point at /sign-in (server/auth.ts), so every code lands here. The code in the URL is
 * whatever the address bar holds, so it is only ever used as a lookup key: an unknown code gets
 * the default message and is never printed back.
 */

export type SignInErrorMessage = {
  /** What happened, in one short sentence. */
  title: string;
  /** What to do next. */
  body: string;
};

const MESSAGES: Record<string, SignInErrorMessage> = {
  CredentialsSignin: {
    title: "Those details didn't sign you in.",
    body: "Check the email address, then try again.",
  },
  OAuthSignin: {
    title: "GitHub sign-in couldn't start.",
    body: "Try Continue with GitHub again in a moment. If it keeps failing, use another way to sign in below.",
  },
  OAuthCallback: {
    title: "GitHub didn't finish signing you in.",
    body: "If you cancelled on GitHub, that's all it was. Try Continue with GitHub again.",
  },
  OAuthCreateAccount: {
    title: "We couldn't set up your account from GitHub.",
    body: "Try again in a moment, or sign in with an email link instead.",
  },
  EmailCreateAccount: {
    title: "We couldn't set up your account from that email address.",
    body: "Try again in a moment, or use another way to sign in below.",
  },
  Callback: {
    title: "Signing you in didn't finish.",
    body: "Try again. If it keeps happening, use another way to sign in below.",
  },
  OAuthAccountNotLinked: {
    title: "That email address already belongs to an account that signs in another way.",
    body: "Sign in the way you did the first time, for example with an email link. Accounts aren't joined automatically, to keep yours safe.",
  },
  EmailSignin: {
    title: "We couldn't send the sign-in link.",
    body: "Check the email address and send the link again.",
  },
  SessionRequired: {
    title: "Sign in to open that page.",
    body: "You'll go straight back to it once you're signed in.",
  },
  AccessDenied: {
    title: "This account isn't allowed to sign in here.",
    body: "Try a different account, or ask whoever runs this server to give you access.",
  },
  Verification: {
    title: "That sign-in link has expired or was already used.",
    body: "Each link works once, for 24 hours. Send yourself a new one below.",
  },
  Configuration: {
    title: "Sign-in isn't set up correctly on this server.",
    body: "Nothing you did caused this. Try again later, or let whoever runs this server know.",
  },
};

const DEFAULT_MESSAGE: SignInErrorMessage = {
  title: "Something went wrong while signing you in.",
  body: "Try again. If it keeps happening, use another way to sign in below.",
};

/**
 * The message for a NextAuth error code from the page's search params, or null when the URL
 * carries no error. Accepts the raw search-param value (a repeated param arrives as an array).
 */
export function signInErrorMessage(
  code: string | string[] | undefined | null,
): SignInErrorMessage | null {
  const value = Array.isArray(code) ? code[0] : code;
  if (typeof value !== "string" || !value.trim()) return null;
  const key = value.trim();
  return Object.prototype.hasOwnProperty.call(MESSAGES, key) ? MESSAGES[key] : DEFAULT_MESSAGE;
}
