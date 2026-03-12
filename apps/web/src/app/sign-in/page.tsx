import { SignInClient } from "@/components/sign-in-client";

export const metadata = {
  title: "Sign In",
  description: "Sign in to continue building and exporting concept albums.",
};

function hasValue(value: string | undefined) {
  return Boolean(value?.trim());
}

export default function SignInPage() {
  const githubEnabled =
    hasValue(process.env.GITHUB_ID) && hasValue(process.env.GITHUB_SECRET);
  const emailEnabled =
    hasValue(process.env.EMAIL_SERVER) || hasValue(process.env.RESEND_API_KEY);
  const devLoginEnabled = process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "1";

  return (
    <SignInClient
      githubEnabled={githubEnabled}
      emailEnabled={emailEnabled}
      devLoginEnabled={devLoginEnabled}
    />
  );
}
