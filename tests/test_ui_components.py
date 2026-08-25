"""Tests for the legacy Gradio UI component builders.

``album_conceptualizer.ui.components`` requires the optional ``ui`` extra
(gradio). It is skipped automatically when gradio is not installed, matching
the pattern used by ``tests/test_ui_smoke.py``.
"""

import pytest


gr = pytest.importorskip("gradio")

from album_conceptualizer.ui import components  # noqa: E402


def _assert_all_components(built: dict, expected_keys: set[str]) -> None:
    """Assert *built* has exactly *expected_keys* and each value is a Gradio component."""
    assert set(built.keys()) == expected_keys
    for name, value in built.items():
        assert isinstance(value, gr.components.Component), (name, type(value))


class TestCreateAlbumCanvas:
    def test_returns_expected_components(self):
        with gr.Blocks():
            built = components.create_album_canvas()

        _assert_all_components(
            built,
            {
                "album_title",
                "artist_name",
                "concept_summary",
                "primary_genre",
                "era_influence",
                "tracklist_display",
                "add_song_btn",
                "remove_song_btn",
                "reorder_btn",
                "arc_visualization",
                "themes_list",
                "motifs_list",
                "references",
            },
        )
        assert isinstance(built["album_title"], gr.Textbox)
        assert isinstance(built["primary_genre"], gr.Dropdown)
        assert isinstance(built["tracklist_display"], gr.Dataframe)
        assert isinstance(built["add_song_btn"], gr.Button)


class TestCreateSongEditor:
    def test_returns_expected_components(self):
        with gr.Blocks():
            built = components.create_song_editor()

        _assert_all_components(
            built,
            {
                "song_selector",
                "song_title_edit",
                "track_number",
                "song_key",
                "song_tempo",
                "time_signature",
                "narrative_position",
                "narrative_summary",
                "section_selector",
                "lyrics_editor",
                "ai_prompt",
                "ai_assist_btn",
                "ai_suggestions",
                "chord_input",
                "chord_analysis",
                "structure_editor",
                "add_section_btn",
                "section_type_select",
                "instrumentation",
                "production_notes",
                "reference_tracks",
            },
        )
        assert isinstance(built["song_tempo"], gr.Slider)
        assert isinstance(built["track_number"], gr.Number)
        assert isinstance(built["instrumentation"], gr.CheckboxGroup)


class TestCreateAlbumBibleEditor:
    def test_returns_expected_components(self):
        with gr.Blocks():
            built = components.create_album_bible_editor()

        _assert_all_components(
            built,
            {
                "logline",
                "synopsis",
                "setting",
                "characters_table",
                "themes_table",
                "structure_type",
                "structure_beats",
                "style_genre",
                "style_references",
                "lyrical_voice",
                "motifs_table",
                "save_bible_btn",
                "load_bible_btn",
                "export_bible_btn",
                "ai_expand_btn",
            },
        )
        assert isinstance(built["motifs_table"], gr.Dataframe)
        assert isinstance(built["save_bible_btn"], gr.Button)


class TestCreateChordPalette:
    def test_returns_expected_components(self):
        with gr.Blocks():
            built = components.create_chord_palette()

        _assert_all_components(
            built,
            {
                "key_root",
                "key_mode",
                "diatonic_display",
                "progression_input",
                "analysis_output",
                "analyze_btn",
                "suggest_btn",
                "export_midi_btn",
            },
        )
        assert isinstance(built["key_root"], gr.Dropdown)
        assert isinstance(built["diatonic_display"], gr.Dataframe)


class TestCreateExportPanel:
    def test_returns_expected_components(self):
        with gr.Blocks():
            built = components.create_export_panel()

        _assert_all_components(
            built,
            {
                "format_midi",
                "format_chordpro",
                "format_musicxml",
                "format_json",
                "format_text",
                "export_all_songs",
                "song_select",
                "include_production",
                "preview_output",
                "preview_btn",
                "export_btn",
                "download_output",
                "status_output",
            },
        )
        assert isinstance(built["format_midi"], gr.Checkbox)
        assert isinstance(built["download_output"], gr.File)


class TestCreateExperiencePanel:
    def test_returns_expected_components(self):
        with gr.Blocks():
            built = components.create_experience_panel()

        # This panel is the largest surface (gamification, remix, DAW handoff,
        # realtime rooms); assert the count and a representative sample of
        # keys from each sub-section rather than the full 39-key set.
        assert len(built) == 39
        for key in (
            "pack_id",
            "jam_btn",
            "remix_create_btn",
            "remix_vote_score",
            "daw_targets",
            "daw_generate_btn",
            "realtime_room_id",
            "realtime_build_btn",
            "output",
            "remix_output",
            "daw_output",
            "realtime_output",
        ):
            assert key in built
            assert isinstance(built[key], gr.components.Component)

    def test_all_values_are_gradio_components(self):
        with gr.Blocks():
            built = components.create_experience_panel()

        assert all(isinstance(v, gr.components.Component) for v in built.values())
