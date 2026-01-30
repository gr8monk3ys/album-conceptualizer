"""Gradio UI components for Album Conceptualizer."""

import gradio as gr


def create_album_canvas() -> dict:
    """
    Create the Album Canvas component.

    The Album Canvas provides a high-level overview of the album,
    including tracklist, themes, and narrative arc visualization.
    """
    components = {}

    with gr.Row():
        # Left sidebar - Album info
        with gr.Column(scale=1), gr.Group():
            gr.Markdown("### Album Details")

            components["album_title"] = gr.Textbox(
                label="Album Title",
                placeholder="Enter album title...",
            )

            components["artist_name"] = gr.Textbox(
                label="Artist",
                placeholder="Enter artist name...",
            )

            components["concept_summary"] = gr.Textbox(
                label="Concept Summary",
                placeholder="Brief description of the album concept...",
                lines=4,
            )

            components["primary_genre"] = gr.Dropdown(
                choices=[
                    "Rock",
                    "Progressive Rock",
                    "Art Rock",
                    "Pop",
                    "Indie Pop",
                    "Synth Pop",
                    "Hip Hop",
                    "R&B",
                    "Soul",
                    "Electronic",
                    "Ambient",
                    "Industrial",
                    "Folk",
                    "Country",
                    "Americana",
                    "Metal",
                    "Punk",
                    "Alternative",
                    "Jazz",
                    "Blues",
                    "Classical",
                    "Other",
                ],
                label="Primary Genre",
                allow_custom_value=True,
            )

            components["era_influence"] = gr.Textbox(
                label="Era/Style Influence",
                placeholder="e.g., 1970s prog rock, 90s alternative...",
            )

        # Center - Tracklist
        with gr.Column(scale=2):
            with gr.Group():
                gr.Markdown("### Tracklist")

                components["tracklist_display"] = gr.Dataframe(
                    headers=["#", "Title", "Key", "Tempo", "Narrative Position"],
                    datatype=["number", "str", "str", "number", "str"],
                    row_count=(10, "dynamic"),
                    col_count=(5, "fixed"),
                    interactive=True,
                    label="Songs",
                )

                with gr.Row():
                    components["add_song_btn"] = gr.Button("+ Add Song", size="sm")
                    components["remove_song_btn"] = gr.Button("- Remove", size="sm")
                    components["reorder_btn"] = gr.Button("Reorder", size="sm")

            # Narrative arc visualization placeholder
            with gr.Group():
                gr.Markdown("### Narrative Arc")
                gr.Markdown("*Visualization of the album's emotional/narrative journey*")

                components["arc_visualization"] = gr.Plot(
                    label="Album Arc",
                    show_label=False,
                )

        # Right sidebar - Themes and References
        with gr.Column(scale=1):
            with gr.Group():
                gr.Markdown("### Central Themes")
                components["themes_list"] = gr.Dataframe(
                    headers=["Theme", "Description"],
                    datatype=["str", "str"],
                    row_count=(5, "dynamic"),
                    interactive=True,
                )

            with gr.Group():
                gr.Markdown("### Recurring Motifs")
                components["motifs_list"] = gr.Dataframe(
                    headers=["Motif", "Type", "Appearances"],
                    datatype=["str", "str", "number"],
                    row_count=(5, "dynamic"),
                    interactive=True,
                )

            with gr.Group():
                gr.Markdown("### Reference Albums")
                components["references"] = gr.Textbox(
                    label="",
                    placeholder="Add reference albums...",
                    lines=4,
                )

    return components


def create_song_editor() -> dict:
    """
    Create the Song Editor component.

    The Song Editor provides detailed editing for individual songs,
    including lyrics, chord progressions, and section management.
    """
    components = {}

    with gr.Row():
        # Song selector sidebar
        with gr.Column(scale=1):
            gr.Markdown("### Songs")

            components["song_selector"] = gr.Dropdown(
                choices=[],
                label="Select Song",
                interactive=True,
            )

            with gr.Group():
                components["song_title_edit"] = gr.Textbox(
                    label="Title",
                )
                components["track_number"] = gr.Number(
                    label="Track #",
                    minimum=1,
                    precision=0,
                )
                components["song_key"] = gr.Dropdown(
                    choices=[
                        "C major",
                        "C minor",
                        "C# major",
                        "C# minor",
                        "D major",
                        "D minor",
                        "Eb major",
                        "Eb minor",
                        "E major",
                        "E minor",
                        "F major",
                        "F minor",
                        "F# major",
                        "F# minor",
                        "G major",
                        "G minor",
                        "Ab major",
                        "Ab minor",
                        "A major",
                        "A minor",
                        "Bb major",
                        "Bb minor",
                        "B major",
                        "B minor",
                    ],
                    label="Key",
                    allow_custom_value=True,
                )
                components["song_tempo"] = gr.Slider(
                    minimum=40,
                    maximum=220,
                    value=120,
                    step=1,
                    label="Tempo (BPM)",
                )
                components["time_signature"] = gr.Dropdown(
                    choices=["4/4", "3/4", "6/8", "2/4", "5/4", "7/8"],
                    value="4/4",
                    label="Time Signature",
                )

            with gr.Group():
                gr.Markdown("### Narrative")
                components["narrative_position"] = gr.Dropdown(
                    choices=[
                        "Opening/Exposition",
                        "Inciting Incident",
                        "Rising Action",
                        "Midpoint",
                        "Complications",
                        "Climax",
                        "Falling Action",
                        "Resolution",
                        "Epilogue",
                    ],
                    label="Position in Story",
                )
                components["narrative_summary"] = gr.Textbox(
                    label="What happens",
                    placeholder="Brief summary of this song's story...",
                    lines=3,
                )

        # Main editor area
        with gr.Column(scale=3), gr.Tabs():
            # Lyrics tab
            with gr.Tab("Lyrics"):
                components["section_selector"] = gr.Dropdown(
                    choices=[
                        "Intro",
                        "Verse 1",
                        "Pre-Chorus",
                        "Chorus",
                        "Verse 2",
                        "Chorus 2",
                        "Bridge",
                        "Solo",
                        "Verse 3",
                        "Final Chorus",
                        "Outro",
                    ],
                    label="Section",
                    value="Verse 1",
                )

                with gr.Row():
                    components["lyrics_editor"] = gr.Textbox(
                        label="Lyrics",
                        placeholder="Enter lyrics for this section...",
                        lines=12,
                        max_lines=20,
                    )

                    with gr.Column(scale=1):
                        gr.Markdown("### AI Assist")
                        components["ai_prompt"] = gr.Textbox(
                            label="Instruction",
                            placeholder="e.g., Make it more metaphorical...",
                            lines=2,
                        )
                        components["ai_assist_btn"] = gr.Button(
                            "Generate Suggestions",
                            variant="secondary",
                        )
                        components["ai_suggestions"] = gr.Textbox(
                            label="Suggestions",
                            lines=8,
                            interactive=False,
                        )

            # Chords tab
            with gr.Tab("Chords"):
                gr.Markdown("### Chord Progression")

                components["chord_input"] = gr.Textbox(
                    label="Chords (space-separated)",
                    placeholder="e.g., Am F C G",
                )

                # Quick chord palette
                gr.Markdown("**Quick Add:**")
                with gr.Row():
                    for chord in ["C", "Dm", "Em", "F", "G", "Am"]:
                        gr.Button(chord, size="sm", elem_classes=["chord-button"])

                with gr.Row():
                    for chord in ["C7", "Dm7", "Em7", "Fmaj7", "G7", "Am7"]:
                        gr.Button(chord, size="sm", elem_classes=["chord-button"])

                components["chord_analysis"] = gr.Textbox(
                    label="Analysis",
                    lines=4,
                    interactive=False,
                )

            # Structure tab
            with gr.Tab("Structure"):
                gr.Markdown("### Song Structure")

                components["structure_editor"] = gr.Dataframe(
                    headers=["Order", "Section", "Duration (bars)", "Notes"],
                    datatype=["number", "str", "number", "str"],
                    row_count=(8, "dynamic"),
                    interactive=True,
                )

                with gr.Row():
                    components["add_section_btn"] = gr.Button("+ Add Section")
                    components["section_type_select"] = gr.Dropdown(
                        choices=[
                            "Intro",
                            "Verse",
                            "Pre-Chorus",
                            "Chorus",
                            "Post-Chorus",
                            "Bridge",
                            "Breakdown",
                            "Solo",
                            "Interlude",
                            "Outro",
                            "Tag",
                        ],
                        label="Section Type",
                        value="Verse",
                    )

            # Production tab
            with gr.Tab("Production"):
                gr.Markdown("### Production Notes")

                components["instrumentation"] = gr.CheckboxGroup(
                    choices=[
                        "Drums",
                        "Bass",
                        "Electric Guitar",
                        "Acoustic Guitar",
                        "Piano",
                        "Synth",
                        "Strings",
                        "Brass",
                        "Organ",
                        "Percussion",
                        "Background Vocals",
                        "Other",
                    ],
                    label="Instrumentation",
                )

                components["production_notes"] = gr.Textbox(
                    label="Notes",
                    placeholder="Production ideas, arrangement notes...",
                    lines=6,
                )

                components["reference_tracks"] = gr.Textbox(
                    label="Reference Tracks",
                    placeholder="Songs to reference for production style...",
                    lines=2,
                )

    return components


def create_album_bible_editor() -> dict:
    """
    Create the Album Bible editor component.

    The Album Bible is the central reference document containing
    all thematic, stylistic, and narrative guidelines.
    """
    components = {}

    with gr.Row():
        # Core concept column
        with gr.Column(scale=1), gr.Group():
            gr.Markdown("### Core Concept")

            components["logline"] = gr.Textbox(
                label="Logline",
                placeholder="One sentence that captures the album's essence...",
                lines=2,
            )

            components["synopsis"] = gr.Textbox(
                label="Synopsis",
                placeholder="Extended description of the album's story/concept...",
                lines=8,
            )

            components["setting"] = gr.Textbox(
                label="Setting",
                placeholder="Time and place of the story...",
            )

        # Characters and themes column
        with gr.Column(scale=1):
            with gr.Group():
                gr.Markdown("### Characters")

                components["characters_table"] = gr.Dataframe(
                    headers=["Name", "Role", "Description", "Arc"],
                    datatype=["str", "str", "str", "str"],
                    row_count=(4, "dynamic"),
                    interactive=True,
                )

            with gr.Group():
                gr.Markdown("### Themes")

                components["themes_table"] = gr.Dataframe(
                    headers=["Theme", "Description", "Primary Songs"],
                    datatype=["str", "str", "str"],
                    row_count=(4, "dynamic"),
                    interactive=True,
                )

        # Style and structure column
        with gr.Column(scale=1):
            with gr.Group():
                gr.Markdown("### Narrative Structure")

                components["structure_type"] = gr.Dropdown(
                    choices=[
                        "Hero's Journey",
                        "Three-Act Structure",
                        "Circular Narrative",
                        "Non-Linear/Fragmented",
                        "Episodic",
                        "Custom",
                    ],
                    label="Structure Type",
                )

                components["structure_beats"] = gr.Textbox(
                    label="Story Beats",
                    placeholder="Key moments in the narrative...",
                    lines=6,
                )

            with gr.Group():
                gr.Markdown("### Style Profile")

                components["style_genre"] = gr.Textbox(
                    label="Genre Definition",
                    placeholder="Primary genre and influences...",
                )

                components["style_references"] = gr.Textbox(
                    label="Reference Artists",
                    placeholder="Artists whose style to draw from...",
                    lines=2,
                )

                components["lyrical_voice"] = gr.Textbox(
                    label="Lyrical Voice",
                    placeholder="Describe the lyrical tone and style...",
                    lines=3,
                )

    # Bottom row - Motifs
    with gr.Row(), gr.Column(), gr.Group():
        gr.Markdown("### Recurring Motifs")

        components["motifs_table"] = gr.Dataframe(
            headers=["Name", "Type", "Description", "First Appearance", "Evolution"],
            datatype=["str", "str", "str", "str", "str"],
            row_count=(5, "dynamic"),
            interactive=True,
        )

    # Action buttons
    with gr.Row():
        components["save_bible_btn"] = gr.Button("Save Album Bible", variant="primary")
        components["load_bible_btn"] = gr.Button("Load Album Bible")
        components["export_bible_btn"] = gr.Button("Export as Markdown")
        components["ai_expand_btn"] = gr.Button("AI: Expand from Concept")

    return components


def create_chord_palette() -> dict:
    """
    Create the Chord Tools component.

    Provides chord progression suggestions, analysis, and
    common progression templates.
    """
    components = {}

    with gr.Row():
        # Chord palette
        with gr.Column(scale=1):
            with gr.Group():
                gr.Markdown("### Key Selection")

                components["key_root"] = gr.Dropdown(
                    choices=[
                        "C",
                        "C#/Db",
                        "D",
                        "D#/Eb",
                        "E",
                        "F",
                        "F#/Gb",
                        "G",
                        "G#/Ab",
                        "A",
                        "A#/Bb",
                        "B",
                    ],
                    value="C",
                    label="Root",
                )

                components["key_mode"] = gr.Dropdown(
                    choices=[
                        "Major (Ionian)",
                        "Minor (Aeolian)",
                        "Dorian",
                        "Phrygian",
                        "Lydian",
                        "Mixolydian",
                        "Locrian",
                    ],
                    value="Major (Ionian)",
                    label="Mode",
                )

            with gr.Group():
                gr.Markdown("### Diatonic Chords")
                gr.Markdown("*Chords that naturally occur in this key*")

                components["diatonic_display"] = gr.Dataframe(
                    headers=["Numeral", "Chord", "Function"],
                    datatype=["str", "str", "str"],
                    row_count=7,
                    interactive=False,
                )

        # Progression builder
        with gr.Column(scale=2):
            with gr.Group():
                gr.Markdown("### Progression Builder")

                components["progression_input"] = gr.Textbox(
                    label="Current Progression",
                    placeholder="Click chords below or type: Am F C G",
                    lines=2,
                )

                # Common progressions
                gr.Markdown("**Common Progressions:**")

                with gr.Accordion("Pop/Rock", open=True):
                    progressions = [
                        ("I - V - vi - IV", "Pop"),
                        ("I - IV - V - I", "Classic Rock"),
                        ("vi - IV - I - V", "Emotional Pop"),
                        ("I - vi - IV - V", "50s Doo-wop"),
                    ]
                    with gr.Row():
                        for prog, name in progressions:
                            gr.Button(f"{prog}\n({name})", size="sm")

                with gr.Accordion("Jazz", open=False):
                    progressions = [
                        ("ii - V - I", "Jazz Cadence"),
                        ("I - vi - ii - V", "Rhythm Changes"),
                        ("iii - vi - ii - V", "Circle of Fifths"),
                    ]
                    with gr.Row():
                        for prog, name in progressions:
                            gr.Button(f"{prog}\n({name})", size="sm")

                with gr.Accordion("Minor Key", open=False):
                    progressions = [
                        ("i - VI - III - VII", "Andalusian"),
                        ("i - iv - v - i", "Minor Classic"),
                        ("i - VII - VI - VII", "Aeolian Vamp"),
                    ]
                    with gr.Row():
                        for prog, name in progressions:
                            gr.Button(f"{prog}\n({name})", size="sm")

            with gr.Group():
                gr.Markdown("### Analysis")

                components["analysis_output"] = gr.Textbox(
                    label="Harmonic Analysis",
                    lines=6,
                    interactive=False,
                )

                with gr.Row():
                    components["analyze_btn"] = gr.Button("Analyze")
                    components["suggest_btn"] = gr.Button("Suggest Next Chord")
                    components["export_midi_btn"] = gr.Button("Export MIDI")

    return components


def create_export_panel() -> dict:
    """
    Create the Export panel component.

    Provides options for exporting the album in various formats.
    """
    components = {}

    gr.Markdown(
        """
        ## Export Your Album

        Export your concept album to various formats for use in
        other music software.
        """
    )

    with gr.Row():
        # Format selection
        with gr.Column(scale=1):
            with gr.Group():
                gr.Markdown("### Export Formats")

                components["format_midi"] = gr.Checkbox(
                    label="MIDI - Chord progressions",
                    value=True,
                    info="Universal format for DAWs",
                )

                components["format_chordpro"] = gr.Checkbox(
                    label="ChordPro - Lyrics with chords",
                    value=True,
                    info="For apps like OnSong, SongBook",
                )

                components["format_musicxml"] = gr.Checkbox(
                    label="MusicXML - Notation",
                    value=False,
                    info="For MuseScore, Finale, Sibelius",
                )

                components["format_json"] = gr.Checkbox(
                    label="JSON - Full data",
                    value=True,
                    info="Complete album data structure",
                )

                components["format_text"] = gr.Checkbox(
                    label="Text - Lyrics only",
                    value=False,
                    info="Plain text lyrics",
                )

            with gr.Group():
                gr.Markdown("### Options")

                components["export_all_songs"] = gr.Checkbox(
                    label="Export all songs",
                    value=True,
                )

                components["song_select"] = gr.Dropdown(
                    choices=[],
                    label="Or select specific songs",
                    multiselect=True,
                    visible=False,
                )

                components["include_production"] = gr.Checkbox(
                    label="Include production notes",
                    value=True,
                )

        # Export preview and action
        with gr.Column(scale=2):
            with gr.Group():
                gr.Markdown("### Export Preview")

                components["preview_output"] = gr.Textbox(
                    label="Files to be created",
                    lines=10,
                    interactive=False,
                )

            with gr.Row():
                components["preview_btn"] = gr.Button("Preview Export")
                components["export_btn"] = gr.Button(
                    "Export Album",
                    variant="primary",
                )

            components["download_output"] = gr.File(
                label="Download",
                visible=False,
            )

            components["status_output"] = gr.Textbox(
                label="Status",
                interactive=False,
            )

    return components
