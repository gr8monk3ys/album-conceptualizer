"""UI helper utilities for album state management."""

from __future__ import annotations

from album_conceptualizer.models.album import Album, Section, SectionType, Song


def parse_track_names(raw_names: str) -> list[str]:
    if not raw_names:
        return []
    normalized = raw_names.replace(",", "\n")
    return [name.strip() for name in normalized.splitlines() if name.strip()]


def section_type_to_label(section_type: str) -> str:
    section_map = {
        "intro": "Intro",
        "verse": "Verse 1",
        "pre_chorus": "Pre-Chorus",
        "chorus": "Chorus",
        "post_chorus": "Chorus 2",
        "bridge": "Bridge",
        "breakdown": "Bridge",
        "solo": "Solo",
        "interlude": "Solo",
        "outro": "Outro",
        "tag": "Final Chorus",
        "other": "Verse 1",
    }
    return section_map.get(section_type, "Verse 1")


def section_label_to_type(section_label: str) -> SectionType:
    section_map = {
        "Intro": SectionType.INTRO,
        "Verse 1": SectionType.VERSE,
        "Verse 2": SectionType.VERSE,
        "Verse 3": SectionType.VERSE,
        "Pre-Chorus": SectionType.PRE_CHORUS,
        "Chorus": SectionType.CHORUS,
        "Chorus 2": SectionType.POST_CHORUS,
        "Bridge": SectionType.BRIDGE,
        "Solo": SectionType.SOLO,
        "Final Chorus": SectionType.CHORUS,
        "Outro": SectionType.OUTRO,
    }
    return section_map.get(section_label, SectionType.VERSE)


def build_tracklist_rows(album: Album) -> list[list[object]]:
    rows: list[list[object]] = []
    for song in album.songs:
        rows.append(
            [
                song.track_number,
                song.title,
                song.key or "",
                song.tempo or "",
                song.narrative_position or "",
            ]
        )
    return rows


def merge_album_with_tracklist(
    album_json: str,
    album_title: str,
    artist_name: str,
    concept_summary: str,
    tracklist_rows: list[list[object]] | None,
) -> Album:
    existing = Album.model_validate_json(album_json) if album_json else Album(title=album_title)
    songs_by_title = {song.title: song for song in existing.songs}
    songs: list[Song] = []

    if tracklist_rows:
        for row in tracklist_rows:
            if not row or len(row) < 2:
                continue
            title = str(row[1]).strip() if row[1] is not None else ""
            if not title:
                continue
            try:
                track_no = int(row[0]) if row[0] not in (None, "") else len(songs) + 1
            except (TypeError, ValueError):
                track_no = len(songs) + 1
            track_no = max(1, track_no)
            key = str(row[2]).strip() if len(row) > 2 and row[2] else None
            tempo = None
            if len(row) > 3 and row[3] not in (None, ""):
                try:
                    tempo = int(row[3])
                except (TypeError, ValueError):
                    tempo = None
            if tempo is not None and tempo <= 0:
                tempo = None
            narrative = str(row[4]).strip() if len(row) > 4 and row[4] else None

            if title in songs_by_title:
                song = songs_by_title[title]
                song.track_number = track_no
                song.key = key or song.key
                song.tempo = tempo or song.tempo
                song.narrative_position = narrative or song.narrative_position
            else:
                song = Song(
                    title=title,
                    track_number=track_no,
                    key=key,
                    tempo=tempo,
                    narrative_position=narrative,
                )
            songs.append(song)

    if not songs:
        songs = existing.songs

    return Album(
        title=album_title or existing.title or "Untitled Album",
        artist=artist_name or existing.artist,
        concept_summary=concept_summary or existing.concept_summary,
        songs=songs,
    )


def update_album_from_song_editor(
    album_json: str,
    selected_title: str | None,
    song_title: str,
    track_number: int,
    song_key: str,
    song_tempo: int,
    time_signature: str,
    narrative_position: str,
    narrative_summary: str,
    section_label: str,
    lyrics: str,
) -> tuple[str, list[list[object]], list[str]]:
    album = Album.model_validate_json(album_json) if album_json else Album(title="Untitled Album")
    target_title = selected_title or song_title
    if not target_title:
        return album_json, build_tracklist_rows(album), [song.title for song in album.songs]

    song = album.get_song_by_title(target_title)
    if not song:
        song = Song(title=target_title, track_number=track_number or 1)
        album.songs.append(song)

    song.title = song_title or song.title
    if track_number and track_number > 0:
        song.track_number = track_number
    song.key = song_key or song.key
    if song_tempo and song_tempo > 0:
        song.tempo = song_tempo
    song.time_signature = time_signature or song.time_signature
    song.narrative_position = narrative_position or song.narrative_position
    song.narrative_summary = narrative_summary or song.narrative_summary

    if lyrics:
        song.sections = [
            Section(
                section_type=section_label_to_type(section_label),
                order=1,
                lyrics=lyrics,
            )
        ]

    album.songs.sort(key=lambda s: s.track_number)
    return (
        album.model_dump_json(indent=2),
        build_tracklist_rows(album),
        [song.title for song in album.songs],
    )


def generate_review_pass(album: Album) -> tuple[list[str], list[str]]:
    warnings: list[str] = []
    lines: list[str] = []

    if not album.songs:
        warnings.append("Album has no songs.")
        return lines, warnings

    tempos = [song.tempo for song in album.songs if song.tempo]
    keys = [song.key for song in album.songs if song.key]
    narrative_positions = [
        song.narrative_position for song in album.songs if song.narrative_position
    ]
    motifs = [motif for song in album.songs for motif in song.motifs]

    if len(tempos) < max(1, len(album.songs) // 2):
        warnings.append("Many songs are missing tempo values.")
    if len(keys) < max(1, len(album.songs) // 2):
        warnings.append("Many songs are missing key signatures.")
    if len(narrative_positions) < max(1, len(album.songs) // 2):
        warnings.append("Many songs are missing narrative positions.")
    if not motifs:
        warnings.append("No motifs found across songs.")

    if tempos:
        min_tempo = min(tempos)
        max_tempo = max(tempos)
        lines.append(f"- Tempo range: {min_tempo}-{max_tempo} BPM")
        if max_tempo - min_tempo > 50:
            warnings.append("Tempo range is wide; consider tighter pacing.")

    if keys:
        unique_keys = sorted({key for key in keys if key})
        lines.append(f"- Keys used: {', '.join(unique_keys)}")
        if len(unique_keys) > max(4, len(album.songs) // 2):
            warnings.append("Many unique keys; consider a tighter key palette.")

    if narrative_positions:
        unique_positions = sorted({pos for pos in narrative_positions if pos})
        lines.append(f"- Narrative positions covered: {', '.join(unique_positions)}")

    if motifs:
        motif_counts: dict[str, int] = {}
        for motif in motifs:
            motif_counts[motif] = motif_counts.get(motif, 0) + 1
        top_motifs = sorted(motif_counts.items(), key=lambda item: item[1], reverse=True)[:5]
        if top_motifs:
            lines.append(
                "- Top motifs: "
                + ", ".join(f"{name} ({count})" for name, count in top_motifs)
            )
            if all(count == 1 for _, count in top_motifs):
                warnings.append("Motifs appear only once; consider repeating key motifs.")

    return lines, warnings
