"""Extended tests for UI helper utilities."""

from album_conceptualizer.models.album import Album, Section, SectionType, Song
from album_conceptualizer.ui.helpers import (
    generate_review_pass,
    merge_album_with_tracklist,
    normalize_tracklist_rows,
    parse_track_names,
    section_label_to_type,
    section_type_to_label,
    update_album_from_song_editor,
)


class TestNormalizeTracklistRows:
    def test_none_returns_empty(self):
        assert normalize_tracklist_rows(None) == []

    def test_list_of_lists_returned_as_is(self):
        rows = [[1, "Song A", "G", 120, "opening"], [2, "Song B", "C", 100, "ending"]]
        result = normalize_tracklist_rows(rows)
        assert result == rows

    def test_list_of_tuples_converted_to_lists(self):
        rows = [(1, "Song A", "G"), (2, "Song B", "C")]
        result = normalize_tracklist_rows(rows)
        assert result == [[1, "Song A", "G"], [2, "Song B", "C"]]

    def test_list_with_scalar_items(self):
        rows = ["item1", "item2"]
        result = normalize_tracklist_rows(rows)
        assert result == [["item1"], ["item2"]]

    def test_string_returns_empty(self):
        # str is Iterable but explicitly excluded
        assert normalize_tracklist_rows("not a list") == []

    def test_bytes_returns_empty(self):
        assert normalize_tracklist_rows(b"bytes") == []

    def test_integer_returns_empty(self):
        assert normalize_tracklist_rows(42) == []

    def test_generator_converted(self):
        def gen():
            yield [1, "A"]
            yield [2, "B"]

        result = normalize_tracklist_rows(gen())
        assert result == [[1, "A"], [2, "B"]]

    def test_pandas_like_object_with_values_tolist(self):
        """Objects with .values.tolist() (e.g. pandas DataFrames) should work."""

        class FakeValues:
            def tolist(self):
                return [[1, "Song", "G"]]

        class FakeDF:
            values = FakeValues()

        result = normalize_tracklist_rows(FakeDF())
        assert result == [[1, "Song", "G"]]


class TestParseTrackNames:
    def test_empty_string_returns_empty_list(self):
        assert parse_track_names("") == []

    def test_newline_separated(self):
        assert parse_track_names("Song A\nSong B\nSong C") == ["Song A", "Song B", "Song C"]

    def test_comma_separated(self):
        assert parse_track_names("Song A,Song B") == ["Song A", "Song B"]

    def test_strips_whitespace(self):
        assert parse_track_names("  Song A  \n  Song B  ") == ["Song A", "Song B"]


class TestSectionTypeHelpers:
    def test_section_type_to_label_known_types(self):
        assert section_type_to_label("intro") == "Intro"
        assert section_type_to_label("verse") == "Verse 1"
        assert section_type_to_label("chorus") == "Chorus"
        assert section_type_to_label("bridge") == "Bridge"
        assert section_type_to_label("outro") == "Outro"

    def test_section_type_to_label_unknown_defaults_verse(self):
        assert section_type_to_label("unknown_section") == "Verse 1"

    def test_section_label_to_type_known_labels(self):
        assert section_label_to_type("Intro") == SectionType.INTRO
        assert section_label_to_type("Chorus") == SectionType.CHORUS
        assert section_label_to_type("Bridge") == SectionType.BRIDGE
        assert section_label_to_type("Outro") == SectionType.OUTRO

    def test_section_label_to_type_unknown_defaults_verse(self):
        assert section_label_to_type("Unknown Label") == SectionType.VERSE


class TestMergeAlbumWithTracklist:
    def test_creates_album_from_tracklist_rows(self):
        rows = [[1, "Opening", "G major", 120, "intro"]]
        album = merge_album_with_tracklist("", "New Album", "Artist", "A story", rows)
        assert album.title == "New Album"
        assert album.artist == "Artist"
        assert len(album.songs) == 1
        assert album.songs[0].title == "Opening"
        assert album.songs[0].key == "G major"
        assert album.songs[0].tempo == 120

    def test_updates_existing_song_metadata(self):
        existing = Album(
            title="Album",
            songs=[Song(title="My Song", track_number=1, key=None, tempo=None)],
        )
        rows = [[1, "My Song", "D major", 100, "closing"]]
        album = merge_album_with_tracklist(existing.model_dump_json(), "Album", "Artist", "", rows)
        assert album.songs[0].key == "D major"
        assert album.songs[0].tempo == 100

    def test_empty_tracklist_preserves_existing_songs(self):
        existing = Album(
            title="Album",
            songs=[Song(title="Preserved", track_number=1)],
        )
        album = merge_album_with_tracklist(existing.model_dump_json(), "Album", "Artist", "", [])
        assert len(album.songs) == 1
        assert album.songs[0].title == "Preserved"

    def test_none_tracklist_preserves_existing_songs(self):
        existing = Album(
            title="Album",
            songs=[Song(title="Preserved", track_number=1)],
        )
        album = merge_album_with_tracklist(existing.model_dump_json(), "Album", "Artist", "", None)
        assert len(album.songs) == 1

    def test_rows_with_no_title_are_skipped(self):
        rows = [[1, None, "", "", ""], [2, "", "", "", ""]]
        album = merge_album_with_tracklist("", "Album", "Artist", "", rows)
        assert len(album.songs) == 0

    def test_bad_track_number_defaults_to_sequence(self):
        rows = [["bad", "Song A", "", "", ""], ["", "Song B", "", "", ""]]
        album = merge_album_with_tracklist("", "Album", "Artist", "", rows)
        assert len(album.songs) == 2

    def test_zero_tempo_becomes_none(self):
        rows = [[1, "Song", "G", 0, ""]]
        album = merge_album_with_tracklist("", "Album", "Artist", "", rows)
        assert album.songs[0].tempo is None

    def test_negative_tempo_becomes_none(self):
        rows = [[1, "Song", "G", -10, ""]]
        album = merge_album_with_tracklist("", "Album", "Artist", "", rows)
        assert album.songs[0].tempo is None

    def test_empty_album_json_creates_fresh_album(self):
        album = merge_album_with_tracklist("", "Fresh Album", "Artist", "", None)
        assert album.title == "Fresh Album"

    def test_new_song_created_when_not_in_existing(self):
        existing = Album(title="Album", songs=[])
        rows = [[1, "Brand New", "C", 90, "opening"]]
        album = merge_album_with_tracklist(existing.model_dump_json(), "Album", "Artist", "", rows)
        assert album.songs[0].title == "Brand New"


class TestUpdateAlbumFromSongEditor:
    def _album_json(self, songs=None):
        album = Album(
            title="Test Album",
            songs=songs or [Song(title="Existing Song", track_number=1)],
        )
        return album.model_dump_json()

    def test_creates_new_song_when_not_found(self):
        _, _, titles = update_album_from_song_editor(
            self._album_json(),
            None,
            "Brand New",
            2,
            "G",
            140,
            "4/4",
            "opening",
            "Start",
            "Verse 1",
            "Hello",
        )
        assert "Brand New" in titles

    def test_updates_existing_song(self):
        updated_json, _rows, _titles = update_album_from_song_editor(
            self._album_json(),
            "Existing Song",
            "Existing Song",
            1,
            "A minor",
            90,
            "4/4",
            "midpoint",
            "Middle part",
            "Chorus",
            "New lyrics",
        )
        updated = Album.model_validate_json(updated_json)
        song = updated.get_song_by_title("Existing Song")
        assert song is not None
        assert song.key == "A minor"
        assert song.tempo == 90

    def test_empty_target_returns_unchanged(self):
        album_json = self._album_json()
        result_json, _rows, _titles = update_album_from_song_editor(
            album_json, None, "", 1, "", 0, "", "", "", "Verse 1", ""
        )
        assert result_json == album_json

    def test_lyrics_updates_sections(self):
        updated_json, _, _ = update_album_from_song_editor(
            self._album_json(),
            "Existing Song",
            "Existing Song",
            1,
            "",
            0,
            "",
            "",
            "",
            "Chorus",
            "New chorus lyrics",
        )
        updated = Album.model_validate_json(updated_json)
        song = updated.get_song_by_title("Existing Song")
        assert song.sections[0].lyrics == "New chorus lyrics"
        assert song.sections[0].section_type == SectionType.CHORUS

    def test_no_lyrics_preserves_existing_sections(self):
        existing_section = Section(
            section_type=SectionType.VERSE, order=1, lyrics="Original lyrics"
        )
        album = Album(
            title="Test",
            songs=[Song(title="With Sections", track_number=1, sections=[existing_section])],
        )
        updated_json, _, _ = update_album_from_song_editor(
            album.model_dump_json(),
            "With Sections",
            "With Sections",
            1,
            "",
            0,
            "",
            "",
            "",
            "Chorus",
            "",  # empty lyrics → sections not replaced
        )
        updated = Album.model_validate_json(updated_json)
        assert updated.songs[0].sections[0].lyrics == "Original lyrics"

    def test_songs_sorted_by_track_number(self):
        album = Album(
            title="Test",
            songs=[
                Song(title="Track 3", track_number=3),
                Song(title="Track 1", track_number=1),
            ],
        )
        updated_json, _rows, _ = update_album_from_song_editor(
            album.model_dump_json(), "Track 3", "Track 3", 3, "", 0, "", "", "", "Verse 1", ""
        )
        updated = Album.model_validate_json(updated_json)
        assert updated.songs[0].track_number < updated.songs[1].track_number

    def test_build_tracklist_rows_returned(self):
        _, rows, _ = update_album_from_song_editor(
            self._album_json(),
            "Existing Song",
            "Existing Song",
            1,
            "G",
            120,
            "4/4",
            "opening",
            "Summary",
            "Verse 1",
            "",
        )
        assert isinstance(rows, list)
        assert len(rows) == 1


class TestGenerateReviewPass:
    def test_empty_album_returns_warning(self):
        album = Album(title="Empty")
        lines, warnings = generate_review_pass(album)
        assert any("no songs" in w.lower() for w in warnings)
        assert lines == []

    def test_complete_album_generates_summary_lines(self):
        album = Album(
            title="Full Album",
            songs=[
                Song(
                    title=f"Song {i}",
                    track_number=i + 1,
                    tempo=120 + i * 5,
                    key="G major",
                    narrative_position="opening",
                )
                for i in range(4)
            ],
        )
        lines, _ = generate_review_pass(album)
        assert any("Tempo range" in l for l in lines)
        assert any("Keys used" in l for l in lines)

    def test_missing_tempo_warning(self):
        album = Album(
            title="No Tempos",
            songs=[Song(title=f"Song {i}", track_number=i + 1) for i in range(4)],
        )
        _, warnings = generate_review_pass(album)
        assert any("tempo" in w.lower() for w in warnings)

    def test_missing_keys_warning(self):
        album = Album(
            title="No Keys",
            songs=[Song(title=f"Song {i}", track_number=i + 1, tempo=120) for i in range(4)],
        )
        _, warnings = generate_review_pass(album)
        assert any("key" in w.lower() for w in warnings)

    def test_wide_tempo_range_warning(self):
        album = Album(
            title="Wide Tempos",
            songs=[
                Song(title="Slow", track_number=1, tempo=60),
                Song(title="Fast", track_number=2, tempo=180),
            ],
        )
        _, warnings = generate_review_pass(album)
        assert any("wide" in w.lower() for w in warnings)

    def test_no_motifs_warning(self):
        album = Album(
            title="No Motifs",
            songs=[Song(title="Song", track_number=1, tempo=120, key="C major")],
        )
        _, warnings = generate_review_pass(album)
        assert any("motif" in w.lower() for w in warnings)

    def test_motifs_appear_in_summary(self):
        album = Album(
            title="With Motifs",
            songs=[
                Song(
                    title="Song 1",
                    track_number=1,
                    tempo=120,
                    key="C major",
                    motifs=["hope", "loss"],
                ),
                Song(
                    title="Song 2",
                    track_number=2,
                    tempo=130,
                    key="C major",
                    motifs=["hope"],
                ),
            ],
        )
        lines, _ = generate_review_pass(album)
        assert any("motif" in l.lower() for l in lines)

    def test_motifs_appearing_once_triggers_warning(self):
        album = Album(
            title="Singleton Motifs",
            songs=[
                Song(title="Song", track_number=1, tempo=120, key="C", motifs=["hope"]),
            ],
        )
        _, warnings = generate_review_pass(album)
        assert any("motif" in w.lower() for w in warnings)

    def test_narrative_positions_in_summary(self):
        album = Album(
            title="With Narrative",
            songs=[
                Song(
                    title="Opening", track_number=1, tempo=120, key="C", narrative_position="intro"
                ),
                Song(
                    title="Closing", track_number=2, tempo=120, key="C", narrative_position="outro"
                ),
            ],
        )
        lines, _ = generate_review_pass(album)
        assert any("Narrative" in l for l in lines)

    def test_many_unique_keys_warning(self):
        keys = ["C major", "D major", "E major", "F major", "G major", "A major"]
        album = Album(
            title="Key Salad",
            songs=[
                Song(title=f"Song {i}", track_number=i + 1, tempo=120, key=k)
                for i, k in enumerate(keys)
            ],
        )
        _, warnings = generate_review_pass(album)
        assert any("key" in w.lower() for w in warnings)
