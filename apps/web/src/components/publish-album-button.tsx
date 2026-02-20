"use client";

import { useState } from "react";
import { Globe2, Lock } from "lucide-react";

export function PublishAlbumButton({
  albumId,
  initialPublic,
}: {
  albumId: string;
  initialPublic: boolean;
}) {
  const [publicOverride, setPublicOverride] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const isPublic = publicOverride ?? initialPublic;

  async function toggle() {
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/albums/${albumId}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isPublic: !isPublic }),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || `Request failed (${response.status}).`);
      }
      const payload = (await response.json().catch(() => null)) as { isPublic?: boolean } | null;
      setPublicOverride(Boolean(payload?.isPublic));
      setStatus(payload?.isPublic ? "Published to Discover." : "Unpublished.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update publish state.";
      setStatus(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)] disabled:cursor-not-allowed disabled:opacity-60"
        title={
          isPublic
            ? "Visible in Discover"
            : "Private (only accessible to you unless you share a link)"
        }
      >
        {isPublic ? <Globe2 className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
        {isPublic ? "Published" : "Publish"}
      </button>
      {status ? <div className="text-[10px] text-[var(--muted2)]">{status}</div> : null}
    </div>
  );
}
