"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, Tags } from "lucide-react";

import { Button, StatusMessage, buttonClass } from "@/components/ui";

/** Suggest tags from the lyrics, or take the Bible away as Markdown or PDF. */
export function BibleActions({ albumId }: { albumId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);

  async function autotag() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/albums/${albumId}/autotag`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
        throw new Error(
          typeof body?.error === "string" && body.error
            ? body.error
            : "No tags were added. Try again in a moment.",
        );
      }
      setStatus({ tone: "ok", text: "Tags added from the lyrics. Review each track's themes and motifs in the Studio." });
      router.refresh();
    } catch (err) {
      setStatus({
        tone: "danger",
        text: err instanceof Error ? err.message : "No tags were added. Try again in a moment.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void autotag()} disabled={loading} aria-busy={loading || undefined}>
          <Tags className="h-4 w-4" aria-hidden="true" />
          {loading ? "Tagging…" : "Tag from lyrics"}
        </Button>
        <a href={`/api/albums/${albumId}/bible/markdown`} className={buttonClass("ghost")} download>
          <Download className="h-4 w-4" aria-hidden="true" />
          <span>
            <span className="sr-only">Download the Bible as </span>Markdown
          </span>
        </a>
        <a href={`/api/albums/${albumId}/bible/pdf`} className={buttonClass("ghost")} download>
          <Download className="h-4 w-4" aria-hidden="true" />
          <span>
            <span className="sr-only">Download the Bible as </span>PDF
          </span>
        </a>
      </div>
      {status ? <StatusMessage tone={status.tone}>{status.text}</StatusMessage> : null}
    </div>
  );
}
