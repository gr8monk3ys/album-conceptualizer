"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useCallback, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { RelativeTime } from "@/components/relative-time";
import { LeavePrompt } from "@/components/sound-nav";
import {
  Button,
  ButtonLink,
  Chip,
  Field,
  LiveStatus,
  Panel,
  Section,
  inputClass,
  textareaClass,
} from "@/components/ui";
import { referenceRoleLabel, referenceRoleList } from "@/lib/reference-roles";
import { soundBibleFieldsSet } from "@/lib/sound-bible-progress";
import { STYLE_BIBLE_LIST_LIMIT } from "@/lib/style-bible-limits";
import { useAutosave } from "@/lib/use-autosave";
import type { AlbumStyleBible } from "@/server/album-json";
import { bodyBytes, pageKeepaliveBudget } from "@/components/studio/save-transport";

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

type StyleBibleBody = ReturnType<typeof buildBody>;

/** The nine fields of the Sound bible (`style_bible`), in the order the form asks for them. */
const FIELDS: Array<{ key: keyof StyleBibleFormState; label: string }> = [
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
  const [form, setForm] = useState<StyleBibleFormState>(() => toForm(initialStyleBible));
  // When the viewer last pressed "Save now" (or Ctrl/⌘+S); the status names that save plainly.
  const [explicitSaveAt, setExplicitSaveAt] = useState<number | null>(null);

  const filled = FIELDS.filter((field) => form[field.key].trim().length > 0);
  const open = FIELDS.filter((field) => !form[field.key].trim());
  // Compare what would be sent, so a trailing comma or space isn't an unsaved change.
  const body = useMemo(() => buildBody(form), [form]);

  const save = useCallback(
    async (value: StyleBibleBody) => {
      const payload = JSON.stringify(value);
      const bytes = bodyBytes(payload);
      const send = (keepalive: boolean) =>
        fetch(`/api/albums/${albumId}/style-bible`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: payload,
          keepalive,
        });
      let response: Response;
      // Keepalive lets the last edits reach the server as the tab closes, but the page shares
      // one 64 KiB keepalive budget with the Studio's saves: take room from it, and send
      // without keepalive (never fail) when the browser refuses.
      const keepalive = pageKeepaliveBudget.take(bytes, "routine");
      try {
        try {
          response = await send(keepalive);
        } catch (error) {
          if (!keepalive) throw error;
          response = await send(false);
        }
      } catch {
        throw new Error("Couldn't reach the server. Your text is still here.");
      } finally {
        if (keepalive) pageKeepaliveBudget.give(bytes);
      }
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: unknown } | null;
        throw new Error(
          response.status === 401
            ? "You're signed out. Sign in again in another tab, then retry."
            : typeof data?.error === "string" && data.error.trim()
              ? data.error
              : "The Sound bible didn't save. Your text is still here.",
        );
      }
    },
    [albumId],
  );

  const autosave = useAutosave({ value: body, save });

  function update(key: keyof StyleBibleFormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveStyleBible(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await autosave.saveNow()) setExplicitSaveAt(Date.now());
  }

  const showExplicit =
    explicitSaveAt !== null &&
    (autosave.status === "saved" || autosave.status === "idle") &&
    explicitSaveAt >= (autosave.lastSavedAt ?? 0);

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

  // One save model: the form autosaves, so the save state is a status line with a quiet
  // "Save now" beside it, never a primary button or a bar pinned over the fields. Like the
  // Studio, only events are announced: the result of a Save now the artist asked for, and a
  // save that failed, once each. Autosave's own cycle (Unsaved changes, Saving…, Saved · when)
  // stays readable beside it but is never announced, so typing is never talked over.
  const liveStatus =
    autosave.status === "error"
      ? { tone: "danger" as const, text: `Unsaved changes — ${autosave.error}` }
      : showExplicit
        ? { tone: "ok" as const, text: "Sound bible saved." }
        : null;
  const quietStatus = liveStatus
    ? null
    : autosave.status === "dirty"
      ? "Unsaved changes"
      : autosave.status === "saving"
        ? "Saving…"
        : autosave.status === "saved"
          ? "Saved"
          : "All changes saved";
  const saveState = (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      {/* The live and the quiet status never both hold text. */}
      <div className="min-w-0 break-words">
        <LiveStatus message={liveStatus?.text ?? null} tone={liveStatus?.tone} />
        {quietStatus ? (
          <p className="text-ink-2">
            {quietStatus}
            {autosave.status === "saved" && autosave.lastSavedAt ? (
              <span className="text-ink-3">
                {" · "}
                <RelativeTime date={new Date(autosave.lastSavedAt).toISOString()} />
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
      {autosave.status === "error" ? (
        <Button tone="ghost" className="px-3" onClick={() => void autosave.retry()}>
          Retry
        </Button>
      ) : (
        // Busy, not disabled, while a save runs: pressing it keeps focus here.
        <Button type="submit" tone="ghost" className="px-3" busy={autosave.status === "saving"}>
          Save now
        </Button>
      )}
    </div>
  );

  const label = (key: keyof StyleBibleFormState) =>
    FIELDS.find((field) => field.key === key)?.label ?? key;

  /** A list over the limit won't save; say so under the field, not only in the status line. */
  const overLimit = (key: keyof StyleBibleFormState) => {
    const count = splitList(form[key]).length;
    return count > STYLE_BIBLE_LIST_LIMIT
      ? `${count} items; this list keeps up to ${STYLE_BIBLE_LIST_LIMIT}. Remove ${count - STYLE_BIBLE_LIST_LIMIT} to save.`
      : undefined;
  };

  return (
    <Section
      id="style-bible"
      title="Sound bible — how this album should sound"
      description="The lead voice, sonic palette, arrangement rules and mix priorities, in one place. Collaborators and every handoff pack read them from here."
      actions={
        // Its twin: the Story bible holds what the album is about.
        <Link
          href={`/app/albums/${albumId}/bible`}
          className="inline-flex min-h-11 min-w-0 items-center gap-1 text-sm font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink-3"
        >
          What it&apos;s about
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">:</span> Story bible
        </Link>
      }
    >
      <div className="@container">
        <div className="grid grid-cols-1 gap-8 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] @3xl:items-start">
          <Panel className="@container">
            <form onSubmit={(event) => void saveStyleBible(event)}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                <p className="type-figure text-sm text-ink">
                  {soundBibleFieldsSet(filled.length, FIELDS.length)}
                </p>
                {saveState}
              </div>
              <div aria-hidden="true" className="mt-2 flex gap-1">
                {FIELDS.map((field) => (
                  <span
                    key={field.key}
                    className={
                      form[field.key].trim()
                        ? "h-1 flex-1 rounded-sm bg-ink-2"
                        : "h-1 flex-1 rounded-sm bg-line"
                    }
                  />
                ))}
              </div>
              {open.length && open.length < FIELDS.length ? (
                <p className="mt-2 max-w-[65ch] text-xs leading-relaxed text-ink-3">
                  Still open: {open.map((field) => field.label).join(", ")}
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
                      // Short enough for the one-line field in the two-column group; an ellipsis
                      // rather than a hard cut where enlarged text still leaves no room.
                      className={`${inputClass} text-ellipsis`}
                      placeholder="e.g. First person, unreliable"
                      autoComplete="off"
                    />
                  </Field>
                  <Field
                    label={label("vocalAttributes")}
                    htmlFor={fieldId("vocalAttributes")}
                    error={overLimit("vocalAttributes")}
                  >
                    {textarea("vocalAttributes", "e.g. breathy, clipped consonants, stacked harmonies")}
                  </Field>
                </Group>

                <Group legend="Sound">
                  <Field
                    label={label("sonicPalette")}
                    htmlFor={fieldId("sonicPalette")}
                    error={overLimit("sonicPalette")}
                  >
                    {textarea("sonicPalette", "e.g. chorused guitars, pillowy synths, dry drum room")}
                  </Field>
                  <Field
                    label={label("arrangementRules")}
                    htmlFor={fieldId("arrangementRules")}
                    error={overLimit("arrangementRules")}
                  >
                    {textarea(
                      "arrangementRules",
                      "e.g. no full drums before chorus, let bridges drop to bass + vocal",
                    )}
                  </Field>
                  <Field
                    label={label("mixPriorities")}
                    htmlFor={fieldId("mixPriorities")}
                    error={overLimit("mixPriorities")}
                  >
                    {textarea(
                      "mixPriorities",
                      "e.g. lead vocal forward, bass warm not boomy, choruses widen hard",
                    )}
                  </Field>
                  <Field
                    label={label("avoidList")}
                    htmlFor={fieldId("avoidList")}
                    error={overLimit("avoidList")}
                  >
                    {textarea("avoidList", "e.g. EDM risers, trap hats, glossy pop vocal tuning")}
                  </Field>
                </Group>

                <Group legend="Direction">
                  <Field
                    label={label("emotionalTargets")}
                    htmlFor={fieldId("emotionalTargets")}
                    error={overLimit("emotionalTargets")}
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

              <p className="mt-6 max-w-[65ch] border-t border-line pt-4 text-xs leading-relaxed text-ink-3">
                List fields take commas or new lines, up to {STYLE_BIBLE_LIST_LIMIT} items each. Changes
                save as you type;{" "}
                <span className="pointer-coarse:hidden">press Ctrl or ⌘ + S, or </span>
                use Save now to save at once.
              </p>
            </form>
          </Panel>
          <LeavePrompt
            guard={autosave.leaveGuard}
            message="Your latest Sound bible changes didn't save. If you leave now, they'll be lost."
          />

          <section aria-label="References behind the Sound bible" className="flex min-w-0 flex-col gap-8">
            <div>
              <h3 className="text-base font-semibold text-ink">Reference roles</h3>
              <p className="mt-1 text-sm text-ink-2">Use the saved references on purpose.</p>
              {initialSummary.referenceRoles.length ? (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {initialSummary.referenceRoles.map((role) => (
                    <li key={role}>
                      <Chip>{referenceRoleLabel(role)}</Chip>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-ink-3">No reference roles saved yet.</p>
              )}
              {initialSummary.missingReferenceRoles.length ? (
                <p className="mt-3 text-xs leading-relaxed text-ink-3">
                  Still missing: {referenceRoleList(initialSummary.missingReferenceRoles)}.
                </p>
              ) : null}
            </div>

            <div>
              <h3 className="text-base font-semibold text-ink">Saved references</h3>
              <p className="mt-1 max-w-[65ch] text-sm text-ink-2">
                The album&apos;s references informing the Sound bible.
              </p>
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
                        {[
                          reference.targetRole ? referenceRoleLabel(reference.targetRole) : null,
                          reference.songTitle && reference.songTrackNumber
                            ? `Track ${String(reference.songTrackNumber).padStart(2, "0")}: ${reference.songTitle}`
                            : "Whole album",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-ink-3">
                  Add references first if you want concrete vocal, opener, or mix targets.
                </p>
              )}
              <ButtonLink href={`/app/albums/${albumId}/references`} tone="ghost" className="mt-2 -ml-4">
                {referenceTargets.length ? "Manage references" : "Add references"}
              </ButtonLink>
            </div>
          </section>
        </div>
      </div>
    </Section>
  );
}
