import type { Prisma } from "@prisma/client";

import { AlbumJsonSchema, type AlbumJson, type AlbumStyleBible } from "@/server/album-json";
import { buildAlbumMutationData } from "@/server/album-sync";
import { ApiError } from "@/server/api-error";
import { chargeCredits, CREDIT_COSTS } from "@/server/credits";
import { getPrisma } from "@/server/db";
import { notifyAlbumOwnerQuietly } from "@/server/notify";
import { enforceProjectLimit, type Plan } from "@/server/plan";

function newId() {
  return crypto.randomUUID();
}

// A Remix copies what the album shows others, never the owner's working material: rough demos
// (capture notes, private links, file names), section notes, production notes and any keys the
// schema only passes through are left behind. Each level is built from an allowlist, so a field
// added to the snapshot later stays private until it is named here.

const ALBUM_FIELDS = [
  "concept_summary",
  "narrative_structure",
  "primary_genre",
  "secondary_genres",
  "era_influence",
  "release_year",
  "central_themes",
  "recurring_motifs",
  "reference_albums",
  "visual_inspiration",
] as const satisfies ReadonlyArray<keyof AlbumJson>;

const STYLE_BIBLE_FIELDS = [
  "lead_voice",
  "narrator_perspective",
  "vocal_attributes",
  "sonic_palette",
  "arrangement_rules",
  "mix_priorities",
  "avoid_list",
  "emotional_targets",
  "reference_strategy",
] as const satisfies ReadonlyArray<keyof AlbumStyleBible>;

type ForkSong = AlbumJson["songs"][number];
type ForkSection = ForkSong["sections"][number];

const SONG_FIELDS = [
  "duration_estimate",
  "duration_seconds",
  "key",
  "tempo",
  "time_signature",
  "narrative_position",
  "narrative_summary",
  "chronological_order",
  "themes",
  "motifs",
  "characters",
  "genre_tags",
  "mood_tags",
  "reference_tracks",
  "instrumentation",
] as const satisfies ReadonlyArray<keyof ForkSong>;

const SECTION_FIELDS = [
  "lyrics",
  "chord_progression",
  "duration_bars",
  "narrative_function",
  "emotional_arc",
  "key",
  "tempo_modifier",
  "dynamics",
] as const satisfies ReadonlyArray<keyof ForkSection>;

/** The named fields of `source` that are set, and nothing else. */
function pick<T extends object, K extends keyof T>(source: T, fields: ReadonlyArray<K>): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const field of fields) {
    if (source[field] !== undefined) out[field] = source[field];
  }
  return out;
}

const TITLE_LIMIT = 200;

function titleKey(title: string) {
  return title.trim().toLowerCase();
}

/**
 * The remix's title. It keeps the original's title as it is: the catalog line already says
 * "Remix of <title> by <artist>", so a "(Remix)" suffix only has to be renamed away. Only when
 * the workspace it lands in already has an album of that name (the owner remixing their own
 * album, or a second remix of the same one) is it told apart: "<title> (Remix)", then
 * "<title> (Remix 2)", and so on, compared trimmed and in any casing.
 */
export function remixTitle(sourceTitle: string, takenTitles: Iterable<string> = []): string {
  const base = sourceTitle.trim().slice(0, TITLE_LIMIT) || "Untitled album";
  const taken = new Set(Array.from(takenTitles, titleKey));
  if (!taken.has(titleKey(base))) return base;
  for (let n = 1; ; n += 1) {
    const suffix = n === 1 ? " (Remix)" : ` (Remix ${n})`;
    const candidate = `${base.slice(0, TITLE_LIMIT - suffix.length).trimEnd()}${suffix}`;
    if (!taken.has(titleKey(candidate))) return candidate;
  }
}

export function forkAlbumJson(
  album: AlbumJson,
  opts?: {
    /** The remix's title (see `remixTitle`); the original's title when left out. */
    title?: string;
    /**
     * Who is making the remix. Their copy is credited to them (or to no one, when their name
     * isn't known); the original artist is kept in `remixed_from`, never in `artist`.
     */
    remixerName?: string | null;
    /** The database id of the album being remixed, so the remix can link back to it. */
    sourceAlbumId?: string | null;
  },
): AlbumJson {
  const now = new Date().toISOString();
  const remixer = opts?.remixerName?.trim().slice(0, 200) || null;

  return {
    ...pick(album, ALBUM_FIELDS),
    id: newId(),
    title: (opts?.title ?? album.title).trim().slice(0, TITLE_LIMIT),
    artist: remixer,
    // Provenance: which album this remix started from, so the original artist's authorship
    // stays visible on the remix (the release header links "Remix of <title> by <artist>" to
    // the original on Discover while it is published). `album_id` is the original's database
    // id, the one in its Discover address. Plain strings only, so it stays JSON-safe; the
    // album schema passes unknown keys through.
    remixed_from: {
      album_id: opts?.sourceAlbumId || null,
      title: album.title,
      artist: typeof album.artist === "string" && album.artist.trim() ? album.artist.trim() : null,
    },
    created_at: now,
    updated_at: now,
    // The owner's demos (notes, links, file names) are theirs; a remix starts with none.
    rough_demos: [],
    ...(album.style_bible ? { style_bible: pick(album.style_bible, STYLE_BIBLE_FIELDS) } : {}),
    songs: album.songs.map((song) => ({
      ...pick(song, SONG_FIELDS),
      id: newId(),
      title: song.title,
      track_number: song.track_number,
      sections: song.sections.map((section) => ({
        ...pick(section, SECTION_FIELDS),
        id: newId(),
        section_type: section.section_type,
        order: section.order,
      })),
    })),
  };
}

/**
 * Fork a published or shared album snapshot into the caller's workspace: charge the fork,
 * enforce the free plan's project limit, and create the album with a first version, all in
 * one transaction. Then the original's owner is told who remixed it. Returns the new album's id.
 */
export async function forkIntoWorkspace(input: {
  source: unknown;
  /** The database id of the album being remixed: recorded in `remixed_from`, and its owner is notified. */
  sourceAlbumId: string;
  workspaceId: string;
  plan: Plan;
  userId: string;
  versionMessage: string;
  creditMetadata: Prisma.InputJsonValue;
}): Promise<string> {
  const parsed = AlbumJsonSchema.safeParse(input.source);
  if (!parsed.success) throw new ApiError(422, "This album can't be remixed because its data is invalid.");

  const created = await getPrisma().$transaction(async (tx) => {
    const remixer = await tx.user.findUnique({
      where: { id: input.userId },
      select: { name: true },
    });
    // Only albums whose title could clash: the source's title with or without a suffix.
    const sameName = await tx.album.findMany({
      where: {
        workspaceId: input.workspaceId,
        title: { startsWith: parsed.data.title.trim(), mode: "insensitive" },
      },
      select: { title: true },
    });
    const forked = forkAlbumJson(parsed.data, {
      title: remixTitle(
        parsed.data.title,
        sameName.map((album) => album.title),
      ),
      remixerName: remixer?.name ?? null,
      sourceAlbumId: input.sourceAlbumId,
    });
    await chargeCredits(tx, {
      workspaceId: input.workspaceId,
      plan: input.plan,
      amount: CREDIT_COSTS.albumFork,
      reason: "album_create_remix",
      metadata: input.creditMetadata,
      insufficientMessage: "Not enough credits to remix. Complete a challenge or upgrade your plan.",
    });
    await enforceProjectLimit(tx, input.workspaceId, input.plan);
    const album = await tx.album.create({
      data: { workspaceId: input.workspaceId, ...buildAlbumMutationData(forked) },
      select: { id: true },
    });
    await tx.albumVersion.create({
      data: {
        albumId: album.id,
        createdByUserId: input.userId,
        message: input.versionMessage,
        data: forked as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    return album;
  });
  // After the commit: a failed notification never undoes a remix that was paid for.
  await notifyAlbumOwnerQuietly(getPrisma(), {
    albumId: input.sourceAlbumId,
    actorUserId: input.userId,
    kind: "remix",
    remixAlbumId: created.id,
  });
  return created.id;
}
