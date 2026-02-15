"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, MailOpen, RotateCcw } from "lucide-react";

export function MarkAllReadButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={async () => {
        setLoading(true);
        try {
          await fetch("/api/notifications/read-all", { method: "POST" });
          router.refresh();
        } finally {
          setLoading(false);
        }
      }}
      className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <MailOpen className="h-4 w-4" />
      {loading ? "Marking…" : "Mark all read"}
    </button>
  );
}

export function ToggleNotificationReadButton({ id, unread }: { id: string; unread: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await fetch(`/api/notifications/${id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: unread ? "read" : "unread" }),
          });
          router.refresh();
        } finally {
          setLoading(false);
        }
      }}
      className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(0,0,0,0.18)] px-3 py-2 text-[10px] font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)] disabled:cursor-not-allowed disabled:opacity-60"
      aria-label={unread ? "Mark read" : "Mark unread"}
      title={unread ? "Mark read" : "Mark unread"}
    >
      {unread ? <CheckCircle2 className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
      {loading ? "…" : unread ? "Read" : "Unread"}
    </button>
  );
}

