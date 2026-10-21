import { describe, expect, it } from "vitest";

import { sameAlbumDetailsProps } from "@/components/studio/album-details";
import { sameSongStoryProps } from "@/components/studio/song-story-editor";
import { buildNewSong, unreadableChordsOnAlbum, type StudioAlbum, type StudioSong } from "@/components/studio/studio-model";
import { sameTrackListProps, sameTrackRow } from "@/components/studio/track-list";
import { sameKeys } from "@/components/studio/use-stable-event";

function withLyrics(song: StudioSong, lyrics: string): StudioSong {
  return { ...song, sections: song.sections.map((section, i) => (i === 0 ? { ...section, lyrics } : section)) };
}

const noop = () => {};

describe("sameKeys", () => {
  it("compares the named keys by identity", () => {
    const themes = ["tide"];
    expect(sameKeys({ a: 1, themes }, { a: 1, themes }, ["a", "themes"])).toBe(true);
    expect(sameKeys({ a: 1, themes }, { a: 1, themes: ["tide"] }, ["a", "themes"])).toBe(false);
    expect(sameKeys({ a: 1, b: 2 }, { a: 1, b: 3 }, ["a"])).toBe(true);
  });
});

describe("sameTrackRow", () => {
  const song = buildNewSong(1);

  it("ignores lyric keystrokes that don't change whether a section is written", () => {
    const typing = withLyrics(song, "Sirens");
    expect(sameTrackRow(withLyrics(song, "Siren"), typing)).toBe(true);
  });

  it("redraws when a section becomes written, or the row's own fields change", () => {
    expect(sameTrackRow(song, withLyrics(song, "Sirens practise on a Tuesday"))).toBe(false);
    expect(sameTrackRow(song, { ...song, title: "Storm Warning" })).toBe(false);
    expect(sameTrackRow(song, { ...song, themes: ["tide"] })).toBe(false);
    expect(sameTrackRow(song, { ...song, narrative_position: "Opening" })).toBe(false);
    expect(sameTrackRow(song, undefined)).toBe(false);
  });
});

describe("sameTrackListProps", () => {
  const songs = [buildNewSong(1), buildNewSong(2)];
  const base = {
    songs,
    centralThemes: [],
    activeIndex: 0,
    onSelect: noop,
    onToggleTheme: noop,
    onAddTrack: noop,
    onAddThemes: noop,
    open: false,
    onOpenChange: noop,
  };

  it("skips a render while the lyrics are typed", () => {
    const typed = [withLyrics(songs[0]!, "Sire"), songs[1]!];
    const more = [withLyrics(songs[0]!, "Siren"), songs[1]!];
    expect(sameTrackListProps({ ...base, songs: typed }, { ...base, songs: more })).toBe(true);
  });

  it("renders for a new selection, a new callback or a track added", () => {
    expect(sameTrackListProps(base, { ...base, activeIndex: 1 })).toBe(false);
    expect(sameTrackListProps(base, { ...base, onSelect: () => {} })).toBe(false);
    expect(sameTrackListProps(base, { ...base, songs: [...songs, buildNewSong(3)] })).toBe(false);
  });
});

describe("sameSongStoryProps and sameAlbumDetailsProps", () => {
  it("skip lyric keystrokes and follow the fields they show", () => {
    const song = buildNewSong(1);
    const story = { song, albumThemes: [], albumMotifs: [], onChange: noop, open: false, onOpenChange: noop };
    expect(sameSongStoryProps(story, { ...story, song: withLyrics(song, "Words") })).toBe(true);
    expect(sameSongStoryProps(story, { ...story, song: { ...song, motifs: ["bell"] } })).toBe(false);
    expect(sameSongStoryProps(story, { ...story, open: true })).toBe(false);

    const album = { title: "Lighthouse", songs: [song] } as unknown as StudioAlbum;
    const details = { album, onChange: noop, open: false, onOpenChange: noop };
    expect(sameAlbumDetailsProps(details, { ...details, album: { ...album, songs: [withLyrics(song, "Words")] } })).toBe(true);
    expect(sameAlbumDetailsProps(details, { ...details, album: { ...album, title: "Lighthouse II" } })).toBe(false);
  });
});

describe("unreadableChordsOnAlbum (cached per chord array)", () => {
  it("follows a changed progression and keeps the count while only lyrics change", () => {
    const chords = ["Am", "Fx", "C"];
    const song = { sections: [{ chord_progression: chords, lyrics: "a" }] };
    expect(unreadableChordsOnAlbum([song]).count).toBe(1);
    // Same array, new section object (a lyric keystroke): same count.
    const typed = { sections: [{ chord_progression: chords, lyrics: "ab" }] };
    expect(unreadableChordsOnAlbum([typed]).count).toBe(1);
    // A new array (the chords were edited) is read again.
    expect(unreadableChordsOnAlbum([{ sections: [{ chord_progression: ["Am", "F", "C"] }] }]).count).toBe(0);
    expect(unreadableChordsOnAlbum([{ sections: [{ chord_progression: ["Qq", "Zz"] }] }]).count).toBe(2);
  });
});
