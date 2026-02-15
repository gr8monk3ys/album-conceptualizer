import { Suspense } from "react";

import { SignInClient } from "@/components/sign-in-client";

export const dynamic = "force-dynamic";

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

