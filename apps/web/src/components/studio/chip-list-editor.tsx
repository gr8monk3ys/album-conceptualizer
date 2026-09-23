"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Button, inputClass } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * A labelled list of short values (themes, motifs, characters) edited as chips. New values
 * come from free entry (Enter or comma adds) or from one-click suggestions; every chip has
 * its own labelled remove button.
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
    if (next.length !== values.length) onChange(next);
  }

  function commitDraft() {
    if (!draft.trim()) return;
    add(draft);
    setDraft("");
  }

  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-2">
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
                onClick={() => onChange(values.filter((v) => v !== value))}
                aria-label={`Remove ${noun} “${value}”`}
                title={`Remove ${noun}`}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-sm text-ink-3 transition-colors hover:bg-hover hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex min-w-0 gap-2">
        <input
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
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={commitDraft}
          placeholder={placeholder}
          aria-describedby={hintId}
          className={cn(inputClass, "min-w-0 flex-1")}
        />
        <Button tone="secondary" onClick={commitDraft} disabled={!draft.trim() || full} aria-label={`Add ${noun}`}>
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
                  onClick={() => add(s)}
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

      {hint ? (
        <p id={hintId} className="text-xs leading-relaxed text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
