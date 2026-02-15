"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Heart, Music2 } from "lucide-react";

export function DiscoverAlbumActions({
  albumId,
  initialLiked,
  initialLikes,
}: {
  albumId: string;
  initialLiked: boolean;
  initialLikes: number;
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [likes, setLikes] = useState(initialLikes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleLike() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/albums/${albumId}/like`, {
        method: liked ? "DELETE" : "POST",
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || `Request failed (${response.status}).`);
      }
      const payload = (await response.json().catch(() => null)) as
        | { liked?: boolean; likes?: number }
        | null;
      setLiked(Boolean(payload?.liked));
      setLikes(typeof payload?.likes === "number" ? payload.likes : likes);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to like.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function remix() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/albums/${albumId}/fork`, { method: "POST" });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || `Request failed (${response.status}).`);
      }
      const payload = (await response.json().catch(() => null)) as { id?: string } | null;
      if (!payload?.id) throw new Error("Remix failed (missing album id).");
      router.push(`/app/albums/${payload.id}/studio`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to remix.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggleLike}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.02)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Heart className={liked ? "h-4 w-4 text-[var(--accent)]" : "h-4 w-4"} />
          {likes}
        </button>
        <button
          type="button"
          onClick={remix}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Music2 className="h-4 w-4" />
          Remix
        </button>
      </div>
      {error ? <div className="text-[10px] text-[var(--muted2)]">{error}</div> : null}
    </div>
  );
}

