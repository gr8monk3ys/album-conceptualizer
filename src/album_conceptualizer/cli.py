"""Command-line interface for Album Conceptualizer."""

import argparse
import sys
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()


def main():
    """Main entry point for the CLI."""
    parser = argparse.ArgumentParser(
        description="Album Conceptualizer - RAG-powered concept album ideation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  album-conceptualizer ui                    Launch the web interface
  album-conceptualizer new "My Album"        Create a new album project
  album-conceptualizer export album.json     Export an album to various formats

For more information, visit: https://github.com/gr8monk3ys/album-conceptualizer
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # UI command
    ui_parser = subparsers.add_parser("ui", help="Launch the web interface")
    ui_parser.add_argument(
        "--port", type=int, default=7860, help="Port to run the server on"
    )
    ui_parser.add_argument(
        "--share", action="store_true", help="Create a public share link"
    )
    ui_parser.add_argument("--debug", action="store_true", help="Enable debug mode")

    # New album command
    new_parser = subparsers.add_parser("new", help="Create a new album project")
    new_parser.add_argument("title", help="Album title")
    new_parser.add_argument("--artist", help="Artist name")
    new_parser.add_argument("--output", "-o", help="Output directory")

    # Export command
    export_parser = subparsers.add_parser("export", help="Export an album")
    export_parser.add_argument("input", help="Input album JSON file")
    export_parser.add_argument(
        "--format",
        "-f",
        choices=["midi", "chordpro", "musicxml", "all"],
        default="all",
        help="Export format",
    )
    export_parser.add_argument("--output", "-o", help="Output directory")

    # Index command (for RAG)
    index_parser = subparsers.add_parser("index", help="Index data for RAG")
    index_parser.add_argument(
        "source",
        choices=["chordonomicon", "lyrics", "custom"],
        help="Data source to index",
    )
    index_parser.add_argument("--path", help="Path to data file")
    index_parser.add_argument("--limit", type=int, help="Limit number of items")

    # Version
    parser.add_argument(
        "--version", action="version", version="%(prog)s 0.1.0"
    )

    args = parser.parse_args()

    if args.command == "ui":
        cmd_ui(args)
    elif args.command == "new":
        cmd_new(args)
    elif args.command == "export":
        cmd_export(args)
    elif args.command == "index":
        cmd_index(args)
    else:
        # Show welcome message and help
        show_welcome()
        parser.print_help()


def show_welcome():
    """Display welcome message."""
    console.print(
        Panel.fit(
            "[bold purple]Album Conceptualizer[/bold purple]\n"
            "[dim]RAG-powered concept album ideation system[/dim]",
            border_style="purple",
        )
    )
    console.print()


def cmd_ui(args):
    """Launch the web UI."""
    console.print("[bold]Launching Album Conceptualizer UI...[/bold]")
    console.print(f"Server will be available at: http://127.0.0.1:{args.port}")

    if args.share:
        console.print("[yellow]Creating public share link...[/yellow]")

    try:
        from album_conceptualizer.ui.app import launch_app

        launch_app(
            server_port=args.port,
            share=args.share,
            debug=args.debug,
        )
    except ImportError as e:
        console.print(f"[red]Error: {e}[/red]")
        console.print("Make sure Gradio is installed: pip install gradio")
        sys.exit(1)


def cmd_new(args):
    """Create a new album project."""
    from album_conceptualizer.models.album import Album
    from album_conceptualizer.models.album_bible import AlbumBible

    console.print(f"[bold]Creating new album: {args.title}[/bold]")

    # Create album
    album = Album(
        title=args.title,
        artist=args.artist,
    )

    # Create album bible
    bible = AlbumBible(
        album_title=args.title,
        artist=args.artist,
        logline="[Enter your one-sentence album concept]",
        synopsis="[Enter your extended synopsis]",
    )

    # Determine output directory
    output_dir = Path(args.output) if args.output else Path.cwd() / args.title.lower().replace(" ", "_")
    output_dir.mkdir(parents=True, exist_ok=True)

    # Save files
    album_path = output_dir / "album.json"
    bible_path = output_dir / "album_bible.json"

    album_path.write_text(album.model_dump_json(indent=2))
    bible_path.write_text(bible.model_dump_json(indent=2))

    console.print(f"[green]Created album project at: {output_dir}[/green]")
    console.print(f"  - {album_path.name}")
    console.print(f"  - {bible_path.name}")


def cmd_export(args):
    """Export an album to various formats."""
    from album_conceptualizer.models.album import Album
    from album_conceptualizer.export.formats import AlbumExporter, ExportFormat

    console.print(f"[bold]Exporting album from: {args.input}[/bold]")

    # Load album
    input_path = Path(args.input)
    if not input_path.exists():
        console.print(f"[red]Error: File not found: {args.input}[/red]")
        sys.exit(1)

    album = Album.model_validate_json(input_path.read_text())

    # Determine formats
    if args.format == "all":
        formats = [ExportFormat.MIDI, ExportFormat.CHORDPRO, ExportFormat.MUSICXML, ExportFormat.JSON]
    else:
        format_map = {
            "midi": ExportFormat.MIDI,
            "chordpro": ExportFormat.CHORDPRO,
            "musicxml": ExportFormat.MUSICXML,
        }
        formats = [format_map[args.format]]

    # Export
    output_dir = Path(args.output) if args.output else input_path.parent / "export"
    exporter = AlbumExporter(output_dir=output_dir, artist_name=album.artist)

    results = exporter.export_album(album, formats)

    # Show results
    table = Table(title="Export Results")
    table.add_column("Format", style="cyan")
    table.add_column("Files", style="green")
    table.add_column("Status", style="yellow")

    for fmt, result_list in results.items():
        success_count = sum(1 for r in result_list if r.success)
        total_count = len(result_list)
        status = f"{success_count}/{total_count} succeeded"
        table.add_row(fmt, str(total_count), status)

    console.print(table)
    console.print(f"\n[green]Export complete: {output_dir}[/green]")


def cmd_index(args):
    """Index data for RAG."""
    console.print(f"[bold]Indexing {args.source} data...[/bold]")

    if args.source == "chordonomicon":
        if not args.path:
            console.print("[red]Error: --path required for chordonomicon[/red]")
            sys.exit(1)

        from album_conceptualizer.rag.embeddings import get_embedding_model
        from album_conceptualizer.rag.vector_store import ChromaVectorStore
        from album_conceptualizer.rag.indexer import ChordProgressionIndexer

        console.print("Initializing embedding model...")
        embedding_model = get_embedding_model()

        console.print("Creating vector store...")
        vector_store = ChromaVectorStore(
            collection_name="chord_progressions",
            embedding_model=embedding_model,
            persist_directory=Path("./data/chroma"),
        )

        console.print("Indexing chord progressions...")
        indexer = ChordProgressionIndexer(vector_store, embedding_model)
        ids = indexer.index_from_chordonomicon(args.path, limit=args.limit)

        console.print(f"[green]Indexed {len(ids)} chord progressions[/green]")

    elif args.source == "lyrics":
        console.print("[yellow]Lyrics indexing not yet implemented[/yellow]")

    else:
        console.print(f"[yellow]Custom indexing for {args.path}[/yellow]")
        console.print("See documentation for custom data format")


if __name__ == "__main__":
    main()
