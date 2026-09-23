"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shuffle } from "lucide-react";

import { ConfirmSpend } from "@/components/confirm-spend";
import { StatusMessage } from "@/components/ui";
import { CREDIT_COSTS } from "@/lib/credit-costs";

/**
 * Remix a shared album into the viewer's workspace, then open the new album. It spends credits,
 * so it asks once first; pass `creditsRemaining` so the question names the balance after.
 */
export function ForkShareButton({
  token,
  creditsRemaining,
}: {
  token: string;
  creditsRemaining?: number;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<{ tone: "neutral" | "danger"; text: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const cost = CREDIT_COSTS.albumFork;

  async function remix() {
    setIsBusy(true);
    setStatus({ tone: "neutral", text: "Copying the album into your workspace…" });
    try {
      const res = await fetch(`/api/share/${token}/fork`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!res.ok || !body?.id) {
        throw new Error(body?.error || "The remix didn't go through. Try again in a moment.");
      }
      setStatus({ tone: "neutral", text: "Remixed. Opening your copy…" });
      // Open the new album, then refresh so the workspace's credit balance re-renders. (A
      // navigation discards a pending refresh, so the refresh is queued after it.)
      router.push(`/app/albums/${body.id}`);
      router.refresh();
    } catch (err) {
      const text = err instanceof Error ? err.message : "The remix didn't go through. Try again in a moment.";
      setStatus({ tone: "danger", text });
      setIsBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <ConfirmSpend
        cost={cost}
        remaining={creditsRemaining}
        actionLabel="Remix"
        onConfirm={remix}
        busy={isBusy}
        tone="primary"
      >
        <Shuffle className="h-4 w-4" aria-hidden="true" />
        {isBusy ? "Remixing…" : `Remix into my library · ${cost} credits`}
      </ConfirmSpend>
      {status ? <StatusMessage tone={status.tone}>{status.text}</StatusMessage> : null}
    </div>
  );
}
