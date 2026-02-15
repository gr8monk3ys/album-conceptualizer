"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Heart, Music2, Sparkles } from "lucide-react";

type DiscoverAlbum = {
  id: string;
  title: string;
  artist: string | null;
  primaryGenre: string | null;
  trackCount: number;
  coverUrl: string | null;
  publishedAt: string | null;
  likes: number;
  liked: boolean;
};

export function DiscoverAlbumCard({ album }: { album: DiscoverAlbum }) {
  const router = useRouter();
  const [liked, setLiked] = useState(album.liked);
  const [likes, setLikes] = useState(album.likes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleLike() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/albums/${album.id}/like`, {
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
      const response = await fetch(`/api/albums/${album.id}/fork`, { method: "POST" });
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
    <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.15)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={`/app/discover/${album.id}`}
            className="text-lg font-semibold tracking-tight text-[var(--text)] hover:underline"
          >
            {album.title}
          </Link>
          <div className="mt-1 text-sm text-[var(--muted)]">
            {album.artist ? `by ${album.artist}` : "Artist not set"} ·{" "}
            {album.primaryGenre || "Concept"} · {album.trackCount} tracks
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted2)]">
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.03)] px-3 py-1">
              <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
              Published {album.publishedAt ? new Date(album.publishedAt).toLocaleDateString() : ""}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.03)] px-3 py-1">
              <Heart className="h-3.5 w-3.5" />
              {likes}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleLike}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.02)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Heart className={liked ? "h-4 w-4 text-[var(--accent)]" : "h-4 w-4"} />
            {liked ? "Liked" : "Like"}
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
      </div>

      {error ? <div className="mt-3 text-xs text-[var(--muted)]">{error}</div> : null}
    </div>
  );
}

