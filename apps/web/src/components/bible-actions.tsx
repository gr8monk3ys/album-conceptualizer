"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, Sparkles } from "lucide-react";

export function BibleActions({ albumId }: { albumId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function autotag() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/albums/${albumId}/autotag`, { method: "POST" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Autotag failed (${res.status}).`);
      }
      setStatus("Tags applied.");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Autotag failed.";
      setStatus(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={loading}
        onClick={() => void autotag()}
        className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)] disabled:cursor-not-allowed disabled:opacity-60"
        title="Auto-tag themes, motifs, and characters from lyrics"
      >
        <Sparkles className="h-4 w-4" />
        {loading ? "Tagging…" : "Auto-tag"}
      </button>

      <a
        href={`/api/albums/${albumId}/bible/markdown`}
        className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(0,0,0,0.18)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
        title="Download bible as Markdown"
      >
        <Download className="h-4 w-4" />
        Markdown
      </a>

      <a
        href={`/api/albums/${albumId}/bible/pdf`}
        className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(0,0,0,0.18)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
        title="Download bible as PDF"
      >
        <Download className="h-4 w-4" />
        PDF
      </a>

      {status ? (
        <div className="text-xs text-[var(--muted2)]" aria-live="polite">
          {status}
        </div>
      ) : null}
    </div>
  );
}

