"""Main Gradio application for Album Conceptualizer."""

import csv
import json
import shutil
import zipfile
from contextlib import suppress
from datetime import datetime
from pathlib import Path
from statistics import median
from typing import Any, cast
from uuid import uuid4

import gradio as gr

from album_conceptualizer.export.formats import AlbumExporter, ExportFormat
from album_conceptualizer.models.album import Album, Section, SectionType, Song
from album_conceptualizer.models.album_bible import (
    AlbumBible,
    Character,
    Motif,
    NarrativeArc,
    StyleProfile,
    Theme,
)
from album_conceptualizer.telemetry import Events, disable_telemetry, enable_telemetry, track
from album_conceptualizer.ui import helpers
from album_conceptualizer.ui.components import (
    create_album_bible_editor,
    create_album_canvas,
    create_chord_palette,
    create_experience_panel,
    create_export_panel,
    create_song_editor,
)


GradioUpdate = dict[str, Any]


def create_app(
    share: bool = False,
    debug: bool = False,
) -> gr.Blocks:
    """
    Create the main Gradio application.

    Args:
        share: Whether to create a public share link
        debug: Whether to enable debug mode

    Returns:
        Configured Gradio Blocks application
    """
    # Application state

    with gr.Blocks(
        title="Album Conceptualizer",
    ) as app:
        # Header
        gr.Markdown(
            """
            # Album Conceptualizer
            ### RAG-powered concept album ideation system

            Create cohesive concept albums with AI-assisted lyrics, chord progressions,
            and narrative structure. Export to MIDI, ChordPro, and MusicXML.
            """
        )

        # Main tabs
        album_state = gr.State(value="")
        bible_state = gr.State(value="")
        experience_remix_state = gr.State(value="")

        with gr.Tabs():
            # Tab 0: Quick Start
            with gr.Tab("Quick Start", id="quickstart"):
                quickstart_components = _create_quickstart_tab()

            # Tab 1: Album Canvas (Overview)
            with gr.Tab("Album Canvas", id="canvas"):
                album_components = create_album_canvas()

            # Tab 2: Album Bible
            with gr.Tab("Album Bible", id="bible"):
                bible_components = create_album_bible_editor()

            # Tab 3: Song Editor
            with gr.Tab("Song Editor", id="editor"):
                song_components = create_song_editor()

            # Tab 4: Chord Tools
            with gr.Tab("Chord Tools", id="chords"):
                create_chord_palette()

            # Tab 5: Export
            with gr.Tab("Export", id="export"):
                export_components = create_export_panel()

            # Tab 6: Experience Toolkit
            with gr.Tab("Experience", id="experience"):
                experience_components = create_experience_panel()

            # Tab 7: AI Agents
            with gr.Tab("AI Agents", id="agents"):
                agent_components = _create_agents_tab()

        # Footer
        gr.Markdown(
            """
            ---
            *Album Conceptualizer* | [GitHub](https://github.com/gr8monk3ys/album-conceptualizer) |
            Built with CrewAI, LangChain, and Gradio
            """
        )

        _bind_quickstart_actions(
            quickstart_components,
            album_components,
            song_components,
            bible_components,
            export_components,
            experience_components,
            agent_components,
            album_state,
            bible_state,
            experience_remix_state,
        )

    return cast("gr.Blocks", app)


def _create_agents_tab() -> dict:
    """Create the AI Agents tab content."""
    components: dict[str, gr.Component] = {}
    gr.Markdown(
        """
        ## AI-Powered Album Creation

        Use specialized AI agents to help develop your concept album.
        Each agent has a specific role and expertise.
        """
    )

    with gr.Row():
        with gr.Column(scale=1):
            gr.Markdown(
                """
                ### Available Agents

                **Album Director**
                - Oversees creative vision
                - Resolves conflicts between specialists
                - Makes final decisions

                **Lyricist**
                - Crafts emotionally resonant lyrics
                - Maintains narrative coherence
                - Develops recurring motifs

                **Music Theorist**
                - Suggests chord progressions
                - Ensures harmonic coherence
                - Creates musical motifs

                **Narrative Specialist**
                - Validates story structure
                - Tracks character arcs
                - Ensures thematic threading

                **Style Matcher**
                - Maintains sonic identity
                - Analyzes reference material
                - Provides production notes
                """
            )

        with gr.Column(scale=2):
            with gr.Group():
                gr.Markdown("### Run Agent Workflow")

                workflow_type = gr.Dropdown(
                    choices=[
                        "Album Vision Development",
                        "Song Development",
                        "Coherence Review",
                        "Custom Task",
                    ],
                    value="Album Vision Development",
                    label="Workflow Type",
                )

                with gr.Accordion("Workflow Parameters", open=True):
                    concept_input = gr.Textbox(
                        label="Album Concept",
                        placeholder="Describe your album concept...",
                        lines=3,
                    )

                    references_input = gr.Textbox(
                        label="Reference Artists/Albums",
                        placeholder="e.g., Pink Floyd, Radiohead, Kendrick Lamar...",
                        lines=2,
                    )

                    themes_input = gr.Textbox(
                        label="Key Themes",
                        placeholder="e.g., identity, loss, redemption...",
                    )

                    track_count = gr.Slider(
                        minimum=5,
                        maximum=20,
                        value=10,
                        step=1,
                        label="Target Track Count",
                    )
                    components["seed_input"] = gr.Number(
                        label="Seed (optional)",
                        value=None,
                        precision=0,
                    )

                run_button = gr.Button("Run Workflow", variant="primary")
                retry_button = gr.Button("Retry", variant="secondary")

                output_area = gr.Textbox(
                    label="Agent Output",
                    lines=15,
                    interactive=False,
                )

                # Progress indicator
                progress = gr.Textbox(
                    label="Status",
                    value="Ready",
                    interactive=False,
                )

                retry_state = gr.State(value={})

            # Event handlers
            def run_workflow(
                workflow: str,
                concept: str,
                references: str,
                themes: str,
                tracks: int,
                seed: int | float | None,
            ) -> tuple[str, str, dict]:
                """Run the selected agent workflow."""
                if not concept:
                    return "Please provide an album concept.", "Error", {}

                seed_value = None
                if seed is not None:
                    try:
                        seed_value = int(seed)
                    except (TypeError, ValueError):
                        seed_value = None
                try:
                    from album_conceptualizer.agents.crew import create_album_ideation_crew

                    crew = create_album_ideation_crew(
                        concept=concept,
                        references=references,
                        themes=themes or "Not specified",
                        track_count=tracks,
                        seed=seed_value,
                    )
                    result = crew.kickoff()
                    output_text = f"""
## Workflow: {workflow}

### Input Analysis
- **Concept:** {concept}
- **References:** {references}
- **Themes:** {themes}
- **Target Tracks:** {tracks}
- **Seed:** {seed_value if seed_value is not None else "None"}

### Agent Output
{result}

*Note: This run used the album ideation crew as the default workflow.*
"""
                    status = "Complete"
                except Exception as exc:
                    output_text = f"""
## Workflow: {workflow}

### Input Analysis
- **Concept:** {concept}
- **References:** {references}
- **Themes:** {themes}
- **Target Tracks:** {tracks}
- **Seed:** {seed_value if seed_value is not None else "None"}

### Agent Output
AI workflow failed to run: {exc}

**Tip:** Ensure AI dependencies and API keys are configured.
"""
                    status = "Error"

                return (
                    output_text,
                    status,
                    {
                        "workflow": workflow,
                        "concept": concept,
                        "references": references,
                        "themes": themes,
                        "tracks": tracks,
                        "seed": seed_value,
                    },
                )

            run_button.click(
                fn=run_workflow,
                inputs=[
                    workflow_type,
                    concept_input,
                    references_input,
                    themes_input,
                    track_count,
                    components["seed_input"],
                ],
                outputs=[output_area, progress, retry_state],
            )

            def retry_workflow(state: dict) -> tuple[str, str, dict]:
                if not state:
                    return "Nothing to retry yet.", "Idle", {}
                return run_workflow(
                    state.get("workflow", ""),
                    state.get("concept", ""),
                    state.get("references", ""),
                    state.get("themes", ""),
                    state.get("tracks", 10),
                    state.get("seed"),
                )

            retry_button.click(
                fn=retry_workflow,
                inputs=[retry_state],
                outputs=[output_area, progress, retry_state],
            )

    return components


def _create_quickstart_tab() -> dict:
    """Create a guided quick-start flow for generating a starter album JSON."""
    components: dict[str, gr.Component] = {}
    gr.Markdown(
        """
        ## Quick Start

        Generate a starter album JSON in a few steps. This creates a clean, editable project
        you can open in the CLI or use as a baseline for exports.
        """
    )

    with gr.Row():
        with gr.Column(scale=1), gr.Group():
            components["album_title"] = gr.Textbox(
                label="Album Title",
                placeholder="e.g., The Last Summer",
            )
            components["artist"] = gr.Textbox(
                label="Artist",
                placeholder="e.g., The Storytellers",
            )
            components["concept"] = gr.Textbox(
                label="Concept Summary",
                placeholder="One or two sentences about the album concept...",
                lines=4,
            )
            components["track_count"] = gr.Slider(
                minimum=4,
                maximum=20,
                value=10,
                step=1,
                label="Track Count",
            )
            components["track_names"] = gr.Textbox(
                label="Track Names (optional)",
                placeholder="One per line or comma-separated",
                lines=6,
            )

            components["generate_btn"] = gr.Button("Generate album.json", variant="primary")

            with gr.Group():
                gr.Markdown("### Project Settings")
                components["project_dir"] = gr.Textbox(
                    label="Project Folder",
                    placeholder="output/projects/album_title",
                )
                components["seed"] = gr.Number(
                    label="Seed",
                    value=42,
                    precision=0,
                )
                components["telemetry_enabled"] = gr.Checkbox(
                    label="Enable telemetry (opt-in)",
                    value=False,
                )
                components["autosave_enabled"] = gr.Checkbox(
                    label="Autosave on edit",
                    value=True,
                )
                with gr.Row():
                    components["save_project_btn"] = gr.Button("Save Project")
                    components["save_version_btn"] = gr.Button("Save Version")
                components["load_file"] = gr.File(
                    label="Load album.json",
                    file_count="single",
                    file_types=[".json"],
                )
                components["load_btn"] = gr.Button("Load Project")

            components["status"] = gr.Textbox(
                label="Status",
                interactive=False,
            )

        with gr.Column(scale=1), gr.Group():
            gr.Markdown("### Generated Output")
            components["output_file"] = gr.File(
                label="album.json",
                visible=True,
            )
            components["preview"] = gr.Textbox(
                label="Preview",
                lines=18,
                interactive=False,
            )
    return components


def _parse_track_names(raw_names: str) -> list[str]:
    return helpers.parse_track_names(raw_names)


def _track_event(event_type: str, properties: dict[str, object] | None = None) -> None:
    with suppress(Exception):
        track(event_type, properties or {})


def _status_with_time(message: str) -> str:
    timestamp = datetime.now().strftime("%H:%M:%S")
    return f"{message} ({timestamp})"


def _section_type_to_label(section_type: str) -> str:
    return helpers.section_type_to_label(section_type)


def _section_label_to_type(section_label: str) -> SectionType:
    return helpers.section_label_to_type(section_label)


def _build_tracklist_rows(album: Album) -> list[list[object]]:
    return helpers.build_tracklist_rows(album)


def _slugify(value: str) -> str:
    if not value:
        return "untitled_album"
    normalized = value.strip().lower().replace(" ", "_")
    return "".join(char for char in normalized if char.isalnum() or char == "_")


def _ensure_project_dir(project_dir: str, album_title: str) -> Path:
    base_dir = Path(project_dir) if project_dir else Path("output/projects")
    if base_dir.suffix:
        base_dir = base_dir.parent
    if base_dir.name == "projects":
        base_dir = base_dir / _slugify(album_title)
    base_dir.mkdir(parents=True, exist_ok=True)
    return base_dir


def _suggest_project_dir(title: str, current_dir: str) -> str:
    if current_dir:
        return current_dir
    return str(Path("output/projects") / _slugify(title))


def _set_telemetry_enabled(enabled: bool) -> str:
    if enabled:
        enable_telemetry()
        return _status_with_time("Telemetry enabled (opt-in).")
    disable_telemetry()
    return _status_with_time("Telemetry disabled.")


def _build_album_from_inputs(
    album_title: str,
    artist_name: str,
    concept_summary: str,
    tracklist_rows: object | None,
    song_title: str,
    track_number: int,
    song_key: str,
    song_tempo: int,
    time_signature: str,
    narrative_position: str,
    narrative_summary: str,
    section_label: str,
    lyrics: str,
) -> Album:
    songs: list[Song] = []
    rows = helpers.normalize_tracklist_rows(tracklist_rows)
    if rows:
        for row in rows:
            if not row or len(row) < 2:
                continue
            title = str(row[1]).strip() if row[1] is not None else ""
            if not title:
                continue
            try:
                raw_track = row[0]
                track_no = int(str(raw_track)) if raw_track not in (None, "") else len(songs) + 1
            except (TypeError, ValueError):
                track_no = len(songs) + 1
            track_no = max(1, track_no)
            key = str(row[2]).strip() if len(row) > 2 and row[2] else None
            tempo = None
            if len(row) > 3 and row[3] not in (None, ""):
                try:
                    tempo = int(str(row[3]))
                except (TypeError, ValueError):
                    tempo = None
            if tempo is not None and tempo <= 0:
                tempo = None
            narrative = str(row[4]).strip() if len(row) > 4 and row[4] else None
            songs.append(
                Song(
                    title=title,
                    track_number=track_no,
                    key=key,
                    tempo=tempo,
                    narrative_position=narrative,
                )
            )

    if not songs and song_title:
        songs.append(
            Song(
                title=song_title,
                track_number=track_number or 1,
                key=song_key or None,
                tempo=song_tempo or None,
                time_signature=time_signature or "4/4",
                narrative_position=narrative_position or None,
                narrative_summary=narrative_summary or None,
            )
        )

    if song_title and songs:
        selected = next((song for song in songs if song.title == song_title), songs[0])
        if track_number and track_number > 0:
            selected.track_number = track_number
        selected.key = song_key or selected.key
        if song_tempo and song_tempo > 0:
            selected.tempo = song_tempo
        selected.time_signature = time_signature or selected.time_signature
        selected.narrative_position = narrative_position or selected.narrative_position
        selected.narrative_summary = narrative_summary or selected.narrative_summary
        if lyrics:
            selected.sections = [
                Section(
                    section_type=_section_label_to_type(section_label),
                    order=1,
                    lyrics=lyrics,
                )
            ]

    return Album(
        title=album_title or "Untitled Album",
        artist=artist_name or None,
        concept_summary=concept_summary or None,
        songs=songs,
    )


def _parse_list_items(value: str | None) -> list[str]:
    if not value:
        return []
    normalized = value.replace(",", "\n")
    return [item.strip() for item in normalized.splitlines() if item.strip()]


def _parse_int_list(value: str | None) -> list[int]:
    items = _parse_list_items(value)
    results: list[int] = []
    for item in items:
        try:
            results.append(int(item))
        except (TypeError, ValueError):
            continue
    return results


def _build_album_bible_from_inputs(
    album_title: str,
    artist_name: str,
    logline: str,
    synopsis: str,
    setting: str,
    characters_rows: list[list[object]] | None,
    themes_rows: list[list[object]] | None,
    structure_type: str,
    structure_beats: str,
    style_genre: str,
    style_references: str,
    lyrical_voice: str,
    motifs_rows: list[list[object]] | None,
) -> AlbumBible:
    themes: list[Theme] = []
    if themes_rows:
        for row in themes_rows:
            if not row or not row[0]:
                continue
            name = str(row[0]).strip()
            description = str(row[1]).strip() if len(row) > 1 and row[1] else ""
            primary_songs = _parse_int_list(str(row[2])) if len(row) > 2 and row[2] else []
            primary_songs = [num for num in primary_songs if num > 0]
            themes.append(
                Theme(
                    name=name,
                    description=description or "Theme description",
                    primary_songs=primary_songs,
                )
            )

    characters: list[Character] = []
    if characters_rows:
        for row in characters_rows:
            if not row or not row[0]:
                continue
            name = str(row[0]).strip()
            role = str(row[1]).strip() if len(row) > 1 and row[1] else "role"
            description = str(row[2]).strip() if len(row) > 2 and row[2] else ""
            arc = str(row[3]).strip() if len(row) > 3 and row[3] else None
            characters.append(
                Character(
                    name=name,
                    role=role,
                    description=description or "Character description",
                    arc_summary=arc,
                )
            )

    motifs: list[Motif] = []
    if motifs_rows:
        for row in motifs_rows:
            if not row or not row[0]:
                continue
            name = str(row[0]).strip()
            motif_type = str(row[1]).strip() if len(row) > 1 and row[1] else "lyrical"
            description = str(row[2]).strip() if len(row) > 2 and row[2] else ""
            first_appearance = None
            if len(row) > 3 and row[3]:
                try:
                    first_appearance = int(str(row[3]))
                except (TypeError, ValueError):
                    first_appearance = None
            if first_appearance is not None and first_appearance <= 0:
                first_appearance = None
            evolution = str(row[4]).strip() if len(row) > 4 and row[4] else None
            appearances = []
            if first_appearance:
                appearances.append({"track_number": first_appearance})
            motifs.append(
                Motif(
                    name=name,
                    motif_type=motif_type,
                    description=description or "Motif description",
                    appearances=appearances,
                    evolution_notes=evolution,
                )
            )

    narrative_arc = None
    if structure_type or structure_beats:
        structure_map = {
            "Hero's Journey": "heros_journey",
            "Three-Act Structure": "three_act",
            "Circular Narrative": "circular",
            "Non-Linear/Fragmented": "non_linear",
            "Episodic": "episodic",
            "Custom": "custom",
        }
        beats = []
        for beat in _parse_list_items(structure_beats):
            beats.append({"name": beat, "description": ""})
        narrative_arc = NarrativeArc(
            structure_type=structure_map.get(structure_type, "custom"),
            description=structure_beats or structure_type or "User-defined structure",
            beats=beats,
        )

    style_profile = None
    if style_genre or style_references or lyrical_voice:
        style_profile = StyleProfile(
            primary_genre=style_genre or "Unknown",
            reference_artists=_parse_list_items(style_references),
            lyrical_tone=lyrical_voice or None,
        )

    return AlbumBible(
        album_title=album_title or "Untitled Album",
        artist=artist_name or None,
        logline=logline.strip() or "Add logline",
        synopsis=synopsis.strip() or "Add synopsis",
        setting=setting.strip() or None,
        themes=themes,
        motifs=motifs,
        characters=characters,
        narrative_arc=narrative_arc,
        style_profile=style_profile,
    )


def _save_album_bible(
    bible: AlbumBible,
    project_dir: str,
) -> tuple[str, str]:
    target_dir = _ensure_project_dir(project_dir, bible.album_title)
    bible_path = target_dir / "album_bible.json"
    payload = bible.model_dump_json(indent=2)
    bible_path.write_text(payload)
    return str(bible_path), f"Saved album bible to {target_dir}"


def _album_bible_to_markdown(bible: AlbumBible) -> str:
    lines = [
        f"# {bible.album_title} — Album Bible",
        "",
        "## Logline",
        bible.logline,
        "",
        "## Synopsis",
        bible.synopsis,
    ]
    if bible.setting:
        lines += ["", "## Setting", bible.setting]
    if bible.themes:
        lines.append("")
        lines.append("## Themes")
        for theme in bible.themes:
            lines.append(f"- {theme.name}: {theme.description}")
    if bible.motifs:
        lines.append("")
        lines.append("## Motifs")
        for motif in bible.motifs:
            lines.append(f"- {motif.name} ({motif.motif_type}): {motif.description}")
    if bible.characters:
        lines.append("")
        lines.append("## Characters")
        for character in bible.characters:
            lines.append(f"- {character.name} ({character.role}): {character.description}")
    if bible.narrative_arc:
        lines.append("")
        lines.append("## Narrative Structure")
        lines.append(f"{bible.narrative_arc.structure_type}")
        for beat in bible.narrative_arc.beats:
            lines.append(f"- {beat.get('name', '')}")
    if bible.style_profile:
        lines.append("")
        lines.append("## Style Profile")
        lines.append(f"- Genre: {bible.style_profile.primary_genre}")
        if bible.style_profile.reference_artists:
            lines.append(f"- References: {', '.join(bible.style_profile.reference_artists)}")
        if bible.style_profile.lyrical_tone:
            lines.append(f"- Lyrical Voice: {bible.style_profile.lyrical_tone}")
    return "\n".join(lines)


def _generate_review_pass(album: Album) -> tuple[list[str], list[str]]:
    return helpers.generate_review_pass(album)


def _write_review_pass(
    album: Album,
    project_dir: str,
) -> Path:
    review_lines, review_warnings = _generate_review_pass(album)
    content = ["# Review Pass", ""]
    if review_lines:
        content.append("## Summary")
        content.extend(review_lines)
    if review_warnings:
        content.append("")
        content.append("## Warnings")
        content.extend(f"- {warning}" for warning in review_warnings)
    export_dir = _resolve_export_dir(project_dir, album.title)
    review_path = export_dir / "review_pass.txt"
    review_path.write_text("\n".join(content))
    return review_path


def _resolve_export_dir(project_dir: str, album_title: str) -> Path:
    base_dir = _ensure_project_dir(project_dir, album_title)
    export_dir = base_dir / "exports"
    export_dir.mkdir(parents=True, exist_ok=True)
    return export_dir


def _selected_export_formats(
    format_midi: bool,
    format_chordpro: bool,
    format_musicxml: bool,
    format_json: bool,
    format_text: bool,
) -> list[ExportFormat]:
    formats: list[ExportFormat] = []
    if format_midi:
        formats.append(ExportFormat.MIDI)
    if format_chordpro:
        formats.append(ExportFormat.CHORDPRO)
    if format_musicxml:
        formats.append(ExportFormat.MUSICXML)
    if format_json:
        formats.append(ExportFormat.JSON)
    if format_text:
        formats.append(ExportFormat.TEXT)
    return formats


def _build_export_preview(
    album_json: str,
    project_dir: str,
    format_midi: bool,
    format_chordpro: bool,
    format_musicxml: bool,
    format_json: bool,
    format_text: bool,
) -> tuple[str, str]:
    if not album_json:
        return (
            "No album loaded. Generate or load a project first.",
            _status_with_time("Missing album.json"),
        )

    try:
        album = Album.model_validate_json(album_json)
    except Exception as exc:
        _track_event(
            Events.ERROR_OCCURRED,
            {"feature": "export_preview", "error": str(exc)},
        )
        return (
            "Album data is invalid. Regenerate or reload the project.",
            _status_with_time("Invalid album data"),
        )
    review_lines, review_warnings = _generate_review_pass(album)
    export_dir = _resolve_export_dir(project_dir, album.title)
    album_dir = export_dir / AlbumExporter._sanitize_filename(album.title)
    formats = _selected_export_formats(
        format_midi, format_chordpro, format_musicxml, format_json, format_text
    )
    if not formats:
        return "Select at least one export format.", _status_with_time("No formats selected")

    lines = [f"Export folder: {album_dir}"]
    warnings: list[str] = []
    for song in album.songs:
        song_name = AlbumExporter._sanitize_filename(song.title)
        if ExportFormat.MIDI in formats:
            lines.append(f"- midi/{song_name}.mid")
        if ExportFormat.CHORDPRO in formats:
            lines.append(f"- chordpro/{song_name}.cho")
        if ExportFormat.MUSICXML in formats:
            lines.append(f"- musicxml/{song_name}.musicxml")
        if ExportFormat.JSON in formats:
            lines.append(f"- json/{song_name}.json")
        if ExportFormat.TEXT in formats:
            lines.append(f"- lyrics/{song_name}.txt")

        if not song.sections:
            warnings.append(f"{song.title}: no sections defined")
        else:
            if not any(section.lyrics for section in song.sections):
                warnings.append(f"{song.title}: missing lyrics")
            if not any(section.chord_progression for section in song.sections):
                warnings.append(f"{song.title}: missing chord progressions")

    if ExportFormat.JSON in formats:
        lines.append("- album.json")
    if ExportFormat.TEXT in formats:
        lines.append("- tracklist.txt")

    if warnings:
        lines.append("")
        lines.append("Warnings:")
        for warning in warnings:
            lines.append(f"- {warning}")

    if review_warnings:
        lines.append("")
        lines.append("Review Pass:")
        lines.extend(review_lines)

    if warnings or review_warnings:
        return "\n".join(lines), _status_with_time("Preview ready (with warnings)")

    return "\n".join(lines), _status_with_time("Preview ready")


def _export_album_files(
    album_json: str,
    project_dir: str,
    format_midi: bool,
    format_chordpro: bool,
    format_musicxml: bool,
    format_json: bool,
    format_text: bool,
) -> tuple[GradioUpdate, str]:
    if not album_json:
        return gr.update(), _status_with_time("No album loaded. Generate or load a project first.")

    try:
        album = Album.model_validate_json(album_json)
    except Exception as exc:
        _track_event(
            Events.ERROR_OCCURRED,
            {"feature": "export", "error": str(exc)},
        )
        return gr.update(), _status_with_time("Invalid album data. Reload the project.")

    export_dir = _resolve_export_dir(project_dir, album.title)
    formats = _selected_export_formats(
        format_midi, format_chordpro, format_musicxml, format_json, format_text
    )
    if not formats:
        return gr.update(), _status_with_time("Select at least one export format.")

    try:
        exporter = AlbumExporter(output_dir=export_dir, artist_name=album.artist)
        exporter.export_album(album, formats)
        review_path = _write_review_pass(album, project_dir)

        album_dir = export_dir / AlbumExporter._sanitize_filename(album.title)
        archive_base = export_dir / f"{AlbumExporter._sanitize_filename(album.title)}_export"
        archive_path = shutil.make_archive(str(archive_base), "zip", root_dir=album_dir)
        _track_event(
            Events.EXPORT_GENERATED,
            {
                "formats": [fmt.value for fmt in formats],
                "track_count": len(album.songs),
            },
        )
        return (
            gr.update(value=archive_path, visible=True),
            _status_with_time(f"Exported to {album_dir} (review: {review_path.name})"),
        )
    except Exception as exc:
        _track_event(
            Events.ERROR_OCCURRED,
            {
                "feature": "export",
                "error": str(exc),
            },
        )
        return gr.update(), _status_with_time(f"Export failed: {exc}")


def _load_album_bible(
    project_dir: str,
) -> tuple[object, ...]:
    target_dir = _ensure_project_dir(project_dir, "album_bible")
    bible_path = target_dir / "album_bible.json"
    if not bible_path.exists():
        _track_event(
            Events.ERROR_OCCURRED,
            {"feature": "load_bible", "error": f"Missing album_bible.json in {target_dir}"},
        )
        return (
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            f"No album_bible.json found in {target_dir}",
            gr.update(),
        )

    try:
        payload = bible_path.read_text()
        bible = AlbumBible.model_validate_json(payload)
    except Exception as exc:
        _track_event(
            Events.ERROR_OCCURRED,
            {"feature": "load_bible", "error": str(exc)},
        )
        return (
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            f"Failed to load album_bible.json: {exc}",
            gr.update(),
        )

    characters_rows: list[list[object]] = [
        [char.name, char.role, char.description, char.arc_summary or ""]
        for char in bible.characters
    ]
    themes_rows: list[list[object]] = [
        [
            theme.name,
            theme.description,
            ", ".join(str(num) for num in theme.primary_songs),
        ]
        for theme in bible.themes
    ]
    motifs_rows: list[list[object]] = [
        [
            motif.name,
            motif.motif_type,
            motif.description,
            motif.appearances[0].get("track_number") if motif.appearances else "",
            motif.evolution_notes or "",
        ]
        for motif in bible.motifs
    ]

    structure_label_map = {
        "heros_journey": "Hero's Journey",
        "three_act": "Three-Act Structure",
        "circular": "Circular Narrative",
        "non_linear": "Non-Linear/Fragmented",
        "episodic": "Episodic",
        "custom": "Custom",
    }
    structure_label = ""
    structure_beats = ""
    if bible.narrative_arc:
        structure_label = structure_label_map.get(bible.narrative_arc.structure_type, "Custom")
        structure_beats = "\n".join(
            beat.get("name", "") for beat in bible.narrative_arc.beats if beat.get("name")
        )

    style_genre = ""
    style_refs = ""
    lyrical_voice = ""
    if bible.style_profile:
        style_genre = bible.style_profile.primary_genre or ""
        style_refs = ", ".join(bible.style_profile.reference_artists)
        lyrical_voice = bible.style_profile.lyrical_tone or ""

    status = f"Loaded album bible from {target_dir}"

    return (
        bible.logline,
        bible.synopsis,
        bible.setting or "",
        characters_rows,
        themes_rows,
        structure_label,
        structure_beats,
        style_genre,
        style_refs,
        lyrical_voice,
        motifs_rows,
        status,
        payload,
    )


def _save_album(
    album: Album,
    project_dir: str,
    create_version: bool = False,
) -> tuple[str, str]:
    target_dir = _ensure_project_dir(project_dir, album.title)
    album_path = target_dir / "album.json"
    payload = album.model_dump_json(indent=2)
    album_path.write_text(payload)

    if create_version:
        versions_dir = target_dir / "versions"
        versions_dir.mkdir(parents=True, exist_ok=True)
        timestamp = album.updated_at.strftime("%Y%m%d_%H%M%S")
        version_path = versions_dir / f"album_{timestamp}.json"
        version_path.write_text(payload)
        status = f"Saved project and version to {target_dir}"
    else:
        status = f"Saved project to {target_dir}"

    return str(album_path), status


def _save_project_config(
    project_dir: str,
    album_title: str,
    seed_value: int | float | None,
) -> None:
    target_dir = _ensure_project_dir(project_dir, album_title)
    config_path = target_dir / "project.json"
    seed_int: int | None = None
    if seed_value is not None:
        try:
            seed_int = int(seed_value)
        except (TypeError, ValueError):
            seed_int = None
    payload = {
        "seed": seed_int,
    }
    config_path.write_text(json.dumps(payload, indent=2))


def _load_project_config(project_dir: str, album_title: str) -> dict[str, object]:
    target_dir = _ensure_project_dir(project_dir, album_title)
    config_path = target_dir / "project.json"
    if not config_path.exists():
        return {}
    try:
        loaded = json.loads(config_path.read_text())
        return loaded if isinstance(loaded, dict) else {}
    except json.JSONDecodeError:
        return {}


def _load_song_from_state(
    album_json: str,
    song_title: str | None,
) -> tuple[str, int, str, int, str, str, str, str, str]:
    if not album_json or not song_title:
        return "", 1, "", 120, "4/4", "", "", "", ""

    album = Album.model_validate_json(album_json)
    song = album.get_song_by_title(song_title)
    if not song:
        return "", 1, "", 120, "4/4", "", "", "", ""

    first_section = song.sections[0] if song.sections else None
    section_label = "Verse 1"
    if first_section:
        section_label = _section_type_to_label(first_section.section_type)

    return (
        song.title,
        song.track_number,
        song.key or "",
        song.tempo or 120,
        song.time_signature or "4/4",
        song.narrative_position or "",
        song.narrative_summary or "",
        section_label,
        first_section.lyrics if first_section and first_section.lyrics else "",
    )


def _merge_album_with_tracklist(
    album_json: str,
    album_title: str,
    artist_name: str,
    concept_summary: str,
    tracklist_rows: object | None,
) -> Album:
    return helpers.merge_album_with_tracklist(
        album_json=album_json,
        album_title=album_title,
        artist_name=artist_name,
        concept_summary=concept_summary,
        tracklist_rows=tracklist_rows,
    )


def _update_album_from_tracklist(
    album_json: str,
    album_title: str,
    artist_name: str,
    concept_summary: str,
    tracklist_rows: list[list[object]] | None,
) -> tuple[str, GradioUpdate]:
    album = _merge_album_with_tracklist(
        album_json=album_json,
        album_title=album_title,
        artist_name=artist_name,
        concept_summary=concept_summary,
        tracklist_rows=tracklist_rows,
    )
    payload = album.model_dump_json(indent=2)
    song_titles = [song.title for song in album.songs]
    return (
        payload,
        gr.update(choices=song_titles, value=song_titles[0] if song_titles else None),
    )


def _update_album_from_song_editor(
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
) -> tuple[str, GradioUpdate, list[list[object]]]:
    updated_json, updated_rows, song_titles = helpers.update_album_from_song_editor(
        album_json=album_json,
        selected_title=selected_title,
        song_title=song_title,
        track_number=track_number,
        song_key=song_key,
        song_tempo=song_tempo,
        time_signature=time_signature,
        narrative_position=narrative_position,
        narrative_summary=narrative_summary,
        section_label=section_label,
        lyrics=lyrics,
    )
    selected_value = None
    if selected_title and selected_title in song_titles:
        selected_value = selected_title
    elif song_title and song_title in song_titles:
        selected_value = song_title
    elif song_titles:
        selected_value = song_titles[0]

    return (
        updated_json,
        gr.update(choices=song_titles, value=selected_value),
        updated_rows,
    )


def _apply_song_editor_to_album(
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
) -> str:
    updated_json, _, _ = _update_album_from_song_editor(
        album_json=album_json,
        selected_title=selected_title,
        song_title=song_title,
        track_number=track_number,
        song_key=song_key,
        song_tempo=song_tempo,
        time_signature=time_signature,
        narrative_position=narrative_position,
        narrative_summary=narrative_summary,
        section_label=section_label,
        lyrics=lyrics,
    )
    return updated_json


def _generate_album_payload(
    title: str,
    artist_name: str,
    concept_summary: str,
    tracks: int,
    raw_track_names: str,
) -> tuple[Album | None, str]:
    if not title:
        return None, "Album title is required."

    names = _parse_track_names(raw_track_names)
    tracks = max(1, tracks)
    songs: list[Song] = []
    for index in range(tracks):
        song_title = names[index] if index < len(names) else f"Track {index + 1}"
        songs.append(
            Song(
                title=song_title,
                track_number=index + 1,
                sections=[
                    Section(
                        section_type=SectionType.VERSE,
                        order=1,
                        lyrics="[Add lyrics here]",
                    )
                ],
            )
        )

    album = Album(
        title=title,
        artist=artist_name or None,
        concept_summary=concept_summary or None,
        songs=songs,
    )

    return album, f"Created album with {len(songs)} tracks."


def _extract_file_path(file_value: object | None) -> str | None:
    if file_value is None:
        return None
    if isinstance(file_value, str):
        return file_value
    if isinstance(file_value, dict) and "name" in file_value:
        return str(file_value["name"])
    return getattr(file_value, "name", None)


def _load_album_json(
    file_value: object | None,
    project_dir: str,
) -> tuple[object, ...]:
    def _error_response(message: str) -> tuple:
        _track_event(
            Events.ERROR_OCCURRED,
            {"feature": "load_album", "error": message},
        )
        return (
            gr.update(),
            message,
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
            gr.update(),
        )

    file_path = _extract_file_path(file_value)
    if not file_path:
        return _error_response("Please select an album.json file.")

    try:
        payload = Path(file_path).read_text()
        album = Album.model_validate_json(payload)
    except Exception as exc:
        return _error_response(f"Failed to load album.json: {exc}")
    project_path = Path(file_path).parent
    project_dir = str(project_path) if project_dir == "" else project_dir
    output_path, status = _save_album(album, project_dir)
    config = _load_project_config(project_dir, album.title)
    seed_raw = config.get("seed")
    seed_value: int | float | None
    if isinstance(seed_raw, (int, float)):
        seed_value = seed_raw
    elif isinstance(seed_raw, str):
        try:
            seed_value = int(seed_raw)
        except ValueError:
            try:
                seed_value = float(seed_raw)
            except ValueError:
                seed_value = None
    else:
        seed_value = None
    _track_event(
        Events.UI_FEATURE_USED,
        {
            "feature": "load_album",
            "project_dir": str(Path(project_dir)),
        },
    )
    bible_values = _load_album_bible(project_dir)
    bible_fields = (*bible_values[:11], bible_values[12])

    tracklist = _build_tracklist_rows(album)
    song_titles = [song.title for song in album.songs]
    first_song = album.songs[0] if album.songs else None
    first_section = first_song.sections[0] if first_song and first_song.sections else None
    section_label = "Verse 1"
    if first_section:
        section_label = _section_type_to_label(first_section.section_type)

    return (
        output_path,
        _status_with_time(status),
        payload,
        album.title,
        album.artist or "",
        album.concept_summary or "",
        tracklist,
        gr.update(choices=song_titles, value=song_titles[0] if song_titles else None),
        first_song.title if first_song else "",
        first_song.track_number if first_song else 1,
        first_song.key if first_song and first_song.key else "",
        first_song.tempo if first_song and first_song.tempo else 120,
        first_song.time_signature if first_song and first_song.time_signature else "4/4",
        first_song.narrative_position if first_song and first_song.narrative_position else "",
        first_song.narrative_summary if first_song and first_song.narrative_summary else "",
        section_label,
        first_section.lyrics if first_section and first_section.lyrics else "",
        payload,
        seed_value,
        *bible_fields,
        seed_value,
    )


def _generate_album_json(
    title: str,
    artist_name: str,
    concept_summary: str,
    tracks: int,
    raw_track_names: str,
    project_dir: str,
    seed_value: int | float | None,
) -> tuple[object, ...]:
    try:
        tracks = int(tracks)
    except (TypeError, ValueError):
        tracks = 10

    album, status_message = _generate_album_payload(
        title,
        artist_name,
        concept_summary,
        tracks,
        raw_track_names,
    )
    if album is None:
        return (
            None,
            status_message,
            "",
            "",
            "",
            "",
            [],
            gr.update(choices=[], value=None),
            "",
            1,
            "",
            120,
            "4/4",
            "",
            "",
            "",
            "",
            "",
            seed_value,
            seed_value,
        )

    output_path, status_message = _save_album(album, project_dir)
    _save_project_config(project_dir, album.title, seed_value)
    _track_event(
        Events.ALBUM_CREATED,
        {
            "track_count": len(album.songs),
            "project_dir": str(Path(project_dir)) if project_dir else "",
        },
    )
    payload = Path(output_path).read_text()

    tracklist = _build_tracklist_rows(album)
    song_titles = [song.title for song in album.songs]
    first_song = album.songs[0] if album.songs else None
    first_section = first_song.sections[0] if first_song and first_song.sections else None
    section_label = "Verse 1"
    if first_section:
        section_label = _section_type_to_label(first_section.section_type)

    return (
        str(output_path),
        _status_with_time(status_message),
        payload,
        album.title,
        album.artist or "",
        album.concept_summary or "",
        tracklist,
        gr.update(choices=song_titles, value=song_titles[0] if song_titles else None),
        first_song.title if first_song else "",
        first_song.track_number if first_song else 1,
        first_song.key if first_song and first_song.key else "",
        first_song.tempo if first_song and first_song.tempo else 120,
        first_song.time_signature if first_song and first_song.time_signature else "4/4",
        first_song.narrative_position if first_song and first_song.narrative_position else "",
        first_song.narrative_summary if first_song and first_song.narrative_summary else "",
        section_label,
        first_section.lyrics if first_section and first_section.lyrics else "",
        payload,
        seed_value,
        seed_value,
    )


def _bind_quickstart_actions(
    quickstart_components: dict,
    album_components: dict,
    song_components: dict,
    bible_components: dict,
    export_components: dict,
    experience_components: dict,
    agent_components: dict,
    album_state: gr.State,
    bible_state: gr.State,
    experience_remix_state: gr.State,
) -> None:
    def _update_project_dir(title: str, current_dir: str) -> str:
        return _suggest_project_dir(title, current_dir)

    quickstart_components["album_title"].change(
        fn=_update_project_dir,
        inputs=[quickstart_components["album_title"], quickstart_components["project_dir"]],
        outputs=[quickstart_components["project_dir"]],
    )

    if agent_components.get("seed_input") is not None:
        quickstart_components["seed"].change(
            fn=lambda seed_value: seed_value,
            inputs=[quickstart_components["seed"]],
            outputs=[agent_components["seed_input"]],
        )

    quickstart_components["telemetry_enabled"].change(
        fn=_set_telemetry_enabled,
        inputs=[quickstart_components["telemetry_enabled"]],
        outputs=[quickstart_components["status"]],
    )

    album_components["album_title"].change(
        fn=_update_project_dir,
        inputs=[album_components["album_title"], quickstart_components["project_dir"]],
        outputs=[quickstart_components["project_dir"]],
    )

    quickstart_components["generate_btn"].click(
        fn=_generate_album_json,
        inputs=[
            quickstart_components["album_title"],
            quickstart_components["artist"],
            quickstart_components["concept"],
            quickstart_components["track_count"],
            quickstart_components["track_names"],
            quickstart_components["project_dir"],
            quickstart_components["seed"],
        ],
        outputs=[
            quickstart_components["output_file"],
            quickstart_components["status"],
            quickstart_components["preview"],
            album_components["album_title"],
            album_components["artist_name"],
            album_components["concept_summary"],
            album_components["tracklist_display"],
            song_components["song_selector"],
            song_components["song_title_edit"],
            song_components["track_number"],
            song_components["song_key"],
            song_components["song_tempo"],
            song_components["time_signature"],
            song_components["narrative_position"],
            song_components["narrative_summary"],
            song_components["section_selector"],
            song_components["lyrics_editor"],
            album_state,
            quickstart_components["seed"],
            agent_components["seed_input"],
        ],
    )

    quickstart_components["load_btn"].click(
        fn=_load_album_json,
        inputs=[
            quickstart_components["load_file"],
            quickstart_components["project_dir"],
        ],
        outputs=[
            quickstart_components["output_file"],
            quickstart_components["status"],
            quickstart_components["preview"],
            album_components["album_title"],
            album_components["artist_name"],
            album_components["concept_summary"],
            album_components["tracklist_display"],
            song_components["song_selector"],
            song_components["song_title_edit"],
            song_components["track_number"],
            song_components["song_key"],
            song_components["song_tempo"],
            song_components["time_signature"],
            song_components["narrative_position"],
            song_components["narrative_summary"],
            song_components["section_selector"],
            song_components["lyrics_editor"],
            album_state,
            quickstart_components["seed"],
            bible_components["logline"],
            bible_components["synopsis"],
            bible_components["setting"],
            bible_components["characters_table"],
            bible_components["themes_table"],
            bible_components["structure_type"],
            bible_components["structure_beats"],
            bible_components["style_genre"],
            bible_components["style_references"],
            bible_components["lyrical_voice"],
            bible_components["motifs_table"],
            bible_state,
            agent_components["seed_input"],
        ],
    )

    def _autosave_project(
        album_json: str,
        album_title: str,
        artist_name: str,
        concept_summary: str,
        tracklist_rows: list[list[object]] | None,
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
        seed_value: int | float | None,
        project_dir: str,
        autosave_enabled: bool,
    ) -> tuple[str | None, str, str, str]:
        if not autosave_enabled:
            return None, "", "Autosave disabled.", album_json

        merged = _merge_album_with_tracklist(
            album_json=album_json,
            album_title=album_title,
            artist_name=artist_name,
            concept_summary=concept_summary,
            tracklist_rows=tracklist_rows,
        )
        merged_json = merged.model_dump_json(indent=2)
        updated_json = _apply_song_editor_to_album(
            album_json=merged_json,
            selected_title=selected_title,
            song_title=song_title,
            track_number=track_number,
            song_key=song_key,
            song_tempo=song_tempo,
            time_signature=time_signature,
            narrative_position=narrative_position,
            narrative_summary=narrative_summary,
            section_label=section_label,
            lyrics=lyrics,
        )
        album = Album.model_validate_json(updated_json)
        output_path, status = _save_album(album, project_dir)
        _save_project_config(project_dir, album.title, seed_value)
        payload = Path(output_path).read_text()
        _track_event(
            Events.UI_FEATURE_USED,
            {
                "feature": "autosave_project",
                "project_dir": str(Path(project_dir)),
            },
        )
        return output_path, payload, _status_with_time(status), payload

    autosave_inputs = [
        album_state,
        album_components["album_title"],
        album_components["artist_name"],
        album_components["concept_summary"],
        album_components["tracklist_display"],
        song_components["song_selector"],
        song_components["song_title_edit"],
        song_components["track_number"],
        song_components["song_key"],
        song_components["song_tempo"],
        song_components["time_signature"],
        song_components["narrative_position"],
        song_components["narrative_summary"],
        song_components["section_selector"],
        song_components["lyrics_editor"],
        quickstart_components["seed"],
        quickstart_components["project_dir"],
        quickstart_components["autosave_enabled"],
    ]

    autosave_outputs = [
        quickstart_components["output_file"],
        quickstart_components["preview"],
        quickstart_components["status"],
        album_state,
    ]

    for component in [
        album_components["album_title"],
        album_components["artist_name"],
        album_components["concept_summary"],
        album_components["tracklist_display"],
        song_components["song_title_edit"],
        song_components["track_number"],
        song_components["song_key"],
        song_components["song_tempo"],
        song_components["time_signature"],
        song_components["narrative_position"],
        song_components["narrative_summary"],
        song_components["section_selector"],
        song_components["lyrics_editor"],
    ]:
        component.change(
            fn=_autosave_project,
            inputs=autosave_inputs,
            outputs=autosave_outputs,
        )

    def _save_project_clicked(
        album_json: str,
        album_title: str,
        artist_name: str,
        concept_summary: str,
        tracklist_rows: list[list[object]] | None,
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
        seed_value: int | float | None,
        project_dir: str,
    ) -> tuple[str | None, str, str, str]:
        merged = _merge_album_with_tracklist(
            album_json=album_json,
            album_title=album_title,
            artist_name=artist_name,
            concept_summary=concept_summary,
            tracklist_rows=tracklist_rows,
        )
        merged_json = merged.model_dump_json(indent=2)
        updated_json = _apply_song_editor_to_album(
            album_json=merged_json,
            selected_title=selected_title,
            song_title=song_title,
            track_number=track_number,
            song_key=song_key,
            song_tempo=song_tempo,
            time_signature=time_signature,
            narrative_position=narrative_position,
            narrative_summary=narrative_summary,
            section_label=section_label,
            lyrics=lyrics,
        )
        album = Album.model_validate_json(updated_json)
        output_path, status = _save_album(album, project_dir)
        _save_project_config(project_dir, album.title, seed_value)
        payload = Path(output_path).read_text()
        _track_event(
            Events.UI_FEATURE_USED,
            {
                "feature": "save_project",
                "project_dir": str(Path(project_dir)),
            },
        )
        return output_path, payload, _status_with_time(status), payload

    quickstart_components["save_project_btn"].click(
        fn=_save_project_clicked,
        inputs=autosave_inputs[:-1],
        outputs=autosave_outputs,
    )

    def _save_version_clicked(
        album_json: str,
        album_title: str,
        artist_name: str,
        concept_summary: str,
        tracklist_rows: list[list[object]] | None,
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
        seed_value: int | float | None,
        project_dir: str,
    ) -> tuple[str | None, str, str, str]:
        merged = _merge_album_with_tracklist(
            album_json=album_json,
            album_title=album_title,
            artist_name=artist_name,
            concept_summary=concept_summary,
            tracklist_rows=tracklist_rows,
        )
        merged_json = merged.model_dump_json(indent=2)
        updated_json = _apply_song_editor_to_album(
            album_json=merged_json,
            selected_title=selected_title,
            song_title=song_title,
            track_number=track_number,
            song_key=song_key,
            song_tempo=song_tempo,
            time_signature=time_signature,
            narrative_position=narrative_position,
            narrative_summary=narrative_summary,
            section_label=section_label,
            lyrics=lyrics,
        )
        album = Album.model_validate_json(updated_json)
        output_path, status = _save_album(album, project_dir, create_version=True)
        _save_project_config(project_dir, album.title, seed_value)
        payload = Path(output_path).read_text()
        _track_event(
            Events.UI_FEATURE_USED,
            {
                "feature": "save_version",
                "project_dir": str(Path(project_dir)),
            },
        )
        return output_path, payload, _status_with_time(status), payload

    quickstart_components["save_version_btn"].click(
        fn=_save_version_clicked,
        inputs=autosave_inputs[:-1],
        outputs=autosave_outputs,
    )

    def _sync_tracklist_to_state(
        album_json: str,
        album_title: str,
        artist_name: str,
        concept_summary: str,
        tracklist_rows: list[list[object]] | None,
    ) -> tuple[str, GradioUpdate]:
        return _update_album_from_tracklist(
            album_json=album_json,
            album_title=album_title,
            artist_name=artist_name,
            concept_summary=concept_summary,
            tracklist_rows=tracklist_rows,
        )

    album_components["tracklist_display"].change(
        fn=_sync_tracklist_to_state,
        inputs=[
            album_state,
            album_components["album_title"],
            album_components["artist_name"],
            album_components["concept_summary"],
            album_components["tracklist_display"],
        ],
        outputs=[
            album_state,
            song_components["song_selector"],
        ],
    )

    for component in [
        album_components["album_title"],
        album_components["artist_name"],
        album_components["concept_summary"],
    ]:
        component.change(
            fn=_sync_tracklist_to_state,
            inputs=[
                album_state,
                album_components["album_title"],
                album_components["artist_name"],
                album_components["concept_summary"],
                album_components["tracklist_display"],
            ],
            outputs=[
                album_state,
                song_components["song_selector"],
            ],
        )

    def _sync_song_editor_to_state(
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
    ) -> tuple[str, GradioUpdate, list[list[object]]]:
        return _update_album_from_song_editor(
            album_json=album_json,
            selected_title=selected_title,
            song_title=song_title,
            track_number=track_number,
            song_key=song_key,
            song_tempo=song_tempo,
            time_signature=time_signature,
            narrative_position=narrative_position,
            narrative_summary=narrative_summary,
            section_label=section_label,
            lyrics=lyrics,
        )

    for component in [
        song_components["song_title_edit"],
        song_components["track_number"],
        song_components["song_key"],
        song_components["song_tempo"],
        song_components["time_signature"],
        song_components["narrative_position"],
        song_components["narrative_summary"],
        song_components["section_selector"],
        song_components["lyrics_editor"],
    ]:
        component.change(
            fn=_sync_song_editor_to_state,
            inputs=[
                album_state,
                song_components["song_selector"],
                song_components["song_title_edit"],
                song_components["track_number"],
                song_components["song_key"],
                song_components["song_tempo"],
                song_components["time_signature"],
                song_components["narrative_position"],
                song_components["narrative_summary"],
                song_components["section_selector"],
                song_components["lyrics_editor"],
            ],
            outputs=[
                album_state,
                song_components["song_selector"],
                album_components["tracklist_display"],
            ],
        )

    song_components["song_selector"].change(
        fn=_load_song_from_state,
        inputs=[album_state, song_components["song_selector"]],
        outputs=[
            song_components["song_title_edit"],
            song_components["track_number"],
            song_components["song_key"],
            song_components["song_tempo"],
            song_components["time_signature"],
            song_components["narrative_position"],
            song_components["narrative_summary"],
            song_components["section_selector"],
            song_components["lyrics_editor"],
        ],
    )

    def _save_bible_clicked(
        album_title: str,
        artist_name: str,
        logline: str,
        synopsis: str,
        setting: str,
        characters_rows: list[list[object]] | None,
        themes_rows: list[list[object]] | None,
        structure_type: str,
        structure_beats: str,
        style_genre: str,
        style_references: str,
        lyrical_voice: str,
        motifs_rows: list[list[object]] | None,
        project_dir: str,
    ) -> tuple[str, str]:
        bible = _build_album_bible_from_inputs(
            album_title=album_title,
            artist_name=artist_name,
            logline=logline,
            synopsis=synopsis,
            setting=setting,
            characters_rows=characters_rows,
            themes_rows=themes_rows,
            structure_type=structure_type,
            structure_beats=structure_beats,
            style_genre=style_genre,
            style_references=style_references,
            lyrical_voice=lyrical_voice,
            motifs_rows=motifs_rows,
        )
        _, status = _save_album_bible(bible, project_dir)
        _track_event(
            Events.UI_FEATURE_USED,
            {
                "feature": "save_bible",
                "project_dir": str(Path(project_dir)),
            },
        )
        return _status_with_time(status), bible.model_dump_json(indent=2)

    bible_inputs = [
        album_components["album_title"],
        album_components["artist_name"],
        bible_components["logline"],
        bible_components["synopsis"],
        bible_components["setting"],
        bible_components["characters_table"],
        bible_components["themes_table"],
        bible_components["structure_type"],
        bible_components["structure_beats"],
        bible_components["style_genre"],
        bible_components["style_references"],
        bible_components["lyrical_voice"],
        bible_components["motifs_table"],
        quickstart_components["project_dir"],
    ]

    bible_outputs = [
        quickstart_components["status"],
        bible_state,
    ]

    bible_components["save_bible_btn"].click(
        fn=_save_bible_clicked,
        inputs=bible_inputs,
        outputs=bible_outputs,
    )

    def _autosave_bible(
        album_title: str,
        artist_name: str,
        logline: str,
        synopsis: str,
        setting: str,
        characters_rows: list[list[object]] | None,
        themes_rows: list[list[object]] | None,
        structure_type: str,
        structure_beats: str,
        style_genre: str,
        style_references: str,
        lyrical_voice: str,
        motifs_rows: list[list[object]] | None,
        project_dir: str,
        current_state: str,
        autosave_enabled: bool,
    ) -> tuple[str, str]:
        if not autosave_enabled:
            return "Autosave disabled.", current_state

        bible = _build_album_bible_from_inputs(
            album_title=album_title,
            artist_name=artist_name,
            logline=logline,
            synopsis=synopsis,
            setting=setting,
            characters_rows=characters_rows,
            themes_rows=themes_rows,
            structure_type=structure_type,
            structure_beats=structure_beats,
            style_genre=style_genre,
            style_references=style_references,
            lyrical_voice=lyrical_voice,
            motifs_rows=motifs_rows,
        )
        _, status = _save_album_bible(bible, project_dir)
        _track_event(
            Events.UI_FEATURE_USED,
            {
                "feature": "autosave_bible",
                "project_dir": str(Path(project_dir)),
            },
        )
        return _status_with_time(status), bible.model_dump_json(indent=2)

    bible_autosave_inputs = [*bible_inputs, bible_state, quickstart_components["autosave_enabled"]]
    for component in [
        bible_components["logline"],
        bible_components["synopsis"],
        bible_components["setting"],
        bible_components["characters_table"],
        bible_components["themes_table"],
        bible_components["structure_type"],
        bible_components["structure_beats"],
        bible_components["style_genre"],
        bible_components["style_references"],
        bible_components["lyrical_voice"],
        bible_components["motifs_table"],
    ]:
        component.change(
            fn=_autosave_bible,
            inputs=bible_autosave_inputs,
            outputs=bible_outputs,
        )

    def _load_bible_clicked(
        project_dir: str,
    ) -> tuple[object, ...]:
        result = _load_album_bible(project_dir)
        _track_event(
            Events.UI_FEATURE_USED,
            {
                "feature": "load_bible",
                "project_dir": str(Path(project_dir)),
            },
        )
        return result

    bible_load_outputs = [
        bible_components["logline"],
        bible_components["synopsis"],
        bible_components["setting"],
        bible_components["characters_table"],
        bible_components["themes_table"],
        bible_components["structure_type"],
        bible_components["structure_beats"],
        bible_components["style_genre"],
        bible_components["style_references"],
        bible_components["lyrical_voice"],
        bible_components["motifs_table"],
        quickstart_components["status"],
        bible_state,
    ]

    bible_components["load_bible_btn"].click(
        fn=_load_bible_clicked,
        inputs=[quickstart_components["project_dir"]],
        outputs=bible_load_outputs,
    )

    def _export_bible_clicked(
        album_title: str,
        artist_name: str,
        logline: str,
        synopsis: str,
        setting: str,
        characters_rows: list[list[object]] | None,
        themes_rows: list[list[object]] | None,
        structure_type: str,
        structure_beats: str,
        style_genre: str,
        style_references: str,
        lyrical_voice: str,
        motifs_rows: list[list[object]] | None,
        project_dir: str,
    ) -> str:
        bible = _build_album_bible_from_inputs(
            album_title=album_title,
            artist_name=artist_name,
            logline=logline,
            synopsis=synopsis,
            setting=setting,
            characters_rows=characters_rows,
            themes_rows=themes_rows,
            structure_type=structure_type,
            structure_beats=structure_beats,
            style_genre=style_genre,
            style_references=style_references,
            lyrical_voice=lyrical_voice,
            motifs_rows=motifs_rows,
        )
        target_dir = _ensure_project_dir(project_dir, bible.album_title)
        markdown = _album_bible_to_markdown(bible)
        markdown_path = target_dir / "album_bible.md"
        markdown_path.write_text(markdown)
        _track_event(
            Events.UI_FEATURE_USED,
            {
                "feature": "export_bible",
                "project_dir": str(target_dir),
            },
        )
        return _status_with_time(f"Exported album bible to {markdown_path}")

    bible_components["export_bible_btn"].click(
        fn=_export_bible_clicked,
        inputs=bible_inputs,
        outputs=[quickstart_components["status"]],
    )

    export_components["preview_btn"].click(
        fn=_build_export_preview,
        inputs=[
            album_state,
            quickstart_components["project_dir"],
            export_components["format_midi"],
            export_components["format_chordpro"],
            export_components["format_musicxml"],
            export_components["format_json"],
            export_components["format_text"],
        ],
        outputs=[
            export_components["preview_output"],
            export_components["status_output"],
        ],
    )

    export_components["export_btn"].click(
        fn=_export_album_files,
        inputs=[
            album_state,
            quickstart_components["project_dir"],
            export_components["format_midi"],
            export_components["format_chordpro"],
            export_components["format_musicxml"],
            export_components["format_json"],
            export_components["format_text"],
        ],
        outputs=[
            export_components["download_output"],
            export_components["status_output"],
        ],
    )

    def _experience_generate_jam(album_json: str, pack_id: str, jam_focus: str) -> str:
        if not album_json:
            return "Generate or load an album first."
        try:
            album = Album.model_validate_json(album_json)
        except Exception:
            return "Album state is invalid. Reload the project."
        songs = sorted(album.songs, key=lambda s: s.track_number)
        if not songs:
            return "Add songs before generating a jam plan."

        focus = jam_focus.strip() if jam_focus else "story-first hooks with clear chord movement"
        lines = [
            f"Challenge pack: {pack_id}",
            f"Focus: {focus}",
            "",
            "Jam cards:",
        ]
        for song in songs:
            progression = []
            for section in song.sections:
                if section.chord_progression:
                    progression = section.chord_progression[:4]
                    break
            if not progression:
                progression = ["C", "G", "Am", "F"]
            theme_hint = song.themes[0] if song.themes else "change"
            lines.extend(
                [
                    f"- Track {song.track_number}: {song.title}",
                    f"  - Prompt: Reframe '{theme_hint}' through one concrete image.",
                    f"  - Seed progression: {' '.join(progression)}",
                ]
            )
        return "\n".join(lines)

    def _experience_progress_coach(album_json: str) -> str:
        if not album_json:
            return "Generate or load an album first."
        try:
            album = Album.model_validate_json(album_json)
        except Exception:
            return "Album state is invalid. Reload the project."

        total = len(album.songs)
        if total == 0:
            return "Add songs to start progress coaching."
        with_story = sum(1 for song in album.songs if song.narrative_summary)
        with_lyrics = sum(
            1 for song in album.songs if any(section.lyrics for section in song.sections)
        )
        with_chords = sum(
            1 for song in album.songs if any(section.chord_progression for section in song.sections)
        )
        completion = round(
            ((with_story / total) * 40)
            + ((with_lyrics / total) * 30)
            + ((with_chords / total) * 30)
        )
        readiness = "prototype"
        if completion >= 85:
            readiness = "launch-ready"
        elif completion >= 65:
            readiness = "beta-ready"
        elif completion >= 40:
            readiness = "pre-beta"
        return "\n".join(
            [
                f"Completion: {completion}%",
                f"Readiness tier: {readiness}",
                "",
                f"- Songs with narrative summaries: {with_story}/{total}",
                f"- Songs with lyric content: {with_lyrics}/{total}",
                f"- Songs with chord progressions: {with_chords}/{total}",
                "",
                "Next actions:",
                "- Fill missing narrative summaries.",
                "- Add chord progressions to every core section.",
                "- Run export preview to catch warnings early.",
            ]
        )

    def _experience_release_kit(album_json: str) -> str:
        if not album_json:
            return "Generate or load an album first."
        try:
            album = Album.model_validate_json(album_json)
        except Exception:
            return "Album state is invalid. Reload the project."

        concept = album.concept_summary or "a narrative-driven concept story"
        genre = album.primary_genre or "alt-pop"
        themes = ", ".join(album.central_themes[:3]) or "identity, memory, and change"
        track_titles = ", ".join(
            song.title for song in sorted(album.songs, key=lambda s: s.track_number)
        )
        return "\n".join(
            [
                f"Album pitch: '{album.title}' is a {genre} project about {concept}.",
                f"Theme stack: {themes}.",
                "",
                "Press blurb:",
                f"{album.title} threads a unified story arc across {len(album.songs)} tracks.",
                "",
                "Tracklist teaser:",
                track_titles or "(no tracks yet)",
                "",
                "Social caption:",
                f"New era: {album.title}. A {genre} concept release exploring {themes}.",
            ]
        )

    experience_components["jam_btn"].click(
        fn=_experience_generate_jam,
        inputs=[album_state, experience_components["pack_id"], experience_components["jam_focus"]],
        outputs=[experience_components["output"]],
    )
    experience_components["progress_btn"].click(
        fn=_experience_progress_coach,
        inputs=[album_state],
        outputs=[experience_components["output"]],
    )
    experience_components["release_btn"].click(
        fn=_experience_release_kit,
        inputs=[album_state],
        outputs=[experience_components["output"]],
    )

    def _empty_remix_registry() -> dict[str, dict[str, Any]]:
        return {"battles": {}}

    def _load_remix_registry(state_json: str) -> dict[str, dict[str, Any]]:
        if not state_json:
            return _empty_remix_registry()
        try:
            payload = json.loads(state_json)
        except Exception:
            return _empty_remix_registry()
        if not isinstance(payload, dict):
            return _empty_remix_registry()
        battles = payload.get("battles")
        if not isinstance(battles, dict):
            return _empty_remix_registry()
        cleaned: dict[str, Any] = {}
        for battle_id, battle_payload in battles.items():
            if isinstance(battle_id, str) and isinstance(battle_payload, dict):
                cleaned[battle_id] = battle_payload
        return {"battles": cleaned}

    def _dump_remix_registry(registry: dict[str, dict[str, Any]]) -> str:
        return json.dumps(registry, sort_keys=True)

    def _current_album(album_json: str) -> Album | None:
        if not album_json:
            return None
        try:
            return Album.model_validate_json(album_json)
        except Exception:
            return None

    def _battle_choice_pairs(
        registry: dict[str, dict[str, Any]], album_id: str
    ) -> list[tuple[str, str]]:
        choices_with_time: list[tuple[str, str, str]] = []
        battles = registry.get("battles", {})
        for battle_id, payload in battles.items():
            if payload.get("album_id") != album_id:
                continue
            title = str(payload.get("title", "Untitled Battle")).strip() or "Untitled Battle"
            status = str(payload.get("status", "open")).strip() or "open"
            updated_at = str(payload.get("updated_at", ""))
            label = f"{title} ({status})"
            choices_with_time.append((label, battle_id, updated_at))
        choices_with_time.sort(key=lambda item: item[2], reverse=True)
        return [(label, battle_id) for label, battle_id, _ in choices_with_time]

    def _refresh_submission_stats(submission: dict[str, Any]) -> None:
        votes_payload = submission.get("votes")
        votes: list[dict[str, Any]] = []
        if isinstance(votes_payload, list):
            for vote in votes_payload:
                if not isinstance(vote, dict):
                    continue
                alias = str(vote.get("alias", "")).strip()
                if not alias:
                    continue
                try:
                    score = int(vote.get("score", 0))
                except (TypeError, ValueError):
                    continue
                if 1 <= score <= 5:
                    votes.append(
                        {
                            "alias": alias,
                            "score": score,
                            "created_at": str(
                                vote.get("created_at", datetime.utcnow().isoformat())
                            ),
                        }
                    )
        submission["votes"] = votes
        submission["vote_count"] = len(votes)
        if votes:
            submission["average_score"] = round(
                sum(vote["score"] for vote in votes) / len(votes),
                2,
            )
        else:
            submission["average_score"] = 0.0

    def _sort_submissions(submissions: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return sorted(
            submissions,
            key=lambda item: (
                float(item.get("average_score", 0.0)),
                int(item.get("vote_count", 0)),
                str(item.get("created_at", "")),
            ),
            reverse=True,
        )

    def _submission_choice_pairs(battle: dict[str, Any]) -> list[tuple[str, str]]:
        submission_payload = battle.get("submissions")
        if not isinstance(submission_payload, list):
            return []
        choices: list[tuple[str, str]] = []
        for submission in submission_payload:
            if not isinstance(submission, dict):
                continue
            submission_id = str(submission.get("id", "")).strip()
            if not submission_id:
                continue
            title = str(submission.get("title", "Untitled")).strip() or "Untitled"
            alias = str(submission.get("alias", "anonymous")).strip() or "anonymous"
            average_score = float(submission.get("average_score", 0.0))
            vote_count = int(submission.get("vote_count", 0))
            label = f"{title} by {alias} ({average_score:.2f}/5, {vote_count} votes)"
            choices.append((label, submission_id))
        return choices

    def _format_remix_summary(battle: dict[str, Any]) -> str:
        title = str(battle.get("title", "Untitled Battle"))
        prompt = str(battle.get("prompt", ""))
        status = str(battle.get("status", "open"))
        share_slug = str(battle.get("share_slug", ""))
        created_by = str(battle.get("created_by", ""))
        submissions_payload = battle.get("submissions")
        submissions: list[dict[str, Any]] = []
        if isinstance(submissions_payload, list):
            for submission in submissions_payload:
                if isinstance(submission, dict):
                    submissions.append(submission)

        lines = [
            f"Battle: {title}",
            f"Status: {status}",
            f"Host: {created_by}",
            f"Prompt: {prompt}",
            f"Public slug: {share_slug}",
            "",
            "Leaderboard:",
        ]
        if not submissions:
            lines.append("- No submissions yet.")
            return "\n".join(lines)

        for index, submission in enumerate(submissions[:5], start=1):
            lines.append(
                f"- #{index} {submission.get('title', 'Untitled')} by "
                f"{submission.get('alias', 'anonymous')} | "
                f"{float(submission.get('average_score', 0.0)):.2f}/5 "
                f"from {int(submission.get('vote_count', 0))} vote(s)"
            )
        return "\n".join(lines)

    def _experience_refresh_remix_for_album(
        album_json: str, remix_state_json: str
    ) -> tuple[GradioUpdate, GradioUpdate, str]:
        album = _current_album(album_json)
        if album is None:
            return (
                gr.update(choices=[], value=None),
                gr.update(choices=[], value=None),
                "Generate or load an album to use remix battles.",
            )
        registry = _load_remix_registry(remix_state_json)
        battle_choices = _battle_choice_pairs(registry, str(album.id))
        if not battle_choices:
            return (
                gr.update(choices=[], value=None),
                gr.update(choices=[], value=None),
                "No remix battles yet for this album. Create one to start.",
            )
        selected_battle_id = battle_choices[0][1]
        battle_payload = registry["battles"].get(selected_battle_id, {})
        submission_choices = _submission_choice_pairs(battle_payload)
        default_submission = submission_choices[0][1] if submission_choices else None
        return (
            gr.update(choices=battle_choices, value=selected_battle_id),
            gr.update(choices=submission_choices, value=default_submission),
            _format_remix_summary(battle_payload),
        )

    def _experience_select_remix_battle(
        album_json: str,
        remix_state_json: str,
        battle_id: str | None,
    ) -> tuple[GradioUpdate, str]:
        album = _current_album(album_json)
        if album is None:
            return gr.update(choices=[], value=None), "Generate or load an album first."
        if not battle_id:
            return gr.update(choices=[], value=None), "Select a remix battle."
        registry = _load_remix_registry(remix_state_json)
        battle = registry.get("battles", {}).get(battle_id)
        if not isinstance(battle, dict) or battle.get("album_id") != str(album.id):
            return gr.update(choices=[], value=None), "Selected remix battle is unavailable."
        submission_choices = _submission_choice_pairs(battle)
        default_submission = submission_choices[0][1] if submission_choices else None
        return (
            gr.update(choices=submission_choices, value=default_submission),
            _format_remix_summary(battle),
        )

    def _experience_create_remix_battle(
        album_json: str,
        remix_state_json: str,
        alias: str,
        title: str,
        prompt: str,
    ) -> tuple[str, str, GradioUpdate, GradioUpdate]:
        album = _current_album(album_json)
        if album is None:
            message = "Generate or load an album first."
            return message, remix_state_json, gr.update(), gr.update()
        alias_value = alias.strip()
        title_value = title.strip()
        prompt_value = prompt.strip()
        if len(alias_value) < 2:
            message = "Host alias must be at least 2 characters."
            return message, remix_state_json, gr.update(), gr.update()
        if len(title_value) < 3:
            message = "Battle title must be at least 3 characters."
            return message, remix_state_json, gr.update(), gr.update()
        if len(prompt_value) < 8:
            message = "Battle prompt must be at least 8 characters."
            return message, remix_state_json, gr.update(), gr.update()

        now = datetime.utcnow().isoformat()
        battle_id = f"battle_{uuid4().hex[:12]}"
        share_slug = f"{_slugify(title_value)}-{uuid4().hex[:6]}"
        battle = {
            "id": battle_id,
            "album_id": str(album.id),
            "title": title_value,
            "prompt": prompt_value,
            "status": "open",
            "created_by": alias_value,
            "share_slug": share_slug,
            "submissions": [],
            "created_at": now,
            "updated_at": now,
        }
        registry = _load_remix_registry(remix_state_json)
        registry["battles"][battle_id] = battle
        updated_state = _dump_remix_registry(registry)
        battle_choices = _battle_choice_pairs(registry, str(album.id))
        _track_event(
            Events.UI_FEATURE_USED,
            {
                "feature": "experience_remix_create",
                "album_id": str(album.id),
                "battle_id": battle_id,
            },
        )
        return (
            _format_remix_summary(battle),
            updated_state,
            gr.update(choices=battle_choices, value=battle_id),
            gr.update(choices=[], value=None),
        )

    def _experience_submit_remix_entry(
        album_json: str,
        remix_state_json: str,
        battle_id: str | None,
        alias: str,
        title: str,
        concept: str,
        preview_hook: str,
    ) -> tuple[str, str, GradioUpdate]:
        album = _current_album(album_json)
        if album is None:
            message = "Generate or load an album first."
            return message, remix_state_json, gr.update()
        if not battle_id:
            message = "Select a remix battle."
            return message, remix_state_json, gr.update()

        registry = _load_remix_registry(remix_state_json)
        battle = registry["battles"].get(battle_id)
        if not isinstance(battle, dict) or battle.get("album_id") != str(album.id):
            message = "Selected remix battle is unavailable."
            return message, remix_state_json, gr.update()
        if battle.get("status") != "open":
            message = "This remix battle is closed."
            return message, remix_state_json, gr.update()

        alias_value = alias.strip()
        title_value = title.strip()
        concept_value = concept.strip()
        preview_value = preview_hook.strip() if preview_hook else ""
        if len(alias_value) < 2:
            message = "Submission alias must be at least 2 characters."
            return message, remix_state_json, gr.update()
        if len(title_value) < 3:
            message = "Submission title must be at least 3 characters."
            return message, remix_state_json, gr.update()
        if len(concept_value) < 8:
            message = "Submission concept must be at least 8 characters."
            return message, remix_state_json, gr.update()

        now = datetime.utcnow().isoformat()
        submissions_payload = battle.get("submissions")
        submissions: list[dict[str, Any]]
        if isinstance(submissions_payload, list):
            submissions = [item for item in submissions_payload if isinstance(item, dict)]
        else:
            submissions = []

        existing = next(
            (
                submission
                for submission in submissions
                if str(submission.get("alias", "")).strip().lower() == alias_value.lower()
            ),
            None,
        )
        if existing:
            existing["title"] = title_value
            existing["concept"] = concept_value
            existing["preview_hook"] = preview_value or None
            existing["created_at"] = now
        else:
            submissions.append(
                {
                    "id": f"entry_{uuid4().hex[:10]}",
                    "alias": alias_value,
                    "title": title_value,
                    "concept": concept_value,
                    "preview_hook": preview_value or None,
                    "created_at": now,
                    "votes": [],
                    "average_score": 0.0,
                    "vote_count": 0,
                }
            )
        for submission in submissions:
            _refresh_submission_stats(submission)
        battle["submissions"] = _sort_submissions(submissions)
        battle["updated_at"] = now
        registry["battles"][battle_id] = battle
        updated_state = _dump_remix_registry(registry)
        submission_choices = _submission_choice_pairs(battle)
        default_submission = submission_choices[0][1] if submission_choices else None
        _track_event(
            Events.UI_FEATURE_USED,
            {
                "feature": "experience_remix_submit",
                "album_id": str(album.id),
                "battle_id": battle_id,
            },
        )
        return (
            _format_remix_summary(battle),
            updated_state,
            gr.update(choices=submission_choices, value=default_submission),
        )

    def _experience_vote_remix_entry(
        album_json: str,
        remix_state_json: str,
        battle_id: str | None,
        submission_id: str | None,
        alias: str,
        score: float,
    ) -> tuple[str, str, GradioUpdate]:
        album = _current_album(album_json)
        if album is None:
            message = "Generate or load an album first."
            return message, remix_state_json, gr.update()
        if not battle_id:
            message = "Select a remix battle."
            return message, remix_state_json, gr.update()
        if not submission_id:
            message = "Select a remix submission to vote."
            return message, remix_state_json, gr.update()

        registry = _load_remix_registry(remix_state_json)
        battle = registry["battles"].get(battle_id)
        if not isinstance(battle, dict) or battle.get("album_id") != str(album.id):
            message = "Selected remix battle is unavailable."
            return message, remix_state_json, gr.update()
        if battle.get("status") != "open":
            message = "This remix battle is closed."
            return message, remix_state_json, gr.update()

        alias_value = alias.strip()
        if len(alias_value) < 2:
            message = "Vote alias must be at least 2 characters."
            return message, remix_state_json, gr.update()
        score_value = int(score)
        if score_value < 1 or score_value > 5:
            message = "Vote score must be between 1 and 5."
            return message, remix_state_json, gr.update()

        submissions_payload = battle.get("submissions")
        submissions: list[dict[str, Any]] = []
        if isinstance(submissions_payload, list):
            for submission in submissions_payload:
                if isinstance(submission, dict):
                    submissions.append(submission)
        target_submission = next(
            (submission for submission in submissions if submission.get("id") == submission_id),
            None,
        )
        if target_submission is None:
            message = "Selected remix submission was not found."
            return message, remix_state_json, gr.update()

        votes_payload = target_submission.get("votes")
        votes: list[dict[str, Any]]
        if isinstance(votes_payload, list):
            votes = [item for item in votes_payload if isinstance(item, dict)]
        else:
            votes = []

        new_vote = {
            "alias": alias_value,
            "score": score_value,
            "created_at": datetime.utcnow().isoformat(),
        }
        existing_vote = next(
            (
                index
                for index, vote in enumerate(votes)
                if str(vote.get("alias", "")).strip().lower() == alias_value.lower()
            ),
            None,
        )
        if existing_vote is None:
            votes.append(new_vote)
        else:
            votes[existing_vote] = new_vote
        target_submission["votes"] = votes
        _refresh_submission_stats(target_submission)
        battle["submissions"] = _sort_submissions(submissions)
        battle["updated_at"] = datetime.utcnow().isoformat()
        registry["battles"][battle_id] = battle
        updated_state = _dump_remix_registry(registry)
        submission_choices = _submission_choice_pairs(battle)
        _track_event(
            Events.UI_FEATURE_USED,
            {"feature": "experience_remix_vote", "album_id": str(album.id), "battle_id": battle_id},
        )
        return (
            _format_remix_summary(battle),
            updated_state,
            gr.update(choices=submission_choices, value=submission_id),
        )

    def _experience_close_remix_battle(
        album_json: str,
        remix_state_json: str,
        battle_id: str | None,
        alias: str,
    ) -> tuple[str, str, GradioUpdate]:
        album = _current_album(album_json)
        if album is None:
            message = "Generate or load an album first."
            return message, remix_state_json, gr.update()
        if not battle_id:
            message = "Select a remix battle."
            return message, remix_state_json, gr.update()

        registry = _load_remix_registry(remix_state_json)
        battle = registry["battles"].get(battle_id)
        if not isinstance(battle, dict) or battle.get("album_id") != str(album.id):
            message = "Selected remix battle is unavailable."
            return message, remix_state_json, gr.update()

        alias_value = alias.strip().lower()
        owner = str(battle.get("created_by", "")).strip().lower()
        if alias_value != owner:
            message = "Only the battle creator can close this remix battle."
            return message, remix_state_json, gr.update()

        battle["status"] = "closed"
        battle["updated_at"] = datetime.utcnow().isoformat()
        registry["battles"][battle_id] = battle
        updated_state = _dump_remix_registry(registry)
        battle_choices = _battle_choice_pairs(registry, str(album.id))
        _track_event(
            Events.UI_FEATURE_USED,
            {
                "feature": "experience_remix_close",
                "album_id": str(album.id),
                "battle_id": battle_id,
            },
        )
        return (
            _format_remix_summary(battle),
            updated_state,
            gr.update(choices=battle_choices, value=battle_id),
        )

    def _experience_public_remix_summary(
        album_json: str, remix_state_json: str, battle_id: str | None
    ) -> str:
        album = _current_album(album_json)
        if album is None:
            return "Generate or load an album first."
        if not battle_id:
            return "Select a remix battle."
        registry = _load_remix_registry(remix_state_json)
        battle = registry["battles"].get(battle_id)
        if not isinstance(battle, dict) or battle.get("album_id") != str(album.id):
            return "Selected remix battle is unavailable."
        share_slug = str(battle.get("share_slug", ""))
        share_path = f"/api/v1/experience/remix-battles/share/{share_slug}" if share_slug else ""
        summary = _format_remix_summary(battle)
        if not share_path:
            return summary
        return "\n".join([summary, "", f"Public API path: {share_path}"])

    def _experience_generate_daw_handoff(
        album_json: str,
        project_dir: str,
        daw_targets: list[str],
        bpm_strategy: str,
        fixed_bpm: float | None,
        include_midi_guides: bool,
        package_name: str,
    ) -> tuple[str | None, str]:
        album = _current_album(album_json)
        if album is None:
            return None, "Generate or load an album first."

        targets = []
        for item in daw_targets:
            normalized = item.strip().lower()
            if normalized and normalized not in targets:
                targets.append(normalized)
        if not targets:
            targets = ["ableton", "logic"]
        invalid = [target for target in targets if target not in {"ableton", "logic"}]
        if invalid:
            return None, f"Unsupported DAW target(s): {', '.join(invalid)}"

        tempos = [song.tempo for song in album.songs if song.tempo]
        strategy = bpm_strategy.strip().lower()
        if strategy == "fixed":
            if fixed_bpm is None:
                return None, "Set Fixed BPM when BPM strategy is 'fixed'."
            recommended_bpm = int(fixed_bpm)
            if recommended_bpm < 40 or recommended_bpm > 240:
                return None, "Fixed BPM must be between 40 and 240."
        else:
            recommended_bpm = int(median(tempos)) if tempos else 120

        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        package_label = (
            package_name.strip() if package_name and package_name.strip() else album.title
        )
        base_dir = _ensure_project_dir(project_dir, album.title) / "experience" / "daw_handoff"
        bundle_dir = base_dir / f"{_slugify(package_label)}_{timestamp}"
        bundle_dir.mkdir(parents=True, exist_ok=True)
        files: list[str] = []

        def _seed_progression(song: Song) -> list[str]:
            for section in song.sections:
                if section.chord_progression:
                    return section.chord_progression[:4]
            return ["C", "G", "Am", "F"]

        def _write_text(name: str, content: str) -> None:
            target = bundle_dir / name
            target.write_text(content.strip() + "\n")
            files.append(name)

        def _write_json(name: str, payload: dict[str, Any]) -> None:
            target = bundle_dir / name
            target.write_text(json.dumps(payload, indent=2))
            files.append(name)

        _write_text(
            "README.txt",
            (
                f"DAW Handoff Pack for {album.title}\n"
                f"Targets: {', '.join(targets)}\n"
                f"Recommended BPM: {recommended_bpm}\n"
                f"Generated: {datetime.utcnow().isoformat()}"
            ),
        )

        release_kit_summary = _experience_release_kit(album_json)
        _write_json(
            "release_kit.json",
            {"album_id": str(album.id), "album_title": album.title, "summary": release_kit_summary},
        )

        key_centers = sorted({song.key for song in album.songs if song.key})[:3]
        analyzer_payload = {
            "median_tempo": recommended_bpm,
            "tempo_range": [
                min(tempos) if tempos else recommended_bpm,
                max(tempos) if tempos else recommended_bpm,
            ],
            "key_centers": key_centers,
            "arrangement_cues": [
                "Keep hook motifs consistent across choruses.",
                "Reserve density lift for late-arrangement transitions.",
                "Use one signature texture in every track.",
            ],
        }
        _write_json("reference_analyzer.json", analyzer_payload)

        map_path = bundle_dir / "arrangement_map.csv"
        with map_path.open("w", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(["track_number", "title", "tempo", "key", "progression_seed"])
            for song in sorted(album.songs, key=lambda item: item.track_number):
                writer.writerow(
                    [
                        song.track_number,
                        song.title,
                        song.tempo or recommended_bpm,
                        song.key or "C major",
                        "-".join(_seed_progression(song)),
                    ]
                )
        files.append("arrangement_map.csv")

        if "ableton" in targets:
            _write_json(
                "ableton_live_template.json",
                {
                    "daw": "ableton_live",
                    "recommended_bpm": recommended_bpm,
                    "tracks": [
                        {
                            "track_number": song.track_number,
                            "name": song.title,
                            "key": song.key or "C major",
                            "guide_progression": _seed_progression(song),
                        }
                        for song in sorted(album.songs, key=lambda item: item.track_number)
                    ],
                },
            )

        if "logic" in targets:
            _write_json(
                "logic_pro_template.json",
                {
                    "daw": "logic_pro",
                    "recommended_bpm": recommended_bpm,
                    "track_stacks": [
                        {
                            "track_number": song.track_number,
                            "name": song.title,
                            "guide_progression": _seed_progression(song),
                        }
                        for song in sorted(album.songs, key=lambda item: item.track_number)
                    ],
                },
            )

        if include_midi_guides:
            try:
                from album_conceptualizer.export.midi import MidiExporter
            except ImportError:
                _write_text(
                    "midi_guides_unavailable.txt",
                    "MIDI dependencies are missing. Install with `pip install .[music]`.",
                )
            else:
                exporter = MidiExporter(default_tempo=recommended_bpm)
                for song in sorted(album.songs, key=lambda item: item.track_number):
                    midi_name = f"{song.track_number:02d}_{_slugify(song.title)}_guide.mid"
                    exporter.export_from_symbols(
                        _seed_progression(song),
                        bundle_dir / midi_name,
                        tempo=recommended_bpm,
                    )
                    files.append(midi_name)

        zip_path = bundle_dir.with_suffix(".zip")
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for file_name in files:
                archive.write(bundle_dir / file_name, arcname=file_name)

        _track_event(
            Events.UI_FEATURE_USED,
            {
                "feature": "experience_daw_handoff",
                "album_id": str(album.id),
                "targets": ",".join(targets),
            },
        )
        summary = "\n".join(
            [
                f"Generated DAW handoff pack for '{album.title}'.",
                f"Targets: {', '.join(targets)}",
                f"Recommended BPM: {recommended_bpm}",
                f"Bundle directory: {bundle_dir}",
                f"Zip bundle: {zip_path}",
            ]
        )
        return str(zip_path), summary

    def _experience_build_realtime_playbook(
        album_json: str,
        api_base: str,
        room_id: str,
        alias: str,
        target: str,
        force: bool,
    ) -> str:
        album = _current_album(album_json)
        if album is None:
            return "Generate or load an album first."
        room_value = room_id.strip()
        if not room_value:
            return "Set a room ID from the collab room API response."
        alias_value = alias.strip() or "host"
        target_value = target.strip() or "track:1:chorus"

        base = api_base.strip() or "http://127.0.0.1:8000"
        if base.startswith("https://"):
            ws_base = "wss://" + base[len("https://") :]
        elif base.startswith("http://"):
            ws_base = "ws://" + base[len("http://") :]
        elif base.startswith("ws://") or base.startswith("wss://"):
            ws_base = base
        else:
            ws_base = f"ws://{base}"
        ws_base = ws_base.rstrip("/")
        ws_url = (
            f"{ws_base}/api/v1/albums/{album.id}/experience/collab-rooms/"
            f"{room_value}/ws?alias={alias_value}"
        )

        claim_payload = {"type": "claim_edit", "target": target_value, "force": force}
        release_payload = {"type": "release_edit", "target": target_value}
        typing_start_payload = {"type": "typing_start", "target": target_value}
        typing_stop_payload = {"type": "typing_stop", "target": target_value}
        lines = [
            f"Websocket URL: {ws_url}",
            "",
            "Claim payload:",
            json.dumps(claim_payload, indent=2),
            "",
            "Release payload:",
            json.dumps(release_payload, indent=2),
            "",
            "Typing start payload:",
            json.dumps(typing_start_payload, indent=2),
            "",
            "Typing stop payload:",
            json.dumps(typing_stop_payload, indent=2),
            "",
            "Heartbeat payload:",
            json.dumps({"type": "heartbeat"}, indent=2),
        ]
        _track_event(
            Events.UI_FEATURE_USED,
            {"feature": "experience_realtime_playbook", "album_id": str(album.id)},
        )
        return "\n".join(lines)

    album_state.change(
        fn=_experience_refresh_remix_for_album,
        inputs=[album_state, experience_remix_state],
        outputs=[
            experience_components["remix_battle_id"],
            experience_components["remix_submission_id"],
            experience_components["remix_output"],
        ],
    )

    experience_components["remix_battle_id"].change(
        fn=_experience_select_remix_battle,
        inputs=[album_state, experience_remix_state, experience_components["remix_battle_id"]],
        outputs=[
            experience_components["remix_submission_id"],
            experience_components["remix_output"],
        ],
    )

    experience_components["remix_create_btn"].click(
        fn=_experience_create_remix_battle,
        inputs=[
            album_state,
            experience_remix_state,
            experience_components["remix_alias"],
            experience_components["remix_title"],
            experience_components["remix_prompt"],
        ],
        outputs=[
            experience_components["remix_output"],
            experience_remix_state,
            experience_components["remix_battle_id"],
            experience_components["remix_submission_id"],
        ],
    )

    experience_components["remix_submit_btn"].click(
        fn=_experience_submit_remix_entry,
        inputs=[
            album_state,
            experience_remix_state,
            experience_components["remix_battle_id"],
            experience_components["remix_submission_alias"],
            experience_components["remix_submission_title"],
            experience_components["remix_submission_concept"],
            experience_components["remix_preview_hook"],
        ],
        outputs=[
            experience_components["remix_output"],
            experience_remix_state,
            experience_components["remix_submission_id"],
        ],
    )

    experience_components["remix_vote_btn"].click(
        fn=_experience_vote_remix_entry,
        inputs=[
            album_state,
            experience_remix_state,
            experience_components["remix_battle_id"],
            experience_components["remix_submission_id"],
            experience_components["remix_vote_alias"],
            experience_components["remix_vote_score"],
        ],
        outputs=[
            experience_components["remix_output"],
            experience_remix_state,
            experience_components["remix_submission_id"],
        ],
    )

    experience_components["remix_close_btn"].click(
        fn=_experience_close_remix_battle,
        inputs=[
            album_state,
            experience_remix_state,
            experience_components["remix_battle_id"],
            experience_components["remix_close_alias"],
        ],
        outputs=[
            experience_components["remix_output"],
            experience_remix_state,
            experience_components["remix_battle_id"],
        ],
    )

    experience_components["remix_public_btn"].click(
        fn=_experience_public_remix_summary,
        inputs=[album_state, experience_remix_state, experience_components["remix_battle_id"]],
        outputs=[experience_components["remix_output"]],
    )

    experience_components["daw_generate_btn"].click(
        fn=_experience_generate_daw_handoff,
        inputs=[
            album_state,
            quickstart_components["project_dir"],
            experience_components["daw_targets"],
            experience_components["daw_bpm_strategy"],
            experience_components["daw_fixed_bpm"],
            experience_components["daw_include_midi_guides"],
            experience_components["daw_package_name"],
        ],
        outputs=[
            experience_components["daw_download"],
            experience_components["daw_output"],
        ],
    )

    experience_components["realtime_build_btn"].click(
        fn=_experience_build_realtime_playbook,
        inputs=[
            album_state,
            experience_components["realtime_api_base"],
            experience_components["realtime_room_id"],
            experience_components["realtime_alias"],
            experience_components["realtime_target"],
            experience_components["realtime_force"],
        ],
        outputs=[experience_components["realtime_output"]],
    )


def _get_custom_css() -> str:
    """Get custom CSS for the application."""
    return """
    .gradio-container {
        --neu-bg: #e9eef5;
        --neu-surface: #eef3fa;
        --neu-surface-strong: #f4f7fc;
        --neu-text: #2f3b4d;
        --neu-muted: #617086;
        --neu-accent: #3b79cc;
        --neu-accent-soft: #d8e8ff;
        --neu-shadow-light: rgba(255, 255, 255, 0.95);
        --neu-shadow-dark: rgba(158, 173, 195, 0.5);
        --neu-shadow-inset-dark: rgba(155, 171, 194, 0.35);
        --neu-shadow-inset-light: rgba(255, 255, 255, 0.95);
        --neu-radius-lg: 18px;
        --neu-radius-md: 12px;
        max-width: 1400px !important;
        font-family: "Avenir Next", "Nunito Sans", "Segoe UI", sans-serif;
        color: var(--neu-text);
        background:
            radial-gradient(circle at 12% 8%, rgba(255, 255, 255, 0.65), transparent 36%),
            radial-gradient(circle at 86% 2%, rgba(220, 234, 255, 0.55), transparent 34%),
            var(--neu-bg);
    }

    .gradio-container .prose,
    .gradio-container h1,
    .gradio-container h2,
    .gradio-container h3,
    .gradio-container h4,
    .gradio-container h5,
    .gradio-container p,
    .gradio-container li,
    .gradio-container label,
    .gradio-container span,
    .gradio-container div {
        color: var(--neu-text);
    }

    .gradio-container a {
        color: var(--neu-accent);
    }

    .gradio-container .gr-box,
    .gradio-container .gr-group,
    .gradio-container .gr-panel,
    .gradio-container .block {
        border-radius: var(--neu-radius-lg) !important;
        border: 1px solid rgba(255, 255, 255, 0.6) !important;
        background: var(--neu-surface) !important;
        box-shadow:
            10px 10px 24px var(--neu-shadow-dark),
            -10px -10px 24px var(--neu-shadow-light) !important;
    }

    .gradio-container .tab-nav {
        border-radius: var(--neu-radius-md) !important;
        padding: 6px !important;
        background: var(--neu-surface) !important;
        box-shadow:
            inset 5px 5px 10px var(--neu-shadow-inset-dark),
            inset -5px -5px 10px var(--neu-shadow-inset-light) !important;
    }

    .gradio-container .tab-nav button {
        border-radius: 10px !important;
        border: 0 !important;
        background: transparent !important;
        color: var(--neu-muted) !important;
        transition: all 0.2s ease;
    }

    .gradio-container .tab-nav button[aria-selected="true"],
    .gradio-container .tab-nav button.selected {
        color: var(--neu-accent) !important;
        background: var(--neu-surface-strong) !important;
        box-shadow:
            6px 6px 14px var(--neu-shadow-dark),
            -6px -6px 14px var(--neu-shadow-light) !important;
    }

    .gradio-container input,
    .gradio-container textarea,
    .gradio-container select,
    .gradio-container .gr-dataframe,
    .gradio-container .gr-file {
        color: var(--neu-text) !important;
        border-radius: var(--neu-radius-md) !important;
        border: 1px solid rgba(255, 255, 255, 0.7) !important;
        background: var(--neu-surface-strong) !important;
        box-shadow:
            inset 5px 5px 10px var(--neu-shadow-inset-dark),
            inset -5px -5px 10px var(--neu-shadow-inset-light) !important;
    }

    .gradio-container input::placeholder,
    .gradio-container textarea::placeholder {
        color: #8a96aa !important;
    }

    .gradio-container input:focus,
    .gradio-container textarea:focus,
    .gradio-container select:focus {
        outline: none !important;
        box-shadow:
            inset 4px 4px 9px var(--neu-shadow-inset-dark),
            inset -4px -4px 9px var(--neu-shadow-inset-light),
            0 0 0 2px rgba(59, 121, 204, 0.28) !important;
    }

    .gradio-container button {
        border-radius: var(--neu-radius-md) !important;
        border: 1px solid rgba(255, 255, 255, 0.72) !important;
        background: linear-gradient(140deg, #edf3fb, #dfe9f6) !important;
        color: var(--neu-text) !important;
        box-shadow:
            7px 7px 14px var(--neu-shadow-dark),
            -7px -7px 14px var(--neu-shadow-light) !important;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .gradio-container button.primary,
    .gradio-container button[variant="primary"] {
        background: linear-gradient(145deg, #5f9be8, #3b79cc) !important;
        color: #f5f9ff !important;
        box-shadow:
            7px 7px 14px rgba(124, 146, 173, 0.52),
            -7px -7px 14px rgba(255, 255, 255, 0.82) !important;
    }

    .gradio-container button:hover {
        transform: translateY(-1px);
    }

    .gradio-container button:active {
        transform: translateY(0);
        box-shadow:
            inset 4px 4px 10px var(--neu-shadow-inset-dark),
            inset -4px -4px 10px var(--neu-shadow-inset-light) !important;
    }

    .gradio-container table {
        border-collapse: separate !important;
        border-spacing: 0 !important;
        border-radius: var(--neu-radius-md) !important;
        overflow: hidden !important;
    }

    .gradio-container th,
    .gradio-container td {
        border-color: rgba(208, 220, 239, 0.8) !important;
        background: rgba(241, 246, 254, 0.72) !important;
        color: var(--neu-text) !important;
    }

    .chord-button {
        min-width: 60px !important;
        font-family: monospace !important;
    }

    .section-header,
    .song-card,
    .motif-tag,
    .theme-tag {
        border-radius: var(--neu-radius-md);
        border: 1px solid rgba(255, 255, 255, 0.6);
        background: var(--neu-surface-strong);
        box-shadow:
            6px 6px 14px var(--neu-shadow-dark),
            -6px -6px 14px var(--neu-shadow-light);
    }

    .section-header {
        padding: 8px 12px;
        margin-bottom: 8px;
    }

    .song-card {
        padding: 12px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .song-card:hover {
        box-shadow:
            inset 4px 4px 9px var(--neu-shadow-inset-dark),
            inset -4px -4px 9px var(--neu-shadow-inset-light);
    }

    .motif-tag,
    .theme-tag {
        display: inline-block;
        font-size: 0.85em;
        margin-right: 4px;
        padding: 2px 8px;
    }

    .motif-tag {
        color: #2e5c98;
    }

    .theme-tag {
        color: #365483;
    }

    @media (max-width: 768px) {
        .gradio-container {
            padding: 10px !important;
        }

        .gradio-container .gr-box,
        .gradio-container .gr-group,
        .gradio-container .gr-panel,
        .gradio-container .block {
            border-radius: 14px !important;
            box-shadow:
                6px 6px 14px var(--neu-shadow-dark),
                -6px -6px 14px var(--neu-shadow-light) !important;
        }

        .gradio-container .tab-nav {
            overflow-x: auto;
            white-space: nowrap;
        }
    }
    """


def launch_app(
    share: bool = False,
    debug: bool = False,
    server_port: int = 7860,
    server_name: str = "127.0.0.1",
) -> None:
    """
    Launch the Gradio application.

    Args:
        share: Whether to create a public share link
        debug: Whether to enable debug mode
        server_port: Port to run the server on
        server_name: Server hostname
    """
    app = create_app(share=share, debug=debug)
    app.launch(
        share=share,
        debug=debug,
        server_port=server_port,
        server_name=server_name,
        theme=gr.themes.Soft(
            primary_hue="blue",
            secondary_hue="slate",
        ),
        css=_get_custom_css(),
    )


if __name__ == "__main__":
    launch_app(debug=True)
