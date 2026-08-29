import { AlbumJsonSchema } from "@/server/album-json";
import type { AlbumStyleBible } from "@/server/album-json";
import type { AlbumReferenceRecord } from "@/server/references";

export const EMPTY_STYLE_BIBLE: Required<AlbumStyleBible> = {
  lead_voice: null,
  narrator_perspective: null,
  vocal_attributes: [],
  sonic_palette: [],
  arrangement_rules: [],
  mix_priorities: [],
  avoid_list: [],
  emotional_targets: [],
  reference_strategy: null,
};

const CORE_REFERENCE_ROLES = ["opener", "closer", "vocal-texture", "mix-palette"] as const;

function normalizeToken(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableString(value: unknown, limit: number) {
  const text = normalizeToken(value);
  return text ? text.slice(0, limit) : null;
}

function normalizeList(value: unknown, limit = 12) {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of value) {
    const token = normalizeToken(raw);
    if (!token) continue;
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(token);
    if (items.length >= limit) break;
  }

  return items;
}

export function normalizeStyleBible(value: unknown): Required<AlbumStyleBible> {
  if (!value || typeof value !== "object") return EMPTY_STYLE_BIBLE;

  return {
    lead_voice: normalizeNullableString((value as { lead_voice?: unknown }).lead_voice, 600),
    narrator_perspective: normalizeNullableString(
      (value as { narrator_perspective?: unknown }).narrator_perspective,
      300,
    ),
    vocal_attributes: normalizeList((value as { vocal_attributes?: unknown }).vocal_attributes),
    sonic_palette: normalizeList((value as { sonic_palette?: unknown }).sonic_palette),
    arrangement_rules: normalizeList((value as { arrangement_rules?: unknown }).arrangement_rules),
    mix_priorities: normalizeList((value as { mix_priorities?: unknown }).mix_priorities),
    avoid_list: normalizeList((value as { avoid_list?: unknown }).avoid_list),
    emotional_targets: normalizeList((value as { emotional_targets?: unknown }).emotional_targets),
    reference_strategy: normalizeNullableString(
      (value as { reference_strategy?: unknown }).reference_strategy,
      700,
    ),
  };
}

export function getAlbumStyleBible(data: unknown) {
  const parsed = AlbumJsonSchema.safeParse(data);
  if (!parsed.success) return EMPTY_STYLE_BIBLE;
  return normalizeStyleBible(parsed.data.style_bible);
}

export function patchAlbumStyleBible(data: unknown, styleBible: unknown) {
  const parsed = AlbumJsonSchema.safeParse(data);
  if (!parsed.success) return null;

  return {
    ...parsed.data,
    style_bible: normalizeStyleBible(styleBible),
  };
}

export function summarizeStyleBible(
  styleBible: Required<AlbumStyleBible>,
  references: AlbumReferenceRecord[] = [],
) {
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
  const score = Math.round((filledCount / totalCount) * 100);
  const referenceRoles = Array.from(
    new Set(
      references
        .map((reference) => reference.targetRole)
        .filter((role): role is string => Boolean(role)),
    ),
  );

  return {
    filledCount,
    totalCount,
    score,
    highlightTags: [...styleBible.vocal_attributes, ...styleBible.sonic_palette].slice(0, 6),
    referenceRoles,
    missingReferenceRoles: CORE_REFERENCE_ROLES.filter((role) => !referenceRoles.includes(role)),
  };
}
