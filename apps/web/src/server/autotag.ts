import { isWrittenLyrics } from "@/lib/lyrics";
import { albumMotifIndex } from "@/lib/motifs";
import { TAG_KINDS, type TagKind, type TrackTagProposal, type TrackTags } from "@/lib/tag-proposals";
import { AlbumJsonSchema, type AlbumJson } from "@/server/album-json";

/** One track's suggestions, each kind ranked album matches first, with the matches named. */
type TrackTagSuggestion = TrackTags & { fromAlbum: TrackTags };

/**
 * Words that carry no subject of their own: articles, pronouns, prepositions, particles,
 * auxiliaries and filler. None of them is ever proposed as a tag or as half of a phrase ("down"
 * is a direction, not a theme; "count down" can only come from the album's own motif).
 */
const FUNCTION_WORDS = new Set(
  (
    "a about above across after again against ah ain all almost along also am among an and any " +
    "are around as at away back be because been before behind being below beneath beside between " +
    "beyond both but by can could did do does doing done down during each even ever every few for " +
    "from get gets getting go goes going gone gonna got had has have having he hey her here hers " +
    "herself him himself his how i if in inside into is it its itself just la let lets like made " +
    "make many may maybe me might mine more most much must my myself na near never next no none " +
    "nor not nothing now oh of off on once one only onto or other our ours ourselves out over own " +
    "please same say says she should so some something still such than that the their theirs them " +
    "themselves then there these they thing things this those though through till to too toward " +
    "towards under until up upon us very was wanna way we well were what whatever when where " +
    "whether which while who whom whose why will with within without would yeah yes yet you your " +
    "yours yourself ooh whoa uh"
  ).split(/\s+/),
);

/** Words an album term can drop when matching lyrics: "the sea" is found by "sea". */
const TERM_FILLER = new Set(["a", "an", "the", "of", "and", "my", "our", "your", "his", "her", "their"]);

/** How close (in words) the words of a two-or-more word term must sit to count as one mention. */
const PHRASE_WINDOW = 6;

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

/** Lower-case words, apostrophes kept inside a word ("keeper's" stays one word). */
function words(text: string): string[] {
  return (text.match(/[A-Za-z]+(?:'[A-Za-z]+)*/g) ?? []).map((word) => word.toLowerCase());
}

/**
 * A plain stem, enough to hear "tides", "counting" and "memories" as "tide", "count" and
 * "memory"; no synonyms ("water" is not "the sea").
 */
export function stem(word: string): string {
  let w = word.toLowerCase().replace(/'s$/, "");
  if (w.length > 4 && w.endsWith("ies")) w = `${w.slice(0, -3)}y`;
  else if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 4 && /(ss|sh|ch|x)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  // "counting" → "count", "tided" → "tid": drop a trailing silent e so both sides agree.
  if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

/** A content word worth tagging: not a function word, at least four letters, no contraction. */
function isContentWord(word: string) {
  return word.length >= 4 && !FUNCTION_WORDS.has(word) && !word.includes("'");
}

/** The words of an album term that a lyric has to contain ("the sea" → ["sea"]). */
function termStems(term: string): string[] {
  const all = words(term);
  const kept = all.filter((word) => !TERM_FILLER.has(word));
  return (kept.length ? kept : all).map(stem);
}

/**
 * Whether the lyrics mention an album term: every word of it (by stem), within a few words of
 * each other for a phrase. "Count it down" mentions "count down"; "a counting house" doesn't.
 */
function mentions(lyricStems: string[], term: string): boolean {
  const needed = termStems(term);
  if (!needed.length) return false;
  if (needed.length === 1) return lyricStems.includes(needed[0]);
  for (let start = 0; start < lyricStems.length; start += 1) {
    if (!needed.includes(lyricStems[start])) continue;
    const window = new Set(lyricStems.slice(start, start + PHRASE_WINDOW));
    if (needed.every((part) => window.has(part))) return true;
  }
  return false;
}

/** The most frequent spelling per stem, and how often the stem occurs. */
function countByStem(tokens: string[]) {
  const map = new Map<string, { count: number; forms: Map<string, number> }>();
  for (const token of tokens) {
    const key = stem(token);
    const entry = map.get(key) ?? { count: 0, forms: new Map<string, number>() };
    entry.count += 1;
    entry.forms.set(token, (entry.forms.get(token) ?? 0) + 1);
    map.set(key, entry);
  }
  return Array.from(map.entries()).map(([key, entry]) => {
    const form = Array.from(entry.forms.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    return { key, form, count: entry.count };
  });
}

function ranked<T extends { count: number; form: string }>(items: T[], min: number, n: number) {
  return items
    .filter((item) => item.count >= min)
    .sort((a, b) => b.count - a.count || a.form.localeCompare(b.form))
    .slice(0, n);
}

/**
 * Two-word phrases that repeat, both words content words, each pair counted once whatever its
 * order ("count down" and "down count" are one phrase, spelt the way it occurs most).
 */
function repeatedPhrases(lines: string[][]) {
  const map = new Map<string, { count: number; forms: Map<string, number> }>();
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i += 1) {
      const a = line[i];
      const b = line[i + 1];
      if (!isContentWord(a) || !isContentWord(b) || stem(a) === stem(b)) continue;
      const key = [stem(a), stem(b)].sort().join(" ");
      const entry = map.get(key) ?? { count: 0, forms: new Map<string, number>() };
      entry.count += 1;
      const form = `${a} ${b}`;
      entry.forms.set(form, (entry.forms.get(form) ?? 0) + 1);
      map.set(key, entry);
    }
  }
  return Array.from(map.entries()).map(([key, entry]) => {
    const form = Array.from(entry.forms.entries()).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0][0];
    return { key, form, count: entry.count };
  });
}

/**
 * Names: capitalised words that aren't at the start of a line or sentence (where every word is
 * capitalised) and aren't function words, repeated at least twice.
 */
function repeatedNames(text: string) {
  const counts = new Map<string, { form: string; count: number }>();
  for (const line of text.split(/\n+/)) {
    const pattern = /[A-Za-z]+(?:'[A-Za-z]+)*/g;
    let match: RegExpExecArray | null;
    let first = true;
    let previousEnd = 0;
    while ((match = pattern.exec(line))) {
      const token = match[0];
      const between = line.slice(previousEnd, match.index);
      const sentenceStart = first || /[.!?]/.test(between);
      previousEnd = match.index + token.length;
      first = false;
      if (sentenceStart || !/^[A-Z][a-z]{2,}$/.test(token)) continue;
      const key = token.toLowerCase();
      if (FUNCTION_WORDS.has(key)) continue;
      const entry = counts.get(key) ?? { form: token, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
  }
  return Array.from(counts.values());
}

type AlbumVocabulary = Record<TagKind, string[]>;

/**
 * The album's own words, which a match is ranked first for and ticked for: its central themes
 * and every theme tag on a track; its motifs (album motifs plus track tags, `lib/motifs`); and
 * every character already named on a track.
 */
function albumVocabulary(album: AlbumJson): AlbumVocabulary {
  return {
    themes: uniqByKey([...album.central_themes, ...album.songs.flatMap((song) => song.themes ?? [])]),
    motifs: uniqByKey(albumMotifIndex(album).map((entry) => entry.name)),
    characters: uniqByKey(album.songs.flatMap((song) => song.characters ?? [])),
  };
}

/** Stems a new proposal mustn't repeat: every word of the album's terms and the track's tags. */
function takenStems(vocabulary: AlbumVocabulary, song: AlbumJson["songs"][number]) {
  const terms = [
    ...TAG_KINDS.flatMap((kind) => vocabulary[kind]),
    ...TAG_KINDS.flatMap((kind) => song[kind] ?? []),
  ];
  return new Set(terms.flatMap(termStems));
}

function suggestTagsFromLyrics(album: AlbumJson): TrackTagSuggestion[] {
  const vocabulary = albumVocabulary(album);

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

      const empty: TrackTags = { trackNumber: song.track_number, themes: [], motifs: [], characters: [] };
      if (!lyrics.trim()) return { ...empty, fromAlbum: { ...empty } };

      const lines = lyrics.split(/\n+/).map(words);
      const lyricStems = lines.flat().map(stem);
      const taken = takenStems(vocabulary, song);

      // 1. The album's own themes, motifs and characters that the lyrics mention.
      const fromAlbum: TrackTags = {
        trackNumber: song.track_number,
        themes: vocabulary.themes.filter((term) => mentions(lyricStems, term)),
        motifs: vocabulary.motifs.filter((term) => mentions(lyricStems, term)),
        characters: vocabulary.characters.filter((term) => mentions(lyricStems, term)),
      };

      // 2. New tags: repeated content words and phrases the album doesn't use yet.
      const content = lines.flat().filter(isContentWord);
      const newThemes = ranked(
        countByStem(content).filter((item) => !taken.has(item.key)),
        3,
        4,
      ).map((item) => item.form);
      const newMotifs = ranked(
        repeatedPhrases(lines).filter((item) => !item.key.split(" ").some((part) => taken.has(part))),
        2,
        3,
      ).map((item) => item.form);
      const motifStems = new Set(newMotifs.flatMap((phrase) => words(phrase).map(stem)));
      const newCharacters = ranked(
        repeatedNames(lyrics).filter((item) => !taken.has(stem(item.form))),
        2,
        4,
      ).map((item) => item.form);

      return {
        trackNumber: song.track_number,
        // A word already inside a new phrase isn't offered again on its own.
        themes: uniqByKey([...fromAlbum.themes, ...newThemes.filter((word) => !motifStems.has(stem(word)))]),
        motifs: uniqByKey([...fromAlbum.motifs, ...newMotifs]),
        characters: uniqByKey([...fromAlbum.characters, ...newCharacters]),
        fromAlbum,
      };
    });
}

const MAX_TAGS_PER_KIND = 32;

/**
 * What "Tag from lyrics" would add, per track, without writing anything: only tags the track
 * doesn't carry yet, only from written lyrics, only tracks with something to add. Each kind
 * lists the album's own themes, motifs and characters the lyrics mention first (`fromAlbum`,
 * the ones the review ticks), then new words and phrases that repeat (left unticked). Null
 * when the album can't be read. `writtenTracks` lets the page say why there's nothing to propose.
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
    const fresh = (kind: TagKind, tags: string[]) => {
      const existing = new Set((song[kind] ?? []).map(normKey));
      return uniqByKey(tags).filter((tag) => !existing.has(normKey(tag)));
    };
    const proposal: TrackTagProposal = {
      trackNumber: suggestion.trackNumber,
      title: song.title,
      themes: fresh("themes", suggestion.themes),
      motifs: fresh("motifs", suggestion.motifs),
      characters: fresh("characters", suggestion.characters),
      fromAlbum: {
        themes: fresh("themes", suggestion.fromAlbum.themes),
        motifs: fresh("motifs", suggestion.fromAlbum.motifs),
        characters: fresh("characters", suggestion.fromAlbum.characters),
      },
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
