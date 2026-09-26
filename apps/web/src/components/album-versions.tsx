"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { RelativeTime } from "@/components/relative-time";
import { Button, EmptyState, Field, Panel, Section, StatusMessage, inputClass } from "@/components/ui";

type VersionListItem = {
  id: string;
  message: string | null;
  createdAt: string;
  createdBy?: { name: string | null; email: string | null } | null;
};

type Status = { tone: "ok" | "danger"; text: string } | null;

async function errorFrom(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string" && body.error ? body.error : fallback;
}

/** Restores write "Before restoring <ISO date>"; show that date in the viewer's own terms. */
function VersionTitle({ message }: { message: string | null }) {
  const match = message?.match(/^Before restoring (\d{4}-\d{2}-\d{2}T[\d:.]+Z)$/);
  if (match) {
    return (
      <>
        Before restoring the version from <RelativeTime date={match[1]} />
      </>
    );
  }
  return <>{message || "Untitled version"}</>;
}

export function AlbumVersions({ albumId, versions }: { albumId: string; versions: VersionListItem[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [saveStatus, setSaveStatus] = useState<Status>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<Status>(null);
  const named = Boolean(message.trim());

  async function save() {
    const trimmed = message.trim();
    if (!trimmed) return;
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch(`/api/albums/${albumId}/versions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      if (!res.ok) throw new Error(await errorFrom(res, "The version wasn't saved. Try again in a moment."));
      setMessage("");
      setSaveStatus({ tone: "ok", text: "Version saved." });
      router.refresh();
    } catch (err) {
      setSaveStatus({
        tone: "danger",
        text: err instanceof Error ? err.message : "The version wasn't saved. Try again in a moment.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function restore(versionId: string) {
    setRestoringId(versionId);
    setRestoreStatus(null);
    try {
      const res = await fetch(`/api/albums/${albumId}/versions/${versionId}/restore`, { method: "POST" });
      if (!res.ok) throw new Error(await errorFrom(res, "That version wasn't restored. Try again in a moment."));
      setRestoreStatus({ tone: "ok", text: "Version restored. Opening the album…" });
      // The Overview says what just happened in one line (it reads `restored`).
      router.push(`/app/albums/${albumId}?restored=${encodeURIComponent(versionId)}`);
      router.refresh();
    } catch (err) {
      setRestoreStatus({
        tone: "danger",
        text: err instanceof Error ? err.message : "That version wasn't restored. Try again in a moment.",
      });
      setRestoringId(null);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <Section
        id="versions-save"
        title="Save a version"
        description="Keep the album as it is right now before a big lyric or chord rewrite, so you can come back to it."
      >
        <Panel className="max-w-2xl">
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <Field
              htmlFor="version-message"
              label="What's in this version"
              hint="A few words you'll recognise later, e.g. “Chorus rewrite and key changes”."
            >
              <input
                id="version-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                aria-describedby="version-message-hint"
                className={inputClass}
                maxLength={200}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                tone="primary"
                disabled={!named}
                busy={isSaving}
                aria-describedby={named ? undefined : "version-save-reason"}
              >
                {isSaving ? "Saving…" : "Save version"}
              </Button>
              {/* A disabled button says why, where the eye already is. */}
              {named ? null : (
                <p id="version-save-reason" className="min-w-0 text-sm text-ink-3">
                  Name the version to save it.
                </p>
              )}
              {saveStatus ? <StatusMessage tone={saveStatus.tone}>{saveStatus.text}</StatusMessage> : null}
            </div>
          </form>
        </Panel>
      </Section>

      <Section
        id="versions-history"
        title="Version history"
        description={
          versions.length
            ? "Newest first. Restoring saves the current draft as a version first, so a restore can be undone."
            : undefined
        }
      >
        {versions.length ? (
          <ol className="divide-y divide-line border-y border-line">
            {versions.map((version) => {
              const confirming = confirmingId === version.id;
              const author = version.createdBy?.name || version.createdBy?.email;
              return (
                <li key={version.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold text-ink">
                        <VersionTitle message={version.message} />
                      </p>
                      <p className="mt-0.5 text-xs text-ink-3">
                        <RelativeTime date={version.createdAt} />
                        {author ? ` · ${author}` : ""}
                      </p>
                    </div>
                    {confirming ? null : (
                      <Button
                        disabled={Boolean(restoringId)}
                        onClick={() => {
                          setConfirmingId(version.id);
                          setRestoreStatus(null);
                        }}
                      >
                        Restore
                        <span className="sr-only">
                          {` the version "${version.message || "Untitled version"}"`}
                        </span>
                      </Button>
                    )}
                  </div>
                  {confirming ? (
                    <div className="mt-3 flex flex-col gap-3 rounded border border-line-strong p-3">
                      <p className="text-sm text-ink">
                        Replace the current draft with this version? The draft is saved as a version
                        first.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          tone="danger"
                          busy={Boolean(restoringId)}
                          onClick={() => void restore(version.id)}
                        >
                          {restoringId === version.id ? "Restoring…" : "Restore this version"}
                        </Button>
                        <Button tone="ghost" disabled={Boolean(restoringId)} onClick={() => setConfirmingId(null)}>
                          Cancel
                        </Button>
                      </div>
                      {restoreStatus ? (
                        <StatusMessage tone={restoreStatus.tone}>{restoreStatus.text}</StatusMessage>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : (
          <EmptyState title="No versions yet">
            Save one above before a big rewrite. You can restore any version later, and restoring
            keeps the draft it replaces.
          </EmptyState>
        )}
      </Section>
    </div>
  );
}
