"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ForkShareButton({ token }: { token: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<string>("");
  const [isBusy, setIsBusy] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={isBusy}
        onClick={async () => {
          setIsBusy(true);
          setStatus("Forking...");
          try {
            const res = await fetch(`/api/share/${token}/fork`, { method: "POST" });
            const body = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
            if (!res.ok || !body?.id) {
              throw new Error(body?.error || "Failed to fork.");
            }
            setStatus("Forked. Redirecting...");
            router.push(`/app/albums/${body.id}`);
            router.refresh();
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to fork.";
            setStatus(msg);
          } finally {
            setIsBusy(false);
            window.setTimeout(() => setStatus(""), 2000);
          }
        }}
        className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black shadow-[0_20px_70px_rgba(0,0,0,0.4)] hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isBusy ? "Working..." : "Fork to my library"}
      </button>
      {status ? <div className="text-xs text-[var(--muted2)]">{status}</div> : null}
    </div>
  );
}

