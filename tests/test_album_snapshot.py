"""Album snapshot intake: web-app album JSON read into engine models."""

import pytest

from album_conceptualizer.models.snapshot import (
    InvalidSnapshotError,
    album_from_snapshot,
    bible_from_album,
)


def test_lenient_ids_and_section_types():
    album = album_from_snapshot(
        {
            "id": "cuid-not-uuid",
            "title": "Snapshot",
            "songs": [
                {
                    "id": "abc",
                    "title": "One",
                    "track_number": 1,
                    "sections": [
                        {"id": "x", "section_type": "Pre-Chorus", "order": 0},
                        {"section_type": "spoken word", "order": 1},
                        {"section_type": None, "order": 2},
                    ],
                }
            ],
        }
    )
    types = [s.section_type for s in album.songs[0].sections]
    assert types == ["pre_chorus", "other", "other"]


def test_keeps_valid_uuid_ids():
    song_id = "0f8fad5b-d9cb-469f-a165-70867728950e"
    album = album_from_snapshot(
        {"title": "T", "songs": [{"id": song_id, "title": "S", "track_number": 1}]}
    )
    assert str(album.songs[0].id) == song_id


@pytest.mark.parametrize(
    "snapshot",
    [
        None,
        [],
        "album",
        {"songs": []},
        {"title": "T", "songs": ["x"]},
        {"title": "T", "songs": [{"title": "S", "track_number": 1, "sections": [1]}]},
    ],
)
def test_rejects_non_albums(snapshot):
    with pytest.raises(InvalidSnapshotError):
        album_from_snapshot(snapshot)


def test_bible_for_bare_album_has_usable_defaults():
    bible = bible_from_album(album_from_snapshot({"title": "Bare", "songs": []}))
    assert bible.logline == "Bare"
    assert "Bare" in bible.synopsis
    assert bible.style_profile is None
    assert "Album Bible: Bare" in bible.to_summary()


def test_bible_dedupes_themes_case_insensitively():
    album = album_from_snapshot(
        {
            "title": "T",
            "central_themes": ["Memory", "memory ", ""],
            "songs": [{"title": "S", "track_number": 2, "themes": ["MEMORY"]}],
        }
    )
    bible = bible_from_album(album, {"emotional_targets": ["dread"]})
    assert [t.name for t in bible.themes] == ["Memory"]
    assert bible.themes[0].primary_songs == [2]
    assert bible.style_profile is not None
    assert bible.style_profile.primary_genre == "unspecified"
    assert bible.style_profile.vocabulary_notes == "dread"


def _song(**fields):
    return {"title": "S", "track_number": 1, **fields}


@pytest.mark.parametrize(
    ("fields", "attribute"),
    [
        ({"tempo": 0}, "tempo"),
        ({"tempo": -90}, "tempo"),
        ({"duration_seconds": 0}, "duration_seconds"),
        ({"tempo": 120.5}, "tempo"),
        ({"tempo": "fast"}, "tempo"),
        ({"tempo": True}, "tempo"),
    ],
)
def test_out_of_range_song_numbers_are_cleared(fields, attribute):
    album = album_from_snapshot({"title": "T", "songs": [_song(**fields)]})
    assert getattr(album.songs[0], attribute) is None


def test_in_range_numbers_are_kept():
    album = album_from_snapshot(
        {
            "title": "T",
            "release_year": 2100,
            "songs": [
                _song(
                    tempo=120.0,
                    duration_seconds=1,
                    sections=[{"section_type": "verse", "order": 0, "duration_bars": 8}],
                )
            ],
        }
    )
    assert album.release_year == 2100
    assert album.songs[0].tempo == 120
    assert album.songs[0].duration_seconds == 1
    assert album.songs[0].sections[0].duration_bars == 8


def test_zero_duration_bars_is_cleared():
    album = album_from_snapshot(
        {
            "title": "T",
            "songs": [_song(sections=[{"section_type": "verse", "order": 0, "duration_bars": 0}])],
        }
    )
    assert album.songs[0].sections[0].duration_bars is None


@pytest.mark.parametrize("year", [1899, 2101, 0, 12345])
def test_release_year_outside_range_is_cleared(year):
    assert album_from_snapshot({"title": "T", "release_year": year}).release_year is None


@pytest.mark.parametrize("value", [None, "not a date", 42])
def test_unreadable_timestamps_fall_back_to_defaults(value):
    album = album_from_snapshot({"title": "T", "created_at": value, "updated_at": value})
    assert album.created_at is not None
    assert album.updated_at is not None


def test_valid_timestamps_are_kept():
    album = album_from_snapshot({"title": "T", "created_at": "2024-05-01T12:00:00Z"})
    assert album.created_at.year == 2024


def test_null_lists_and_null_items_are_read_as_empty():
    album = album_from_snapshot(
        {
            "title": "T",
            "central_themes": None,
            "secondary_genres": None,
            "recurring_motifs": ["foghorn", None],
            "reference_albums": None,
            "visual_inspiration": None,
            "songs": [
                _song(
                    themes=None,
                    motifs=None,
                    characters=[None, "Keeper"],
                    genre_tags=None,
                    mood_tags=None,
                    reference_tracks=None,
                    instrumentation=None,
                    sections=[{"section_type": "verse", "order": 0, "chord_progression": None}],
                )
            ],
        }
    )
    assert album.central_themes == []
    assert album.recurring_motifs == ["foghorn"]
    song = album.songs[0]
    assert song.themes == [] and song.instrumentation == []
    assert song.characters == ["Keeper"]
    assert song.sections[0].chord_progression == []
