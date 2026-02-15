"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

export function ResolveCommentButton({ albumId, commentId }: { albumId: string; commentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await fetch(`/api/albums/${albumId}/comments/${commentId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "resolve" }),
          });
          router.refresh();
        } finally {
          setLoading(false);
        }
      }}
      className="inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-[10px] font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <CheckCircle2 className="h-4 w-4" />
      {loading ? "Resolving…" : "Resolve"}
    </button>
  );
}

export function CompleteTaskButton({ albumId, taskId }: { albumId: string; taskId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await fetch(`/api/albums/${albumId}/tasks/${taskId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status: "done" }),
          });
          router.refresh();
        } finally {
          setLoading(false);
        }
      }}
      className="inline-flex items-center gap-2 rounded-2xl bg-[rgba(255,255,255,0.08)] px-3 py-2 text-[10px] font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.12)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <CheckCircle2 className="h-4 w-4" />
      {loading ? "Done…" : "Mark done"}
    </button>
  );
}

