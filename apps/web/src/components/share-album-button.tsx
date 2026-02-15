"use client";

import { useEffect, useState } from "react";

type ShareResponse =
  | { share: null }
  | { share: { token: string; url: string; revokedAt: string | null; expiresAt: string | null } };

export function ShareAlbumButton({ albumId }: { albumId: string }) {
  const [status, setStatus] = useState<string>("");
  const [link, setLink] = useState<string>("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(`/api/albums/${albumId}/share`, { method: "GET" });
        const body = (await res.json().catch(() => null)) as ShareResponse | null;
        if (!ignore && res.ok && body && "share" in body && body.share?.url) {
          if (!body.share.revokedAt) setLink(body.share.url);
        }
      } catch {
        // Ignore; sharing is optional.
      }
    })();
    return () => {
      ignore = true;
    };
  }, [albumId]);

  async function createOrRotate() {
    setIsBusy(true);
    try {
      const res = await fetch(`/api/albums/${albumId}/share`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as ShareResponse | null;
      if (!res.ok || !body || !("share" in body) || !body.share) {
        throw new Error("Failed to create share link.");
      }
      setLink(body.share.url);
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
      setLink("");
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
        className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isBusy ? "Working..." : "Share"}
      </button>

      {link ? (
        <>
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="hidden max-w-[260px] truncate rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(0,0,0,0.18)] px-3 py-2 text-xs text-[var(--muted)] hover:bg-[rgba(0,0,0,0.24)] sm:block"
            title={link}
          >
            {link}
          </a>
          <button
            type="button"
            disabled={isBusy}
            onClick={revoke}
            className="rounded-2xl border border-[rgba(255,72,72,0.30)] bg-[rgba(255,72,72,0.10)] px-3 py-2 text-xs font-semibold text-[var(--bad)] hover:bg-[rgba(255,72,72,0.14)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Revoke
          </button>
        </>
      ) : null}

      {status ? <div className="text-xs text-[var(--muted2)]">{status}</div> : null}
    </div>
  );
}
