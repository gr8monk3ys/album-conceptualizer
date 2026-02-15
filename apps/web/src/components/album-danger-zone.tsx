"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AlbumDangerZone({
  albumId,
  albumTitle,
}: {
  albumId: string;
  albumTitle: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,0,64,0.06)] p-4">
      <div className="text-sm font-semibold text-[var(--text)]">Danger zone</div>
      <div className="mt-1 text-sm text-[var(--muted)]">
        Delete <span className="font-semibold text-[var(--text)]">{albumTitle}</span> and all its
        data.
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (!confirm(`Delete "${albumTitle}"? This cannot be undone.`)) return;
            setBusy(true);
            setStatus("");
            try {
              const response = await fetch(`/api/albums/${albumId}`, { method: "DELETE" });
              if (!response.ok) {
                const body = (await response.json().catch(() => null)) as { error?: string } | null;
                throw new Error(body?.error || "Delete failed.");
              }
              router.push("/app");
              router.refresh();
            } catch (err) {
              const message = err instanceof Error ? err.message : "Delete failed.";
              setStatus(message);
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Deleting..." : "Delete project"}
        </button>
        {status ? <div className="text-xs text-[var(--muted2)]">{status}</div> : null}
      </div>
    </div>
  );
}

