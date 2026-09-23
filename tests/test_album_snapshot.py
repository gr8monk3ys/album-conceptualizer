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
