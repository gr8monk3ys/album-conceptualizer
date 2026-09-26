"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { RelativeTime } from "@/components/relative-time";
import { versionSavedText } from "@/components/studio/studio-model";
import { Button, EmptyState, Field, LiveStatus, Panel, Section, inputClass } from "@/components/ui";
import { useReturnFocus } from "@/components/use-return-focus";
import { beforeRestoringDate } from "@/lib/version-labels";

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

/**
 * A restore names the draft it keeps after the version it restored, or by that version's save
 * time ("Before restoring <ISO date>"); show that date in the viewer's own terms.
 */
function VersionTitle({ message }: { message: string | null }) {
  const date = beforeRestoringDate(message);
  if (date) {
    return (
      <>
        Before restoring the version from <RelativeTime date={date} />
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
  const returnFocus = useReturnFocus();
  // Each version's Restore button, so Cancel can hand focus back to the one it replaced.
  const restoreButtons = useRef(new Map<string, HTMLButtonElement>());
  // The open confirm's first action. Restore swaps itself for the confirm, so focus moves into
  // it (and its question is read) instead of dropping to the page.
  const confirmButton = useRef<HTMLButtonElement | null>(null);
  const confirmIds = useId();

  useEffect(() => {
    if (confirmingId) confirmButton.current?.focus();
  }, [confirmingId]);

  function cancelRestore(versionId: string) {
    setConfirmingId(null);
    returnFocus(() => restoreButtons.current.get(versionId));
  }

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
      setSaveStatus({ tone: "ok", text: versionSavedText(trimmed) });
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
      {/* The page's own heading: Version history is no album tab's page, so the location is
          named here (and marked current on the catalog line's link). */}
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="break-words text-xl font-semibold text-ink">Version history</h2>
        <p className="max-w-[65ch] text-sm leading-relaxed text-ink-2">
          Save the album as it is now, and go back to an earlier version whenever you need to.
        </p>
      </div>

      <Section
        id="versions-save"
        headingLevel={3}
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
              {/* Unavailable until named, but never `disabled`: the field clears once the version
                  is saved, and a disabled button would drop focus to the page right then. The
                  form ignores an unnamed submit. */}
              <Button
                type="submit"
                tone="primary"
                busy={isSaving}
                aria-disabled={!named || isSaving || undefined}
                aria-describedby={named || saveStatus?.tone === "ok" ? undefined : "version-save-reason"}
              >
                {isSaving ? "Saving…" : "Save version"}
              </Button>
              {/* An unavailable button says why, where the eye already is. */}
              {/* Not beside "Saved “…” as a version.": the field clears after a save, and the reason is
                  only news once someone starts naming the next one. */}
              {named || saveStatus?.tone === "ok" ? null : (
                <p id="version-save-reason" className="min-w-0 text-sm text-ink-3">
                  Name the version to save it.
                </p>
              )}
              {/* Always mounted, so the save ("Saved “First pass” as a version.") is announced once, when it arrives. */}
              <LiveStatus message={saveStatus?.text ?? null} tone={saveStatus?.tone} />
            </div>
          </form>
        </Panel>
      </Section>

      <Section
        id="versions-history"
        headingLevel={3}
        title="Saved versions"
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
              const groupId = `${confirmIds}-${version.id}`;
              const promptId = `${groupId}-prompt`;
              const author = version.createdBy?.name || version.createdBy?.email;
              return (
                <li key={version.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* A 12rem basis: with less room Restore drops below the name instead of
                        squeezing it until words break inside themselves. */}
                    <div className="min-w-0 grow basis-48">
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
                        ref={(node) => {
                          if (node) restoreButtons.current.set(version.id, node);
                          else restoreButtons.current.delete(version.id);
                        }}
                        disabled={Boolean(restoringId)}
                        // A disclosure of the question in its place, like Publish and Confirm Spend.
                        aria-expanded={false}
                        aria-controls={groupId}
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
                    <div
                      id={groupId}
                      role="group"
                      aria-labelledby={promptId}
                      className="mt-3 flex flex-col gap-3 rounded border border-line-strong p-3"
                      onKeyDown={(event) => {
                        // Escape cancels, like every other inline confirm, unless it is running.
                        if (event.key === "Escape" && !restoringId) {
                          event.stopPropagation();
                          cancelRestore(version.id);
                        }
                      }}
                    >
                      <p id={promptId} className="max-w-[65ch] text-sm text-ink">
                        Replace the current draft with this version? The draft is saved as a version
                        first.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          ref={confirmButton}
                          tone="danger"
                          busy={Boolean(restoringId)}
                          onClick={() => void restore(version.id)}
                        >
                          {restoringId === version.id ? "Restoring…" : "Restore this version"}
                        </Button>
                        <Button
                          tone="ghost"
                          disabled={Boolean(restoringId)}
                          onClick={() => cancelRestore(version.id)}
                        >
                          Cancel
                        </Button>
                      </div>
                      <LiveStatus message={restoreStatus?.text ?? null} tone={restoreStatus?.tone} />
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
