"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Button, Field, StatusMessage, inputClass } from "@/components/ui";

/**
 * Deleting an album cannot be undone, so the button opens an inline confirmation that asks
 * for the album's title before the real delete is enabled.
 */
export function AlbumDangerZone({ albumId, albumTitle }: { albumId: string; albumTitle: string }) {
  const router = useRouter();
  const inputId = useId();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim() === albumTitle.trim();

  async function remove() {
    if (!matches) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/albums/${albumId}`, { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
        throw new Error(
          typeof body?.error === "string" && body.error
            ? body.error
            : "The album wasn't deleted. Try again in a moment.",
        );
      }
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The album wasn't deleted. Try again in a moment.");
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="album-delete-title" className="border-t border-line pt-6">
      <h2 id="album-delete-title" className="text-lg font-semibold text-ink">
        Delete album
      </h2>
      <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-ink-2">
        Removes the album, its songs, versions, references and demos for good. Remixes other people
        made stay in their workspaces.
      </p>

      {confirming ? (
        <form
          className="mt-4 flex max-w-xl flex-col gap-4 rounded border border-danger/60 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void remove();
          }}
        >
          <Field
            htmlFor={inputId}
            label={
              <>
                Type <span className="font-semibold">{albumTitle}</span> to confirm
              </>
            }
            hint="This can't be undone."
          >
            <input
              id={inputId}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-describedby={`${inputId}-hint`}
              className={inputClass}
              autoFocus
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" tone="danger" disabled={!matches || busy}>
              {busy ? "Deleting…" : "Delete this album"}
            </Button>
            <Button
              tone="ghost"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                setTyped("");
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
          {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}
        </form>
      ) : (
        <div className="mt-4">
          <Button tone="danger" onClick={() => setConfirming(true)}>
            Delete album…
          </Button>
        </div>
      )}
    </section>
  );
}
