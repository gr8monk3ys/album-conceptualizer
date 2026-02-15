import type { AlbumBible, BibleTrack } from "@/server/bible";

export type MotifCharacterEdge = {
  character: string;
  motif: string;
  weight: number;
  trackNumbers: number[];
};

export type MotifCharacterGraph = {
  characters: Array<{ name: string; trackNumbers: number[] }>;
  motifs: Array<{ name: string; trackNumbers: number[] }>;
  edges: MotifCharacterEdge[];
};

function normKey(value: string) {
  return value.trim().toLowerCase();
}

function uniqTrackNumbers(values: Iterable<number>) {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function indexByKey(values: Array<{ name: string }>) {
  const map = new Map<string, string>();
  for (const v of values) {
    const key = normKey(v.name);
    if (!key) continue;
    if (!map.has(key)) map.set(key, v.name.trim());
  }
  return map;
}

function extractTrackTokens(track: BibleTrack) {
  const characters = (track.characters ?? []).map((c) => c.trim()).filter(Boolean);
  const motifs = (track.motifs ?? []).map((m) => m.trim()).filter(Boolean);
  return { characters, motifs };
}

export function buildMotifCharacterGraph(
  bible: AlbumBible,
  opts?: {
    maxCharacters?: number;
    maxMotifs?: number;
    minEdgeWeight?: number;
  },
): MotifCharacterGraph {
  const maxCharacters = opts?.maxCharacters ?? 12;
  const maxMotifs = opts?.maxMotifs ?? 12;
  const minEdgeWeight = opts?.minEdgeWeight ?? 1;

  const characters = bible.characterIndex.slice(0, maxCharacters);
  const motifs = bible.motifIndex.slice(0, maxMotifs);

  const characterLabelByKey = indexByKey(characters);
  const motifLabelByKey = indexByKey(motifs);

  const allowCharacterKeys = new Set(Array.from(characterLabelByKey.keys()));
  const allowMotifKeys = new Set(Array.from(motifLabelByKey.keys()));

  const edgeMap = new Map<
    string,
    { characterKey: string; motifKey: string; trackNumbers: Set<number> }
  >();

  for (const track of bible.tracks) {
    const { characters: trackCharacters, motifs: trackMotifs } = extractTrackTokens(track);
    if (!trackCharacters.length || !trackMotifs.length) continue;

    const characterKeys = Array.from(
      new Set(trackCharacters.map((c) => normKey(c)).filter((k) => allowCharacterKeys.has(k))),
    );
    const motifKeys = Array.from(
      new Set(trackMotifs.map((m) => normKey(m)).filter((k) => allowMotifKeys.has(k))),
    );

    if (!characterKeys.length || !motifKeys.length) continue;

    for (const ck of characterKeys) {
      for (const mk of motifKeys) {
        const key = `${ck}::${mk}`;
        const existing = edgeMap.get(key);
        if (existing) existing.trackNumbers.add(track.trackNumber);
        else edgeMap.set(key, { characterKey: ck, motifKey: mk, trackNumbers: new Set([track.trackNumber]) });
      }
    }
  }

  const edges: MotifCharacterEdge[] = Array.from(edgeMap.values())
    .map((row) => {
      const character = characterLabelByKey.get(row.characterKey) ?? row.characterKey;
      const motif = motifLabelByKey.get(row.motifKey) ?? row.motifKey;
      const trackNumbers = uniqTrackNumbers(row.trackNumbers);
      return { character, motif, weight: trackNumbers.length, trackNumbers };
    })
    .filter((edge) => edge.weight >= minEdgeWeight)
    .sort((a, b) => b.weight - a.weight || a.character.localeCompare(b.character) || a.motif.localeCompare(b.motif));

  return { characters, motifs, edges };
}

