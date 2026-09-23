"use client";

import { useState } from "react";
import { Copy, Link2 } from "lucide-react";

import { Button, StatusMessage } from "@/components/ui";

type ShareResponse =
  | { share: null }
  | { share: { token: string; url: string; revokedAt: string | null; expiresAt: string | null } };

async function errorFrom(response: Response, fallback: string) {
  const body = (await response.clone().json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string" && body.error ? body.error : fallback;
}

/** A private read-only link to the album, for people who aren't in the workspace. */
export function ShareAlbumButton({
  albumId,
  initialLink,
}: {
  albumId: string;
  initialLink?: string | null;
}) {
  const [status, setStatus] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const [linkOverride, setLinkOverride] = useState<string | null>(null);
  const [busy, setBusy] = useState<"create" | "revoke" | null>(null);
  const link = linkOverride ?? initialLink ?? "";

  async function copy(url: string, created: boolean) {
    try {
      await navigator.clipboard.writeText(url);
      setStatus({ tone: "ok", text: created ? "Share link created and copied." : "Share link copied." });
    } catch {
      setStatus({
        tone: "ok",
        text: created
          ? "Share link created. Copy it from the field above."
          : "Your browser blocked copying. Select the link and copy it by hand.",
      });
    }
  }

  async function create() {
    setBusy("create");
    setStatus(null);
    try {
      const res = await fetch(`/api/albums/${albumId}/share`, { method: "POST" });
      if (!res.ok) throw new Error(await errorFrom(res, "The share link wasn't created. Try again."));
      const body = (await res.json().catch(() => null)) as ShareResponse | null;
      if (!body || !("share" in body) || !body.share) {
        throw new Error("The share link wasn't created. Try again.");
      }
      setLinkOverride(body.share.url);
      await copy(body.share.url, true);
    } catch (err) {
      setStatus({
        tone: "danger",
        text: err instanceof Error ? err.message : "The share link wasn't created. Try again.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function revoke() {
    setBusy("revoke");
    setStatus(null);
    try {
      const res = await fetch(`/api/albums/${albumId}/share`, { method: "DELETE" });
      if (!res.ok) throw new Error(await errorFrom(res, "The link is still active. Try revoking it again."));
      setLinkOverride("");
      setStatus({ tone: "ok", text: "Link revoked. Anyone who has it can no longer open the album." });
    } catch (err) {
      setStatus({
        tone: "danger",
        text: err instanceof Error ? err.message : "The link is still active. Try revoking it again.",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {link ? (
        <>
          <label htmlFor={`share-link-${albumId}`} className="text-sm font-medium text-ink">
            Share link
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={`share-link-${albumId}`}
              readOnly
              value={link}
              onFocus={(event) => event.currentTarget.select()}
              className="min-h-11 min-w-0 flex-1 basis-64 rounded border border-line-control bg-sunken px-3 text-sm text-ink-2"
            />
            <Button onClick={() => void copy(link, false)} disabled={Boolean(busy)}>
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copy link
            </Button>
            <Button tone="ghost" onClick={() => void revoke()} disabled={Boolean(busy)}>
              {busy === "revoke" ? "Revoking…" : "Revoke"}
            </Button>
          </div>
          <p className="max-w-[65ch] text-xs leading-relaxed text-ink-3">
            Anyone with this link can read the album without signing in. Revoke it to shut it off.
          </p>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void create()} disabled={Boolean(busy)}>
            <Link2 className="h-4 w-4" aria-hidden="true" />
            {busy === "create" ? "Creating link…" : "Create share link"}
          </Button>
          <p className="min-w-0 max-w-[65ch] text-sm text-ink-2">
            A read-only link for collaborators who aren&apos;t in your workspace.
          </p>
        </div>
      )}
      {status ? <StatusMessage tone={status.tone}>{status.text}</StatusMessage> : null}
    </div>
  );
}
