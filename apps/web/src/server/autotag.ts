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
      const lyrics = (song.sections ?? [])
        .map((s) => (typeof s.lyrics === "string" ? s.lyrics : ""))
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

export function applyAutoTagsFromLyrics(data: unknown): AlbumJson | null {
  const parsed = AlbumJsonSchema.safeParse(data);
  if (!parsed.success) return null;

  const album = parsed.data;
  const suggestions = suggestTagsFromLyrics(album);
  const byTrack = new Map<number, TrackTagSuggestion>();
  for (const s of suggestions) byTrack.set(s.trackNumber, s);

  const updated: AlbumJson = {
    ...album,
    updated_at: new Date().toISOString(),
    songs: album.songs.map((song) => {
      const suggestion = byTrack.get(song.track_number);
      if (!suggestion) return song;

      const existingThemes = Array.isArray(song.themes) ? song.themes : [];
      const existingMotifs = Array.isArray(song.motifs) ? song.motifs : [];
      const existingCharacters = Array.isArray(song.characters) ? song.characters : [];

      const mergedThemes = uniqByKey([...existingThemes, ...suggestion.themes]).slice(0, 32);
      const mergedMotifs = uniqByKey([...existingMotifs, ...suggestion.motifs]).slice(0, 32);
      const mergedCharacters = uniqByKey([...existingCharacters, ...suggestion.characters]).slice(0, 32);

      return {
        ...song,
        themes: mergedThemes,
        motifs: mergedMotifs,
        characters: mergedCharacters,
      };
    }),
  };

  return updated;
}
