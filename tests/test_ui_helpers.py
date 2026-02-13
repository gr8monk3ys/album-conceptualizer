import pytest

from album_conceptualizer.models.album import Album, Section, SectionType, Song
from album_conceptualizer.ui import helpers


def test_section_type_label_roundtrip():
    assert helpers.section_type_to_label("verse") == "Verse 1"
    assert helpers.section_type_to_label("chorus") == "Chorus"
    assert helpers.section_label_to_type("Chorus 2") == SectionType.POST_CHORUS
    assert helpers.section_label_to_type("Outro") == SectionType.OUTRO


def test_parse_track_names():
    raw = "Track A, Track B\nTrack C"
    assert helpers.parse_track_names(raw) == ["Track A", "Track B", "Track C"]


def test_merge_album_preserves_sections():
    song = Song(
        title="Intro",
        track_number=1,
        key="C",
        tempo=100,
        sections=[Section(section_type=SectionType.VERSE, order=1, lyrics="Hello")],
    )
    album = Album(title="Test", songs=[song])
    album_json = album.model_dump_json()

    rows = [[1, "Intro", "D", 120, "Opening/Exposition"]]
    merged = helpers.merge_album_with_tracklist(
        album_json=album_json,
        album_title="Test",
        artist_name="",
        concept_summary="",
        tracklist_rows=rows,
    )

    assert merged.songs[0].key == "D"
    assert merged.songs[0].tempo == 120
    assert merged.songs[0].sections[0].lyrics == "Hello"


def test_update_album_from_song_editor_sets_lyrics():
    song = Song(title="Song 1", track_number=1)
    album = Album(title="Test", songs=[song])
    album_json = album.model_dump_json()

    updated_json, _, _ = helpers.update_album_from_song_editor(
        album_json=album_json,
        selected_title="Song 1",
        song_title="Song 1",
        track_number=1,
        song_key="A minor",
        song_tempo=90,
        time_signature="4/4",
        narrative_position="Opening/Exposition",
        narrative_summary="Start",
        section_label="Verse 1",
        lyrics="Line 1",
    )

    updated = Album.model_validate_json(updated_json)
    updated_song = updated.get_song_by_title("Song 1")
    assert updated_song is not None
    assert updated_song.key == "A minor"
    assert updated_song.tempo == 90
    assert updated_song.sections[0].lyrics == "Line 1"


def test_generate_review_pass_warnings():
    album = Album(title="Empty", songs=[Song(title="S1", track_number=1)])
    _lines, warnings = helpers.generate_review_pass(album)
    assert warnings
    assert "missing" in " ".join(warnings).lower()


def test_merge_album_accepts_dataframe_rows():
    pd = pytest.importorskip("pandas")

    song = Song(title="Intro", track_number=1, key="C")
    album = Album(title="Test", songs=[song])
    album_json = album.model_dump_json()
    frame = pd.DataFrame([[1, "Intro", "D", 120, "Opening/Exposition"]])

    merged = helpers.merge_album_with_tracklist(
        album_json=album_json,
        album_title="Test",
        artist_name="",
        concept_summary="",
        tracklist_rows=frame,
    )

    assert merged.songs[0].title == "Intro"
    assert merged.songs[0].key == "D"
