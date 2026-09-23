import { isWrittenLyrics } from "@/lib/lyrics";
import { TAG_KINDS, type TrackTagProposal, type TrackTags } from "@/lib/tag-proposals";
import { AlbumJsonSchema, type AlbumJson } from "@/server/album-json";

type TrackTagSuggestion = {
  trackNumber: number;
  themes: string[];
  motifs: string[];
  characters: string[];
};

const STOPWORDS = new Set(
  [
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "but",
    "by",
    "for",
    "from",
    "has",
    "have",
    "he",
    "her",
    "hers",
    "him",
    "his",
    "i",
    "if",
    "in",
    "into",
    "is",
    "it",
    "its",
    "me",
    "my",
    "no",
    "not",
    "of",
    "on",
    "or",
    "our",
    "ours",
    "she",
    "so",
    "than",
    "that",
    "the",
    "their",
    "them",
    "then",
    "there",
    "these",
    "they",
    "this",
    "to",
    "too",
    "up",
    "us",
    "was",
    "we",
    "were",
    "what",
    "when",
    "where",
    "who",
    "why",
    "with",
    "you",
    "your",
    "yours",
  ].map((w) => w.toLowerCase()),
);

function normKey(value: string) {
  return value.trim().toLowerCase();
}

function uniqByKey(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = normKey(v);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v.trim());
  }
  return out;
}

function tokenizeWords(text: string): string[] {
  const matches = text.match(/[A-Za-z][A-Za-z']{2,}/g) ?? [];
  return matches.map((m) => m.toLowerCase());
}

function countTokens(tokens: string[]) {
  const map = new Map<string, number>();
  for (const t of tokens) map.set(t, (map.get(t) ?? 0) + 1);
  return map;
}

function topN(map: Map<string, number>, n: number) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n);
}

function extractBigrams(tokens: string[]) {
  const map = new Map<string, number>();
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const a = tokens[i] ?? "";
    const b = tokens[i + 1] ?? "";
    if (!a || !b) continue;
    if (STOPWORDS.has(a) || STOPWORDS.has(b)) continue;
    const key = `${a} ${b}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

function extractCharacters(lyrics: string) {
  const matches = lyrics.match(/\b[A-Z][a-z]{2,}\b/g) ?? [];
  const map = new Map<string, number>();
  for (const token of matches) {
    const key = normKey(token);
    if (!key || key === "i") continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

function suggestTagsFromLyrics(data: unknown): TrackTagSuggestion[] {
  const parsed = AlbumJsonSchema.safeParse(data);
  if (!parsed.success) return [];

  const album = parsed.data;
  const centralThemes = Array.isArray(album.central_themes) ? album.central_themes : [];
  const recurringMotifs = Array.isArray(album.recurring_motifs) ? album.recurring_motifs : [];

  return album.songs
    .slice()
    .sort((a, b) => a.track_number - b.track_number)
    .map((song) => {
      // Only lyrics the artist wrote: "[Verse line 1]" placeholders would tag every track
      // with "verse" and "line" (`@/lib/lyrics` owns what counts as written).
      const lyrics = (song.sections ?? [])
        .map((s) => (isWrittenLyrics(s.lyrics) ? String(s.lyrics).replace(/\[[^\]]*\]/g, " ") : ""))
        .filter(Boolean)
        .join("\n");

      if (!lyrics.trim()) {
        return { trackNumber: song.track_number, themes: [], motifs: [], characters: [] };
      }

      const words = tokenizeWords(lyrics).filter((w) => !STOPWORDS.has(w));
      const wordCounts = countTokens(words);
      const themes = topN(wordCounts, 6)
        .filter(([, count]) => count >= 3)
        .map(([w]) => w);

      // Promote album-level themes/motifs if they appear literally in lyrics.
      const lowerLyrics = lyrics.toLowerCase();
      const literalThemes = centralThemes
        .map((t) => String(t).trim())
        .filter(Boolean)
        .filter((t) => lowerLyrics.includes(t.toLowerCase()));
      const literalMotifs = recurringMotifs
        .map((m) => String(m).trim())
        .filter(Boolean)
        .filter((m) => lowerLyrics.includes(m.toLowerCase()));

      const bigramCounts = extractBigrams(tokenizeWords(lyrics));
      const motifs = topN(bigramCounts, 5)
        .filter(([, count]) => count >= 2)
        .map(([phrase]) => phrase);

      const characterCounts = extractCharacters(lyrics);
      const characters = topN(characterCounts, 6)
        .filter(([, count]) => count >= 2)
        .map(([name]) => name);

      return {
        trackNumber: song.track_number,
        themes: uniqByKey([...literalThemes, ...themes]).slice(0, 10),
        motifs: uniqByKey([...literalMotifs, ...motifs]).slice(0, 10),
        characters: uniqByKey(characters).slice(0, 10),
      };
    });
}

const MAX_TAGS_PER_KIND = 32;

/**
 * What "Tag from lyrics" would add, per track, without writing anything: only tags the track
 * doesn't carry yet, only from written lyrics, only tracks with something to add. Null when
 * the album can't be read. `writtenTracks` lets the page say why there's nothing to propose.
 */
export function proposeTagsFromLyrics(
  data: unknown,
): { proposals: TrackTagProposal[]; writtenTracks: number } | null {
  const parsed = AlbumJsonSchema.safeParse(data);
  if (!parsed.success) return null;
  const album = parsed.data;
  const byTrack = new Map(album.songs.map((song) => [song.track_number, song] as const));
  const writtenTracks = album.songs.filter((song) => song.sections.some((section) => isWrittenLyrics(section.lyrics))).length;

  const proposals: TrackTagProposal[] = [];
  for (const suggestion of suggestTagsFromLyrics(album)) {
    const song = byTrack.get(suggestion.trackNumber);
    if (!song) continue;
    const fresh = (kind: (typeof TAG_KINDS)[number]) => {
      const existing = new Set((song[kind] ?? []).map(normKey));
      return uniqByKey(suggestion[kind]).filter((tag) => !existing.has(normKey(tag)));
    };
    const proposal: TrackTagProposal = {
      trackNumber: suggestion.trackNumber,
      title: song.title,
      themes: fresh("themes"),
      motifs: fresh("motifs"),
      characters: fresh("characters"),
    };
    if (TAG_KINDS.some((kind) => proposal[kind].length)) proposals.push(proposal);
  }
  return { proposals, writtenTracks };
}

/**
 * Add the tags the artist accepted. Returns the album and exactly what was added (tags a track
 * already carries, or tracks that no longer exist, are left out), so the confirmation can name
 * it. Null when the album can't be read.
 */
export function applyAcceptedTags(
  data: unknown,
  accepted: readonly TrackTags[],
): { album: AlbumJson; added: TrackTags[] } | null {
  const parsed = AlbumJsonSchema.safeParse(data);
  if (!parsed.success) return null;
  const album = parsed.data;

  const acceptedByTrack = new Map<number, TrackTags>();
  for (const entry of accepted) {
    const current = acceptedByTrack.get(entry.trackNumber);
    acceptedByTrack.set(entry.trackNumber, {
      trackNumber: entry.trackNumber,
      themes: [...(current?.themes ?? []), ...entry.themes],
      motifs: [...(current?.motifs ?? []), ...entry.motifs],
      characters: [...(current?.characters ?? []), ...entry.characters],
    });
  }

  const added: TrackTags[] = [];
  const songs = album.songs.map((song) => {
    const entry = acceptedByTrack.get(song.track_number);
    if (!entry) return song;
    const next = { ...song };
    const addedHere: TrackTags = { trackNumber: song.track_number, themes: [], motifs: [], characters: [] };
    for (const kind of TAG_KINDS) {
      const existing = Array.isArray(song[kind]) ? song[kind] : [];
      const seen = new Set(existing.map(normKey));
      const room = Math.max(0, MAX_TAGS_PER_KIND - existing.length);
      const fresh = uniqByKey(entry[kind]).filter((tag) => !seen.has(normKey(tag))).slice(0, room);
      next[kind] = [...existing, ...fresh];
      addedHere[kind] = fresh;
    }
    if (TAG_KINDS.some((kind) => addedHere[kind].length)) added.push(addedHere);
    return next;
  });

  return { album: { ...album, songs }, added: added.sort((left, right) => left.trackNumber - right.trackNumber) };
}
