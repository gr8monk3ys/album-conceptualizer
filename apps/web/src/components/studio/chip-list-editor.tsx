"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";

import { Button, LiveStatus, inputClass } from "@/components/ui";
import { cn } from "@/lib/utils";

/** What adding chips says: "Added theme “tide”.", or "Added 2 themes." for a comma batch. */
export function chipAddedMessage(noun: string, added: readonly string[]): string | null {
  if (!added.length) return null;
  if (added.length === 1) return `Added ${noun} “${added[0]}”.`;
  return `Added ${added.length} ${noun}s.`;
}

/**
 * A labelled list of short values (themes, motifs, characters) edited as chips. New values
 * come from free entry (Enter or comma adds) or from one-click suggestions; every chip has
 * its own labelled remove button.
 *
 * Focus never falls to the page when a control it was on goes away (Focus comes back after
 * async work): Add returns to the field (or, once the list is full, to the last chip's
 * remove button); removing a chip moves to the next chip's remove button, else the previous
 * one, else the field; taking a suggestion moves to the next suggestion, else the field.
 * Every add and remove is said once (focus lands on a control that names only itself).
 */
export function ChipListEditor({
  id,
  label,
  noun,
  values,
  onChange,
  suggestions = [],
  suggestionsLabel,
  placeholder,
  hint,
  max = 32,
}: {
  id: string;
  label: string;
  /** Singular noun for button names, e.g. "theme" → "Remove theme “memory”". */
  noun: string;
  values: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  suggestionsLabel?: string;
  placeholder?: string;
  hint?: string;
  max?: number;
}) {
  const [draft, setDraft] = useState("");
  // Said once when a chip comes or goes: focus moves on to a control that names only itself.
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Where focus goes after the next commit: a data-chip-focus key, or "input".
  const pendingFocus = useRef<string | null>(null);

  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    const root = rootRef.current;
    if (!root) return;
    const byKey = target === "input" ? null : root.querySelector<HTMLElement>(`[data-chip-focus="${CSS.escape(target)}"]`);
    const input = inputRef.current;
    if (byKey) byKey.focus();
    else if (input && !input.disabled) input.focus();
    else Array.from(root.querySelectorAll<HTMLElement>("[data-chip-focus^='remove:']")).at(-1)?.focus();
  });
  const lower = new Set(values.map((v) => v.toLowerCase()));
  const open = suggestions.filter((s, i) => s.trim() && !lower.has(s.toLowerCase()) && suggestions.indexOf(s) === i);
  const full = values.length >= max;

  function add(raw: string) {
    const next = [...values];
    const seen = new Set(next.map((v) => v.toLowerCase()));
    for (const part of raw.split(",")) {
      const value = part.trim().slice(0, 80);
      if (!value || seen.has(value.toLowerCase()) || next.length >= max) continue;
      seen.add(value.toLowerCase());
      next.push(value);
    }
    if (next.length === values.length) return;
    setAnnouncement(chipAddedMessage(noun, next.slice(values.length)));
    onChange(next);
  }

  function commitDraft() {
    if (!draft.trim()) return;
    add(draft);
    setDraft("");
  }

  function commitFromButton() {
    if (!draft.trim()) return;
    const willFill = values.length + 1 >= max;
    commitDraft();
    // Filling the list disables the field and this button; land on the newest chip instead.
    pendingFocus.current = willFill ? `remove:${draft.trim().slice(0, 80)}` : "input";
  }

  function remove(value: string) {
    setAnnouncement(`Removed ${noun} “${value}”.`);
    const index = values.indexOf(value);
    const neighbour = values[index + 1] ?? values[index - 1];
    pendingFocus.current = neighbour !== undefined ? `remove:${neighbour}` : "input";
    onChange(values.filter((v) => v !== value));
  }

  function takeSuggestion(value: string) {
    const index = open.indexOf(value);
    const neighbour = open[index + 1] ?? open[index - 1];
    pendingFocus.current = neighbour !== undefined && values.length + 1 < max ? `suggest:${neighbour}` : "input";
    add(value);
  }

  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div ref={rootRef} className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>

      {values.length ? (
        <ul className="flex flex-wrap gap-2" aria-label={`${label}, ${values.length}`}>
          {values.map((value) => (
            <li
              key={value}
              className="inline-flex min-h-11 max-w-full items-center rounded-sm border border-line-strong bg-raised pl-3 text-sm text-ink"
            >
              <span className="min-w-0 truncate">{value}</span>
              <button
                type="button"
                data-chip-focus={`remove:${value}`}
                onClick={() => remove(value)}
                aria-label={`Remove ${noun} “${value}”`}
                title={`Remove ${noun}`}
                className="grid h-11 w-11 flex-none place-items-center rounded-sm border border-transparent text-ink-3 transition-colors hover:bg-hover hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex min-w-0 gap-2">
        <input
          ref={inputRef}
          id={id}
          value={draft}
          disabled={full}
          onChange={(e) => {
            const value = e.target.value;
            if (value.includes(",")) {
              const parts = value.split(",");
              add(parts.slice(0, -1).join(","));
              setDraft(parts[parts.length - 1] ?? "");
            } else {
              setDraft(value);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitDraft();
            } else if (e.key === "Backspace" && !draft && values.length) {
              setAnnouncement(`Removed ${noun} “${values[values.length - 1]}”.`);
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={(e) => {
            // Moving to Add lets Add commit (and bring focus back here); anywhere else, keep
            // what was typed as a chip.
            if ((e.relatedTarget as HTMLElement | null)?.dataset.chipAdd !== undefined) return;
            commitDraft();
          }}
          placeholder={placeholder}
          aria-describedby={hintId}
          className={cn(inputClass, "min-w-0 flex-1")}
        />
        {/* Unavailable, not disabled: a disabled button under focus drops focus to the page. */}
        <Button
          tone="secondary"
          data-chip-add=""
          onClick={commitFromButton}
          aria-disabled={!draft.trim() || full || undefined}
          aria-label={`Add ${noun}`}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add
        </Button>
      </div>

      {open.length ? (
        <div className="flex flex-col gap-1.5">
          {suggestionsLabel ? <p className="text-xs text-ink-3">{suggestionsLabel}</p> : null}
          <ul className="flex flex-wrap gap-2">
            {open.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  disabled={full}
                  data-chip-focus={`suggest:${s}`}
                  onClick={() => takeSuggestion(s)}
                  aria-label={`Add ${noun} “${s}”`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-sm border border-dashed border-line-strong px-3 text-sm text-ink-2 transition-colors hover:border-ink-3 hover:bg-hover hover:text-ink disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <LiveStatus message={announcement} className="sr-only" />

      {hint ? (
        <p id={hintId} className="max-w-[65ch] text-xs leading-relaxed text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
