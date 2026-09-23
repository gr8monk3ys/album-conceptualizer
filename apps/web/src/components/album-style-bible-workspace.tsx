"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import {
  Button,
  ButtonLink,
  Chip,
  Field,
  Panel,
  Section,
  StatusMessage,
  inputClass,
  textareaClass,
} from "@/components/ui";
import type { AlbumStyleBible } from "@/server/album-json";

type StyleBibleResponse = {
  styleBible: Required<AlbumStyleBible>;
};

type StyleBibleSummary = {
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

type Status = { tone: "ok" | "danger"; text: string } | null;

/** The nine sections of a style bible, in the order the form asks for them. */
const SECTIONS: Array<{ key: keyof StyleBibleFormState; label: string }> = [
  { key: "leadVoice", label: "Lead voice brief" },
  { key: "narratorPerspective", label: "Narrator perspective" },
  { key: "vocalAttributes", label: "Vocal attributes" },
  { key: "sonicPalette", label: "Sonic palette" },
  { key: "arrangementRules", label: "Arrangement rules" },
  { key: "mixPriorities", label: "Mix priorities" },
  { key: "avoidList", label: "Avoid list" },
  { key: "emotionalTargets", label: "Emotional targets" },
  { key: "referenceStrategy", label: "Reference strategy" },
];

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

function fieldId(key: keyof StyleBibleFormState) {
  return `style-${key}`;
}

function Group({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="w-full border-t border-line pt-4 text-sm font-semibold text-ink">
        {legend}
      </legend>
      <div className="mt-3 grid grid-cols-1 gap-4 @xl:grid-cols-2">{children}</div>
    </fieldset>
  );
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
  const [savedForm, setSavedForm] = useState<StyleBibleFormState>(() => toForm(initialStyleBible));
  const [form, setForm] = useState<StyleBibleFormState>(() => toForm(initialStyleBible));
  const [status, setStatusState] = useState<Status>(null);
  const [isSaving, setIsSaving] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  function setStatus(next: Status) {
    if (timer.current) window.clearTimeout(timer.current);
    setStatusState(next);
    if (next?.tone === "ok") timer.current = window.setTimeout(() => setStatusState(null), 4000);
  }

  const filled = SECTIONS.filter((section) => form[section.key].trim().length > 0);
  const open = SECTIONS.filter((section) => !form[section.key].trim());
  const isDirty = JSON.stringify(buildBody(form)) !== JSON.stringify(buildBody(savedForm));

  function update(key: keyof StyleBibleFormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveStyleBible(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
          payload && "error" in payload && payload.error
            ? payload.error
            : "The style bible didn't save. Your text is still here; try again in a moment.",
        );
      }

      const next = toForm(payload.styleBible);
      setSavedForm(next);
      setForm(next);
      setStatus({ tone: "ok", text: "Style bible saved." });
    } catch (error) {
      setStatus({
        tone: "danger",
        text:
          error instanceof Error
            ? error.message
            : "The style bible didn't save. Your text is still here; try again in a moment.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  function textarea(key: keyof StyleBibleFormState, placeholder: string, rows = 3) {
    return (
      <textarea
        id={fieldId(key)}
        value={form[key]}
        onChange={(event) => update(key, event.target.value)}
        rows={rows}
        className={textareaClass}
        placeholder={placeholder}
      />
    );
  }

  const label = (key: keyof StyleBibleFormState) =>
    SECTIONS.find((section) => section.key === key)?.label ?? key;

  return (
    <Section
      id="style-bible"
      title="Lock the singer, palette, and production rules before handoff"
      description="Give collaborators a stable target for vocal character, sonic palette, arrangement constraints, and mix priorities."
    >
      <div className="@container">
        <div className="grid grid-cols-1 gap-8 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] @3xl:items-start">
          <Panel className="@container">
            <form onSubmit={(event) => void saveStyleBible(event)}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                <p className="text-sm text-ink">
                  <span className="type-figure font-semibold">{filled.length}</span> of{" "}
                  <span className="type-figure">{SECTIONS.length}</span> sections filled
                </p>
                <p className="text-xs text-ink-3">List fields take commas or new lines.</p>
              </div>
              <div aria-hidden="true" className="mt-2 flex gap-1">
                {SECTIONS.map((section) => (
                  <span
                    key={section.key}
                    className={
                      form[section.key].trim()
                        ? "h-1 flex-1 rounded-sm bg-ink-2"
                        : "h-1 flex-1 rounded-sm bg-line"
                    }
                  />
                ))}
              </div>
              {open.length && open.length < SECTIONS.length ? (
                <p className="mt-2 text-xs leading-relaxed text-ink-3">
                  Still open: {open.map((section) => section.label).join(", ")}
                </p>
              ) : null}

              <div className="mt-6 flex flex-col gap-6">
                <Group legend="Voice">
                  <Field
                    label={label("leadVoice")}
                    htmlFor={fieldId("leadVoice")}
                    className="@xl:col-span-2"
                  >
                    {textarea(
                      "leadVoice",
                      "e.g. Close-mic alto with conversational phrasing and controlled falsetto lift.",
                    )}
                  </Field>
                  <Field
                    label={label("narratorPerspective")}
                    htmlFor={fieldId("narratorPerspective")}
                  >
                    <input
                      id={fieldId("narratorPerspective")}
                      value={form.narratorPerspective}
                      onChange={(event) => update("narratorPerspective", event.target.value)}
                      className={inputClass}
                      placeholder="e.g. First-person, intimate, slightly unreliable."
                      autoComplete="off"
                    />
                  </Field>
                  <Field label={label("vocalAttributes")} htmlFor={fieldId("vocalAttributes")}>
                    {textarea("vocalAttributes", "e.g. breathy, clipped consonants, stacked harmonies")}
                  </Field>
                </Group>

                <Group legend="Sound">
                  <Field label={label("sonicPalette")} htmlFor={fieldId("sonicPalette")}>
                    {textarea("sonicPalette", "e.g. chorused guitars, pillowy synths, dry drum room")}
                  </Field>
                  <Field label={label("arrangementRules")} htmlFor={fieldId("arrangementRules")}>
                    {textarea(
                      "arrangementRules",
                      "e.g. no full drums before chorus, let bridges drop to bass + vocal",
                    )}
                  </Field>
                  <Field label={label("mixPriorities")} htmlFor={fieldId("mixPriorities")}>
                    {textarea(
                      "mixPriorities",
                      "e.g. lead vocal forward, bass warm not boomy, choruses widen hard",
                    )}
                  </Field>
                  <Field label={label("avoidList")} htmlFor={fieldId("avoidList")}>
                    {textarea("avoidList", "e.g. EDM risers, trap hats, glossy pop vocal tuning")}
                  </Field>
                </Group>

                <Group legend="Direction">
                  <Field
                    label={label("emotionalTargets")}
                    htmlFor={fieldId("emotionalTargets")}
                    className="@xl:col-span-2"
                  >
                    {textarea(
                      "emotionalTargets",
                      "e.g. late-night tension, bittersweet release, small-room intimacy",
                    )}
                  </Field>
                  <Field
                    label={label("referenceStrategy")}
                    htmlFor={fieldId("referenceStrategy")}
                    className="@xl:col-span-2"
                  >
                    {textarea(
                      "referenceStrategy",
                      "e.g. Use the opener reference for vocal distance, the chorus reference for lift, and the mix reference for low-end discipline.",
                      4,
                    )}
                  </Field>
                </Group>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-4">
                <Button type="submit" tone="primary" disabled={isSaving}>
                  {isSaving ? "Saving…" : "Save style bible"}
                </Button>
                {status ? (
                  <StatusMessage tone={status.tone}>{status.text}</StatusMessage>
                ) : isDirty ? (
                  <p className="text-sm text-ink-3">Unsaved changes</p>
                ) : null}
              </div>
            </form>
          </Panel>

          <aside aria-label="References behind the style bible" className="flex min-w-0 flex-col gap-8">
            <div>
              <h3 className="text-base font-semibold text-ink">Reference roles</h3>
              <p className="mt-1 text-sm text-ink-2">Use the saved references on purpose.</p>
              {initialSummary.referenceRoles.length ? (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {initialSummary.referenceRoles.map((role) => (
                    <li key={role}>
                      <Chip>{formatRole(role)}</Chip>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-ink-3">No reference roles saved yet.</p>
              )}
              {initialSummary.missingReferenceRoles.length ? (
                <p className="mt-3 text-xs leading-relaxed text-ink-3">
                  Still missing:{" "}
                  {initialSummary.missingReferenceRoles.map(formatRole).join(", ")}
                </p>
              ) : null}
            </div>

            <div>
              <h3 className="text-base font-semibold text-ink">Saved references</h3>
              <p className="mt-1 text-sm text-ink-2">Current tracks informing the style bible.</p>
              {referenceTargets.length ? (
                <ul className="mt-3 divide-y divide-line border-y border-line">
                  {referenceTargets.slice(0, 6).map((reference) => (
                    <li key={reference.id} className="py-2.5">
                      <p className="break-words text-sm font-medium text-ink">
                        {reference.title}
                        {reference.artist ? (
                          <span className="font-normal text-ink-2"> · {reference.artist}</span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-3">
                        {reference.targetRole
                          ? formatRole(reference.targetRole)
                          : reference.songTitle
                            ? `Track ${reference.songTrackNumber}: ${reference.songTitle}`
                            : "Album-wide"}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-ink-3">
                  Save reference tracks first if you want concrete vocal, opener, or mix targets.
                </p>
              )}
              <ButtonLink href={`/app/albums/${albumId}/references`} tone="ghost" className="mt-2 -ml-4">
                {referenceTargets.length ? "Manage references" : "Add references"}
              </ButtonLink>
            </div>
          </aside>
        </div>
      </div>
    </Section>
  );
}
