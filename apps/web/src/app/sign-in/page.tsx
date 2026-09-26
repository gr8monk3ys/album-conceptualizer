import { SignInClient } from "@/components/sign-in-client";
import { signInErrorMessage } from "@/lib/sign-in-errors";

export const metadata = {
  title: "Sign in",
  description: "Sign in to continue building and exporting concept albums.",
};

function originOf(value: string | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function hasValue(value: string | undefined) {
  return Boolean(value?.trim());
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // NextAuth sends failed sign-ins back here with `?error=<code>`. The message is rendered on the
  // server so it is on the page before hydration.
  const error = signInErrorMessage((await searchParams).error);
  const githubEnabled =
    hasValue(process.env.GITHUB_ID) && hasValue(process.env.GITHUB_SECRET);
  const emailEnabled =
    hasValue(process.env.EMAIL_SERVER) || hasValue(process.env.RESEND_API_KEY);
  const devLoginEnabled = process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "1";
  // After a failed attempt NextAuth writes `callbackUrl` as an absolute URL on the origin it was
  // configured with, which can differ from the one the page is served on behind a proxy.
  const authOrigin = originOf(process.env.NEXTAUTH_URL ?? process.env.AUTH_URL);

  return (
    <SignInClient
      githubEnabled={githubEnabled}
      emailEnabled={emailEnabled}
      devLoginEnabled={devLoginEnabled}
      error={error}
      authOrigin={authOrigin}
    />
  );
}
