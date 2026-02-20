import { Suspense } from "react";

import { SignInClient } from "@/components/sign-in-client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Sign In",
  description: "Sign in to continue building and exporting concept albums.",
};

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg)] px-6 py-16 text-sm text-[var(--muted)]">
          Loading…
        </div>
      }
    >
      <SignInClient />
    </Suspense>
  );
}
