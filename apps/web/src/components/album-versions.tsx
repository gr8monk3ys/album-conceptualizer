"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type VersionListItem = {
  id: string;
  message: string | null;
  createdAt: string;
  createdBy?: { name: string | null; email: string | null } | null;
};

export function AlbumVersions({
  albumId,
  versions,
}: {
  albumId: string;
  versions: VersionListItem[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);

  const canSave = message.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs text-[var(--muted2)]">Versions</div>
            <div className="text-lg font-semibold tracking-tight text-[var(--text)]">
              Save a snapshot
            </div>
          </div>

          <button
            type="button"
            disabled={!canSave || isSaving}
            onClick={async () => {
              const trimmed = message.trim();
              if (!trimmed) return;
              setIsSaving(true);
              try {
                const res = await fetch(`/api/albums/${albumId}/versions`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ message: trimmed }),
                });
                if (!res.ok) {
                  const body = (await res.json().catch(() => null)) as { error?: string } | null;
                  throw new Error(body?.error || "Failed to save version.");
                }
                setMessage("");
                setStatus("Saved version.");
                router.refresh();
              } catch (err) {
                const msg = err instanceof Error ? err.message : "Failed to save version.";
                setStatus(msg);
              } finally {
                setIsSaving(false);
                window.setTimeout(() => setStatus(""), 1800);
              }
            }}
            className="rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save version"}
          </button>
        </div>

        <div className="mt-3">
          <label className="block">
            <div className="text-xs font-semibold text-[var(--text)]">Message</div>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder='e.g., "Chorus rewrite + key changes"'
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
              maxLength={200}
            />
          </label>
          {status ? <div className="mt-2 text-xs text-[var(--muted2)]">{status}</div> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-[var(--muted2)]">History</div>
            <div className="text-sm font-semibold text-[var(--text)]">
              {versions.length ? "Saved versions" : "No versions yet"}
            </div>
          </div>
          <div className="text-xs text-[var(--muted)]">{versions.length} items</div>
        </div>

        <div className="mt-3 space-y-2">
          {versions.length ? (
            versions.map((version) => (
              <div
                key={version.id}
                className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[var(--text)]">
                      {version.message || "Version snapshot"}
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted2)]">
                      {new Date(version.createdAt).toLocaleString()}
                      {version.createdBy?.email ? ` · ${version.createdBy.email}` : ""}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={Boolean(isRestoring)}
                    onClick={async () => {
                      const ok = window.confirm(
                        "Restore this version? This will overwrite the current project snapshot.",
                      );
                      if (!ok) return;
                      setIsRestoring(version.id);
                      setStatus("Restoring...");
                      try {
                        const res = await fetch(
                          `/api/albums/${albumId}/versions/${version.id}/restore`,
                          { method: "POST" },
                        );
                        if (!res.ok) {
                          const body = (await res.json().catch(() => null)) as
                            | { error?: string }
                            | null;
                          throw new Error(body?.error || "Restore failed.");
                        }
                        setStatus("Restored version.");
                        router.push(`/app/albums/${albumId}`);
                        router.refresh();
                      } catch (err) {
                        const msg = err instanceof Error ? err.message : "Restore failed.";
                        setStatus(msg);
                      } finally {
                        setIsRestoring(null);
                        window.setTimeout(() => setStatus(""), 2000);
                      }
                    }}
                    className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isRestoring === version.id ? "Restoring..." : "Restore"}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-4 py-10 text-center text-sm text-[var(--muted)]">
              Save a version before making big lyric or chord changes so you can revert quickly.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
