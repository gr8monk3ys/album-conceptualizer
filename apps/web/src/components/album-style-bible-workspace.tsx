"use client";

import { useState } from "react";

import type { AlbumStyleBible } from "@/server/album-json";

type StyleBibleResponse = {
  styleBible: Required<AlbumStyleBible>;
};

type StyleBibleSummary = {
  filledCount: number;
  totalCount: number;
  score: number;
  referenceRoles: string[];
  missingReferenceRoles: string[];
};

type StyleBibleFormState = {
  leadVoice: string;
  narratorPerspective: string;
  vocalAttributes: string;
  sonicPalette: string;
  arrangementRules: string;
  mixPriorities: string;
  avoidList: string;
  emotionalTargets: string;
  referenceStrategy: string;
};

function splitList(raw: string) {
  const seen = new Set<string>();
  return raw
    .split(/\r?\n|,/g)
    .map((value) => value.trim())
    .filter((value) => {
      if (!value) return false;
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function joinList(values: string[]) {
  return values.join(", ");
}

function toForm(styleBible: Required<AlbumStyleBible>): StyleBibleFormState {
  return {
    leadVoice: styleBible.lead_voice ?? "",
    narratorPerspective: styleBible.narrator_perspective ?? "",
    vocalAttributes: joinList(styleBible.vocal_attributes),
    sonicPalette: joinList(styleBible.sonic_palette),
    arrangementRules: joinList(styleBible.arrangement_rules),
    mixPriorities: joinList(styleBible.mix_priorities),
    avoidList: joinList(styleBible.avoid_list),
    emotionalTargets: joinList(styleBible.emotional_targets),
    referenceStrategy: styleBible.reference_strategy ?? "",
  };
}

function formatRole(role: string) {
  return role
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildBody(form: StyleBibleFormState) {
  return {
    lead_voice: form.leadVoice.trim() || null,
    narrator_perspective: form.narratorPerspective.trim() || null,
    vocal_attributes: splitList(form.vocalAttributes),
    sonic_palette: splitList(form.sonicPalette),
    arrangement_rules: splitList(form.arrangementRules),
    mix_priorities: splitList(form.mixPriorities),
    avoid_list: splitList(form.avoidList),
    emotional_targets: splitList(form.emotionalTargets),
    reference_strategy: form.referenceStrategy.trim() || null,
  };
}

function buildSummary(styleBible: Required<AlbumStyleBible>, referenceRoles: string[]): StyleBibleSummary {
  const filledCount = [
    Boolean(styleBible.lead_voice),
    Boolean(styleBible.narrator_perspective),
    styleBible.vocal_attributes.length > 0,
    styleBible.sonic_palette.length > 0,
    styleBible.arrangement_rules.length > 0,
    styleBible.mix_priorities.length > 0,
    styleBible.avoid_list.length > 0,
    styleBible.emotional_targets.length > 0,
    Boolean(styleBible.reference_strategy),
  ].filter(Boolean).length;
  const totalCount = 9;

  return {
    filledCount,
    totalCount,
    score: Math.round((filledCount / totalCount) * 100),
    referenceRoles,
    missingReferenceRoles: ["opener", "closer", "vocal-texture", "mix-palette"].filter(
      (role) => !referenceRoles.includes(role),
    ),
  };
}

export function AlbumStyleBibleWorkspace({
  albumId,
  initialStyleBible,
  initialSummary,
  referenceTargets,
}: {
  albumId: string;
  initialStyleBible: Required<AlbumStyleBible>;
  initialSummary: StyleBibleSummary;
  referenceTargets: Array<{
    id: string;
    title: string;
    artist: string | null;
    targetRole: string | null;
    songTitle: string | null;
    songTrackNumber: number | null;
  }>;
}) {
  const [styleBible, setStyleBible] = useState(initialStyleBible);
  const [form, setForm] = useState<StyleBibleFormState>(() => toForm(initialStyleBible));
  const [summary, setSummary] = useState(initialSummary);
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function saveStyleBible() {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/albums/${albumId}/style-bible`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildBody(form)),
      });
      const payload = (await response.json().catch(() => null)) as
        | StyleBibleResponse
        | { error?: string }
        | null;
      if (!response.ok || !payload || !("styleBible" in payload)) {
        throw new Error(
          payload && "error" in payload && payload.error ? payload.error : "Save failed.",
        );
      }

      setStyleBible(payload.styleBible);
      setForm(toForm(payload.styleBible));
      setSummary(buildSummary(payload.styleBible, summary.referenceRoles));
      setStatus("Style bible saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setIsSaving(false);
      window.setTimeout(() => setStatus(""), 1800);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
          <div className="text-xs text-[var(--muted2)]">Voice / Style Bible</div>
          <div className="mt-1 text-lg font-semibold tracking-tight text-[var(--text)]">
            Lock the singer, palette, and production rules before handoff
          </div>
          <div className="mt-2 max-w-[72ch] text-sm text-[var(--muted)]">
            Give collaborators a stable target for vocal character, sonic palette, arrangement
            constraints, and mix priorities.
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-[var(--muted)] md:col-span-2">
              <span className="text-xs text-[var(--muted2)]">Lead voice brief</span>
              <textarea
                value={form.leadVoice}
                onChange={(event) =>
                  setForm((current) => ({ ...current, leadVoice: event.target.value }))
                }
                rows={3}
                className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(0,0,0,0.18)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                placeholder="Close-mic alto with conversational phrasing and controlled falsetto lift."
                aria-label="Lead voice brief"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-[var(--muted)] md:col-span-2">
              <span className="text-xs text-[var(--muted2)]">Narrator perspective</span>
              <input
                value={form.narratorPerspective}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    narratorPerspective: event.target.value,
                  }))
                }
                className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(0,0,0,0.18)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                placeholder="First-person, intimate, slightly unreliable."
                aria-label="Narrator perspective"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-[var(--muted)]">
              <span className="text-xs text-[var(--muted2)]">Vocal attributes</span>
              <textarea
                value={form.vocalAttributes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, vocalAttributes: event.target.value }))
                }
                rows={3}
                className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(0,0,0,0.18)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                placeholder="breathy, clipped consonants, stacked harmonies"
                aria-label="Vocal attributes"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-[var(--muted)]">
              <span className="text-xs text-[var(--muted2)]">Sonic palette</span>
              <textarea
                value={form.sonicPalette}
                onChange={(event) =>
                  setForm((current) => ({ ...current, sonicPalette: event.target.value }))
                }
                rows={3}
                className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(0,0,0,0.18)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                placeholder="chorused guitars, pillowy synths, dry drum room"
                aria-label="Sonic palette"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-[var(--muted)]">
              <span className="text-xs text-[var(--muted2)]">Arrangement rules</span>
              <textarea
                value={form.arrangementRules}
                onChange={(event) =>
                  setForm((current) => ({ ...current, arrangementRules: event.target.value }))
                }
                rows={3}
                className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(0,0,0,0.18)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                placeholder="no full drums before chorus, let bridges drop to bass + vocal"
                aria-label="Arrangement rules"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-[var(--muted)]">
              <span className="text-xs text-[var(--muted2)]">Mix priorities</span>
              <textarea
                value={form.mixPriorities}
                onChange={(event) =>
                  setForm((current) => ({ ...current, mixPriorities: event.target.value }))
                }
                rows={3}
                className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(0,0,0,0.18)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                placeholder="lead vocal forward, bass warm not boomy, choruses widen hard"
                aria-label="Mix priorities"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-[var(--muted)]">
              <span className="text-xs text-[var(--muted2)]">Avoid list</span>
              <textarea
                value={form.avoidList}
                onChange={(event) =>
                  setForm((current) => ({ ...current, avoidList: event.target.value }))
                }
                rows={3}
                className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(0,0,0,0.18)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                placeholder="EDM risers, trap hats, glossy pop vocal tuning"
                aria-label="Avoid list"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-[var(--muted)] md:col-span-2">
              <span className="text-xs text-[var(--muted2)]">Emotional targets</span>
              <textarea
                value={form.emotionalTargets}
                onChange={(event) =>
                  setForm((current) => ({ ...current, emotionalTargets: event.target.value }))
                }
                rows={3}
                className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(0,0,0,0.18)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                placeholder="late-night tension, bittersweet release, small-room intimacy"
                aria-label="Emotional targets"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-[var(--muted)] md:col-span-2">
              <span className="text-xs text-[var(--muted2)]">Reference strategy</span>
              <textarea
                value={form.referenceStrategy}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    referenceStrategy: event.target.value,
                  }))
                }
                rows={4}
                className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(0,0,0,0.18)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
                placeholder="Use the opener reference for vocal distance, the chorus reference for lift, and the mix reference for low-end discipline."
                aria-label="Reference strategy"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={saveStyleBible}
              disabled={isSaving}
              className="rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save style bible"}
            </button>
            {status ? <div className="text-xs text-[var(--muted2)]">{status}</div> : null}
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
          <div className="text-xs text-[var(--muted2)]">Coverage</div>
          <div className="mt-1 text-lg font-semibold text-[var(--text)]">{summary.score}/100</div>
          <div className="mt-2 text-sm text-[var(--muted)]">
            {summary.filledCount} of {summary.totalCount} style anchors are filled.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {styleBible.vocal_attributes
              .concat(styleBible.sonic_palette)
              .slice(0, 6)
              .map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted2)]"
                >
                  {item}
                </span>
              ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
          <div className="text-xs text-[var(--muted2)]">Reference roles</div>
          <div className="mt-1 text-sm font-semibold text-[var(--text)]">
            Use the saved references on purpose
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.referenceRoles.length ? (
              summary.referenceRoles.map((role) => (
                <span
                  key={role}
                  className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted2)]"
                >
                  {formatRole(role)}
                </span>
              ))
            ) : (
              <div className="text-xs text-[var(--muted)]">No reference roles saved yet.</div>
            )}
          </div>
          {summary.missingReferenceRoles.length ? (
            <div className="mt-3 text-xs text-[var(--muted2)]">
              Still missing: {summary.missingReferenceRoles.map(formatRole).join(", ")}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
          <div className="text-xs text-[var(--muted2)]">Saved references</div>
          <div className="mt-1 text-sm font-semibold text-[var(--text)]">
            Current tracks informing the style bible
          </div>
          <div className="mt-3 space-y-2">
            {referenceTargets.length ? (
              referenceTargets.slice(0, 6).map((reference) => (
                <div
                  key={reference.id}
                  className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-3 py-2"
                >
                  <div className="text-xs font-semibold text-[var(--text)]">
                    {reference.title}
                    {reference.artist ? ` · ${reference.artist}` : ""}
                  </div>
                  <div className="mt-1 text-[10px] text-[var(--muted2)]">
                    {reference.targetRole
                      ? formatRole(reference.targetRole)
                      : reference.songTitle
                        ? `Track ${reference.songTrackNumber}: ${reference.songTitle}`
                        : "Album-wide"}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-[var(--muted)]">
                Save reference tracks first if you want concrete vocal, opener, or mix targets.
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
