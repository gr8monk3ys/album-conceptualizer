// "Tag from lyrics" proposes tags; the artist accepts them before anything is written. These
// are the shapes the proposal and the apply share (server route and Bible client alike), and
// the one sentence that says what was added.

import { andList } from "@/lib/and-list";

export type TagKind = "themes" | "motifs" | "characters";

export const TAG_KINDS: TagKind[] = ["themes", "motifs", "characters"];

/** Tags for one track, by kind. */
export type TrackTags = {
  trackNumber: number;
  themes: string[];
  motifs: string[];
  characters: string[];
};

/**
 * Tags the lyrics suggest for one track, none of them on the track already, each kind ranked
 * with the album's own words first. `fromAlbum` names the ones that are the album's central
 * themes, motifs or characters mentioned in the lyrics: the review ticks only those, and marks
 * every other proposal "New tag", unticked.
 */
export type TrackTagProposal = TrackTags & { title: string; fromAlbum: Record<TagKind, string[]> };

/** Whether a proposed tag is one of the album's own words (so the review ticks it). */
export function isAlbumMatch(proposal: TrackTagProposal, kind: TagKind, tag: string): boolean {
  const key = tag.trim().toLowerCase();
  return proposal.fromAlbum[kind].some((match) => match.trim().toLowerCase() === key);
}

/** How many tags, over every track and kind. */
export function countTags(tracks: readonly TrackTags[]): number {
  return tracks.reduce((sum, track) => sum + TAG_KINDS.reduce((n, kind) => n + track[kind].length, 0), 0);
}

function pad(trackNumber: number) {
  return String(trackNumber).padStart(2, "0");
}

/** Above this many tags the sentence counts them instead of naming each one. */
const NAMED_TAGS = 6;

/**
 * What was added, named: "Added tide to 04, signal and static to 05." Past six tags it counts
 * them: "Added 12 tags on tracks 04, 05 and 07."
 */
export function describeAddedTags(tracks: readonly TrackTags[]): string {
  const touched = tracks
    .filter((track) => TAG_KINDS.some((kind) => track[kind].length))
    .slice()
    .sort((left, right) => left.trackNumber - right.trackNumber);
  const total = countTags(touched);
  if (!total) return "No tags were added: every one is already on its track.";
  if (total > NAMED_TAGS) {
    const numbers = andList(touched.map((track) => pad(track.trackNumber)));
    return `Added ${total} tags on ${touched.length === 1 ? "track" : "tracks"} ${numbers}.`;
  }
  const parts = touched.map(
    (track) => `${andList(TAG_KINDS.flatMap((kind) => track[kind]))} to ${pad(track.trackNumber)}`,
  );
  return `Added ${parts.join(", ")}.`;
}
