"""Main Gradio application for Album Conceptualizer."""

import gradio as gr

from album_conceptualizer.ui.components import (
    create_album_bible_editor,
    create_album_canvas,
    create_chord_palette,
    create_export_panel,
    create_song_editor,
)


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
        theme=gr.themes.Soft(
            primary_hue="purple",
            secondary_hue="blue",
        ),
        css=_get_custom_css(),
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
        with gr.Tabs():
            # Tab 1: Album Canvas (Overview)
            with gr.Tab("Album Canvas", id="canvas"):
                create_album_canvas()

            # Tab 2: Album Bible
            with gr.Tab("Album Bible", id="bible"):
                create_album_bible_editor()

            # Tab 3: Song Editor
            with gr.Tab("Song Editor", id="editor"):
                create_song_editor()

            # Tab 4: Chord Tools
            with gr.Tab("Chord Tools", id="chords"):
                create_chord_palette()

            # Tab 5: Export
            with gr.Tab("Export", id="export"):
                create_export_panel()

            # Tab 6: AI Agents
            with gr.Tab("AI Agents", id="agents"):
                _create_agents_tab()

        # Footer
        gr.Markdown(
            """
            ---
            *Album Conceptualizer* | [GitHub](https://github.com/gr8monk3ys/album-conceptualizer) |
            Built with CrewAI, LangChain, and Gradio
            """
        )

    return app


def _create_agents_tab() -> None:
    """Create the AI Agents tab content."""
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

                run_button = gr.Button("Run Workflow", variant="primary")

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

            # Event handlers
            def run_workflow(
                workflow: str,
                concept: str,
                references: str,
                themes: str,
                tracks: int,
            ) -> tuple[str, str]:
                """Run the selected agent workflow."""
                if not concept:
                    return "Please provide an album concept.", "Error"

                # For now, return a placeholder response
                # In production, this would call the actual CrewAI agents
                return (
                    f"""
## Workflow: {workflow}

### Input Analysis
- **Concept:** {concept}
- **References:** {references}
- **Themes:** {themes}
- **Target Tracks:** {tracks}

### Agent Processing
[This would show real-time agent output in production]

The AI agents would now:
1. Analyze the concept and references
2. Develop narrative structure
3. Define style parameters
4. Create initial song outlines

**Note:** Connect your API keys in settings to enable AI processing.
""",
                    "Complete",
                )

            run_button.click(
                fn=run_workflow,
                inputs=[workflow_type, concept_input, references_input, themes_input, track_count],
                outputs=[output_area, progress],
            )


def _get_custom_css() -> str:
    """Get custom CSS for the application."""
    return """
    .gradio-container {
        max-width: 1400px !important;
    }

    .chord-button {
        min-width: 60px !important;
        font-family: monospace !important;
    }

    .section-header {
        background-color: var(--primary-100);
        padding: 8px 12px;
        border-radius: 4px;
        margin-bottom: 8px;
    }

    .song-card {
        border: 1px solid var(--border-color-primary);
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .song-card:hover {
        border-color: var(--primary-500);
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .motif-tag {
        display: inline-block;
        background-color: var(--secondary-100);
        color: var(--secondary-700);
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.85em;
        margin-right: 4px;
    }

    .theme-tag {
        display: inline-block;
        background-color: var(--primary-100);
        color: var(--primary-700);
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.85em;
        margin-right: 4px;
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
    )


if __name__ == "__main__":
    launch_app(debug=True)
