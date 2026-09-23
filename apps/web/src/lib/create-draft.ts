// The create wizard's draft: every step's fields plus where the artist was, kept in
// sessionStorage (through useDraftState in @/lib/use-autosave, which guards every storage
// access) so a reload or a stray back-swipe doesn't throw away what they typed.

export type NarrativeStructure = "three-act" | "hero's-journey" | "circular" | "non-linear";

export const NARRATIVE_STRUCTURES: readonly NarrativeStructure[] = [
  "three-act",
  "hero's-journey",
  "circular",
  "non-linear",
];

export type QuickStartFormState = {
  title: string;
  artist: string;
  conceptSummary: string;
  narrativeStructure: NarrativeStructure;
  centralThemesRaw: string;
  referenceAlbumsRaw: string;
  trackCount: number;
  trackNamesRaw: string;
};

export type CreateDraft = { form: QuickStartFormState; step: number; visited: number };

export const MIN_TRACKS = 4;
export const MAX_TRACKS = 20;
const LAST_STEP = 2;

export const EMPTY_FORM: QuickStartFormState = {
  title: "",
  artist: "",
  conceptSummary: "",
  narrativeStructure: "three-act",
  centralThemesRaw: "",
  referenceAlbumsRaw: "",
  trackCount: 10,
  trackNamesRaw: "",
};

export const CREATE_DRAFT_KEY = "album-conceptualizer:create-draft:v1";

export const EMPTY_DRAFT: CreateDraft = { form: EMPTY_FORM, step: 0, visited: 0 };

/** True when nothing differs from a fresh wizard: there is nothing worth restoring. */
export function isBlankForm(form: QuickStartFormState): boolean {
  return (Object.keys(EMPTY_FORM) as Array<keyof QuickStartFormState>).every((key) =>
    typeof form[key] === "string"
      ? String(form[key]).trim() === String(EMPTY_FORM[key])
      : form[key] === EMPTY_FORM[key],
  );
}

function clampStep(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? Math.min(LAST_STEP, Math.max(0, value)) : 0;
}

/**
 * Read a stored draft (already JSON-parsed) leniently: unknown or broken fields fall back to the
 * fresh values; a draft with nothing in it is no draft.
 */
export function parseCreateDraft(data: unknown): CreateDraft | null {
  if (!data || typeof data !== "object") return null;
  const stored = (data as { form?: unknown }).form;
  if (!stored || typeof stored !== "object") return null;
  const source = stored as Record<string, unknown>;
  const text = (key: keyof QuickStartFormState) =>
    typeof source[key] === "string" ? (source[key] as string) : (EMPTY_FORM[key] as string);

  const count = source.trackCount;
  const form: QuickStartFormState = {
    title: text("title"),
    artist: text("artist"),
    conceptSummary: text("conceptSummary"),
    narrativeStructure: NARRATIVE_STRUCTURES.includes(source.narrativeStructure as NarrativeStructure)
      ? (source.narrativeStructure as NarrativeStructure)
      : EMPTY_FORM.narrativeStructure,
    centralThemesRaw: text("centralThemesRaw"),
    referenceAlbumsRaw: text("referenceAlbumsRaw"),
    trackCount:
      typeof count === "number" && Number.isFinite(count)
        ? Math.min(MAX_TRACKS, Math.max(MIN_TRACKS, Math.round(count)))
        : EMPTY_FORM.trackCount,
    trackNamesRaw: text("trackNamesRaw"),
  };
  if (isBlankForm(form)) return null;
  const step = clampStep((data as { step?: unknown }).step);
  const visited = Math.max(step, clampStep((data as { visited?: unknown }).visited));
  return { form, step, visited };
}
