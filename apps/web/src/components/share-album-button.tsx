"use client";

import { useState } from "react";

type ShareResponse =
  | { share: null }
  | { share: { token: string; url: string; revokedAt: string | null; expiresAt: string | null } };

export function ShareAlbumButton({
  albumId,
  initialLink,
}: {
  albumId: string;
  initialLink?: string | null;
}) {
  const [status, setStatus] = useState<string>("");
  const [linkOverride, setLinkOverride] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const link = linkOverride ?? initialLink ?? "";

  async function createOrRotate() {
    setIsBusy(true);
    try {
      const res = await fetch(`/api/albums/${albumId}/share`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as ShareResponse | null;
      if (!res.ok || !body || !("share" in body) || !body.share) {
        throw new Error("Failed to create share link.");
      }
      setLinkOverride(body.share.url);
      await navigator.clipboard.writeText(body.share.url);
      setStatus("Share link copied.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create share link.";
      setStatus(msg);
    } finally {
      setIsBusy(false);
      window.setTimeout(() => setStatus(""), 1600);
    }
  }

  async function revoke() {
    setIsBusy(true);
    try {
      const res = await fetch(`/api/albums/${albumId}/share`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to revoke share link.");
      setLinkOverride("");
      setStatus("Revoked.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to revoke share link.";
      setStatus(msg);
    } finally {
      setIsBusy(false);
      window.setTimeout(() => setStatus(""), 1600);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={isBusy}
        onClick={createOrRotate}
        className="rounded-2xl border border-line bg-raised px-4 py-2 text-xs font-semibold text-ink hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isBusy ? "Working..." : "Share"}
      </button>

      {link ? (
        <>
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="hidden max-w-[260px] truncate rounded-2xl border border-line-strong bg-sunken px-3 py-2 text-xs text-ink-2 hover:bg-sunken sm:block"
            title={link}
          >
            {link}
          </a>
          <button
            type="button"
            disabled={isBusy}
            onClick={revoke}
            className="rounded-2xl border border-danger bg-danger-soft px-3 py-2 text-xs font-semibold text-danger hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            Revoke
          </button>
        </>
      ) : null}

      {status ? <div className="text-xs text-ink-3">{status}</div> : null}
    </div>
  );
}
