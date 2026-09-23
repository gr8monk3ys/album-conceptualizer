"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shuffle } from "lucide-react";

import { Button, StatusMessage } from "@/components/ui";
import { CREDIT_COSTS } from "@/lib/credit-costs";

/** Remix a shared album into the viewer's workspace, then open the new album. */
export function ForkShareButton({ token }: { token: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<{ tone: "neutral" | "danger"; text: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

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
      <Button tone="primary" disabled={isBusy} onClick={remix}>
        <Shuffle className="h-4 w-4" aria-hidden="true" />
        {isBusy ? "Remixing…" : `Remix into my library · ${CREDIT_COSTS.albumFork} credits`}
      </Button>
      {status ? <StatusMessage tone={status.tone}>{status.text}</StatusMessage> : null}
    </div>
  );
}
