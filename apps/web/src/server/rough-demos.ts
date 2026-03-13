import { randomUUID } from "node:crypto";

import { AlbumJsonSchema } from "@/server/album-json";

export type AlbumRoughDemoRecord = {
  id: string;
  title: string;
  source_kind: string;
  song_track_number: number | null;
  external_url: string | null;
  capture_notes: string | null;
  sonic_traits: string[];
  lyrical_fragments: string[];
  next_actions: string[];
  local_file: {
    name: string;
    size_bytes: number | null;
    mime_type: string | null;
    duration_seconds: number | null;
  } | null;
  created_at: string;
  updated_at: string;
};

const SOURCE_KIND_LABELS: Record<string, string> = {
  "voice-memo": "Voice memo",
  "phone-demo": "Phone demo",
  rehearsal: "Rehearsal",
  "riff-sketch": "Riff sketch",
  "acoustic-pass": "Acoustic pass",
  "hook-sketch": "Hook sketch",
};

function normalizeText(value: unknown, limit: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, limit) : null;
}

function normalizeList(value: unknown, limit = 12) {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const items: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string") continue;
    const token = raw.trim();
    if (!token) continue;
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(token);
    if (items.length >= limit) break;
  }
  return items;
}

function normalizePositiveInt(value: unknown, max: number) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= max
    ? value
    : null;
}

function normalizeSourceKind(value: unknown) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalized || "voice-memo";
}

function normalizeLocalFile(value: unknown) {
  if (!value || typeof value !== "object") return null;

  const name = normalizeText((value as { name?: unknown }).name, 255);
  if (!name) return null;

  return {
    name,
    size_bytes: normalizePositiveInt((value as { size_bytes?: unknown }).size_bytes, 250_000_000),
    mime_type: normalizeText((value as { mime_type?: unknown }).mime_type, 120),
    duration_seconds: normalizePositiveInt(
      (value as { duration_seconds?: unknown }).duration_seconds,
      86_400,
    ),
  };
}

export function normalizeRoughDemo(value: unknown): AlbumRoughDemoRecord {
  const source = value && typeof value === "object" ? value : {};
  const now = new Date().toISOString();

  return {
    id:
      typeof (source as { id?: unknown }).id === "string" && (source as { id?: string }).id?.trim()
        ? (source as { id: string }).id.trim()
        : randomUUID(),
    title: normalizeText((source as { title?: unknown }).title, 200) ?? "Untitled demo",
    source_kind: normalizeSourceKind((source as { source_kind?: unknown }).source_kind),
    song_track_number: normalizePositiveInt(
      (source as { song_track_number?: unknown }).song_track_number,
      512,
    ),
    external_url: normalizeText((source as { external_url?: unknown }).external_url, 500),
    capture_notes: normalizeText((source as { capture_notes?: unknown }).capture_notes, 1500),
    sonic_traits: normalizeList((source as { sonic_traits?: unknown }).sonic_traits),
    lyrical_fragments: normalizeList((source as { lyrical_fragments?: unknown }).lyrical_fragments),
    next_actions: normalizeList((source as { next_actions?: unknown }).next_actions),
    local_file: normalizeLocalFile((source as { local_file?: unknown }).local_file),
    created_at: normalizeText((source as { created_at?: unknown }).created_at, 64) ?? now,
    updated_at: normalizeText((source as { updated_at?: unknown }).updated_at, 64) ?? now,
  };
}

export function listAlbumRoughDemos(data: unknown) {
  const parsed = AlbumJsonSchema.safeParse(data);
  if (!parsed.success) return [] as AlbumRoughDemoRecord[];

  return (parsed.data.rough_demos ?? [])
    .map((demo) => normalizeRoughDemo(demo))
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

export function patchAlbumRoughDemos(
  data: unknown,
  updater: (current: AlbumRoughDemoRecord[]) => AlbumRoughDemoRecord[],
) {
  const parsed = AlbumJsonSchema.safeParse(data);
  if (!parsed.success) return null;

  const current = listAlbumRoughDemos(parsed.data);
  const next = updater(current).map((demo) => normalizeRoughDemo(demo));

  return {
    ...parsed.data,
    rough_demos: next,
  };
}

export function getRoughDemoSourceLabel(sourceKind: string) {
  return SOURCE_KIND_LABELS[sourceKind] ?? sourceKind;
}

export function summarizeRoughDemos(demos: AlbumRoughDemoRecord[]) {
  const targeted = demos.filter((demo) => demo.song_track_number).length;
  const localImports = demos.filter((demo) => demo.local_file).length;
  const sourceKinds = Array.from(new Set(demos.map((demo) => demo.source_kind))).slice(0, 4);
  const nextActionCount = demos.reduce((count, demo) => count + demo.next_actions.length, 0);

  return {
    count: demos.length,
    targeted,
    localImports,
    sourceKinds,
    nextActionCount,
    latestTitle: demos[0]?.title ?? null,
  };
}
