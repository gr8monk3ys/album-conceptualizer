"""Tests for the argparse-based CLI.

The CLI uses argparse, so tests capture stdout/stderr and
inspect argument parsing directly. All commands that would launch external
services or perform I/O are mocked.
"""

import argparse
import json
import sys
from pathlib import Path
from unittest.mock import patch

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def parse_args(argv: list[str]) -> argparse.Namespace:
    """Run the CLI parser against *argv* and return the parsed Namespace."""
    from album_conceptualizer.cli import main

    with patch("album_conceptualizer.cli.cmd_ui") as _ui, \
         patch("album_conceptualizer.cli.cmd_new") as _new, \
         patch("album_conceptualizer.cli.cmd_export") as _exp, \
         patch("album_conceptualizer.cli.cmd_index") as _idx, \
         patch("album_conceptualizer.cli.show_welcome"):
        with patch.object(sys, "argv", ["album-conceptualizer", *argv]):
            main()
            for mock_fn in (_ui, _new, _exp, _idx):
                if mock_fn.called:
                    return mock_fn.call_args[0][0]
    return argparse.Namespace(command=None)


# ===================================================================
# Module-level smoke test
# ===================================================================


class TestCLIImport:
    def test_main_is_callable(self):
        from album_conceptualizer.cli import main

        assert callable(main)

    def test_command_handlers_exist(self):
        from album_conceptualizer import cli

        for name in ("cmd_ui", "cmd_new", "cmd_export", "cmd_index", "show_welcome"):
            assert hasattr(cli, name), f"cli.{name} missing"
            assert callable(getattr(cli, name))


# ===================================================================
# --help / --version
# ===================================================================


class TestHelpAndVersion:
    def test_help_flag_exits_zero(self):
        from album_conceptualizer.cli import main

        with patch.object(sys, "argv", ["album-conceptualizer", "--help"]):
            with pytest.raises(SystemExit) as exc_info:
                main()
            assert exc_info.value.code == 0

    def test_version_flag_exits_zero(self):
        from album_conceptualizer.cli import main

        with patch.object(sys, "argv", ["album-conceptualizer", "--version"]):
            with pytest.raises(SystemExit) as exc_info:
                main()
            assert exc_info.value.code == 0

    def test_help_output_contains_description(self, capsys):
        from album_conceptualizer.cli import main

        with patch.object(sys, "argv", ["album-conceptualizer", "--help"]):
            with pytest.raises(SystemExit):
                main()
        captured = capsys.readouterr()
        assert "Album Conceptualizer" in captured.out

    def test_subcommand_help(self, capsys):
        from album_conceptualizer.cli import main

        for subcmd in ("ui", "new", "export", "index"):
            with patch.object(sys, "argv", ["album-conceptualizer", subcmd, "--help"]):
                with pytest.raises(SystemExit):
                    main()
            captured = capsys.readouterr()
            assert len(captured.out) > 0, f"{subcmd} --help produced no output"


# ===================================================================
# No-command invocation (welcome screen)
# ===================================================================


class TestNoCommand:
    def test_show_welcome_called_with_no_args(self):
        from album_conceptualizer.cli import main

        with patch("album_conceptualizer.cli.show_welcome") as mock_welcome, \
             patch.object(sys, "argv", ["album-conceptualizer"]):
            main()
        mock_welcome.assert_called_once()


# ===================================================================
# "ui" subcommand
# ===================================================================


class TestUICommand:
    def test_default_port_and_host(self):
        args = parse_args(["ui"])
        assert args.port == 7860
        assert args.host == "127.0.0.1"
        assert args.share is False
        assert args.debug is False

    def test_custom_port(self):
        args = parse_args(["ui", "--port", "8080"])
        assert args.port == 8080

    def test_custom_host(self):
        args = parse_args(["ui", "--host", "0.0.0.0"])
        assert args.host == "0.0.0.0"

    def test_share_flag(self):
        args = parse_args(["ui", "--share"])
        assert args.share is True

    def test_debug_flag(self):
        args = parse_args(["ui", "--debug"])
        assert args.debug is True

    def test_cmd_ui_calls_launch_app(self):
        from album_conceptualizer.cli import cmd_ui

        mock_args = argparse.Namespace(
            port=7860, host="127.0.0.1", share=False, debug=False
        )
        with patch("album_conceptualizer.ui.app.launch_app") as mock_launch:
            cmd_ui(mock_args)
            mock_launch.assert_called_once_with(
                server_port=7860,
                server_name="127.0.0.1",
                share=False,
                debug=False,
            )


# ===================================================================
# "new" subcommand
# ===================================================================


class TestNewCommand:
    def test_title_is_required(self):
        from album_conceptualizer.cli import main

        with patch.object(sys, "argv", ["album-conceptualizer", "new"]):
            with pytest.raises(SystemExit) as exc_info:
                main()
            assert exc_info.value.code != 0

    def test_parses_title(self):
        args = parse_args(["new", "My Album"])
        assert args.title == "My Album"

    def test_parses_artist(self):
        args = parse_args(["new", "My Album", "--artist", "Test Artist"])
        assert args.artist == "Test Artist"

    def test_parses_output(self):
        args = parse_args(["new", "My Album", "-o", "/tmp/output"])
        assert args.output == "/tmp/output"

    def test_cmd_new_creates_files(self, tmp_path):
        from album_conceptualizer.cli import cmd_new

        output_dir = tmp_path / "test_album"
        mock_args = argparse.Namespace(
            title="Test Album",
            artist="Test Artist",
            output=str(output_dir),
        )
        cmd_new(mock_args)

        album_path = output_dir / "album.json"
        bible_path = output_dir / "album_bible.json"
        assert album_path.exists()
        assert bible_path.exists()

        album_data = json.loads(album_path.read_text())
        assert album_data["title"] == "Test Album"
        assert album_data["artist"] == "Test Artist"

        bible_data = json.loads(bible_path.read_text())
        assert bible_data["album_title"] == "Test Album"

    def test_cmd_new_uses_default_output_dir(self, tmp_path, monkeypatch):
        from album_conceptualizer.cli import cmd_new

        monkeypatch.chdir(tmp_path)
        mock_args = argparse.Namespace(
            title="My Great Album",
            artist=None,
            output=None,
        )
        cmd_new(mock_args)

        expected_dir = tmp_path / "my_great_album"
        assert expected_dir.exists()
        assert (expected_dir / "album.json").exists()


# ===================================================================
# "export" subcommand
# ===================================================================


class TestExportCommand:
    def test_input_is_required(self):
        from album_conceptualizer.cli import main

        with patch.object(sys, "argv", ["album-conceptualizer", "export"]):
            with pytest.raises(SystemExit) as exc_info:
                main()
            assert exc_info.value.code != 0

    def test_parses_input(self):
        args = parse_args(["export", "album.json"])
        assert args.input == "album.json"

    def test_default_format_is_all(self):
        args = parse_args(["export", "album.json"])
        assert args.format == "all"

    def test_parses_specific_format(self):
        args = parse_args(["export", "album.json", "-f", "midi"])
        assert args.format == "midi"

    def test_invalid_format_rejected(self):
        from album_conceptualizer.cli import main

        with patch.object(sys, "argv", ["album-conceptualizer", "export", "a.json", "-f", "wav"]):
            with pytest.raises(SystemExit):
                main()

    def test_cmd_export_exits_on_missing_file(self):
        from album_conceptualizer.cli import cmd_export

        mock_args = argparse.Namespace(
            input="/nonexistent/path/album.json",
            format="all",
            output=None,
        )
        with pytest.raises(SystemExit) as exc_info:
            cmd_export(mock_args)
        assert exc_info.value.code == 1


# ===================================================================
# "index" subcommand
# ===================================================================


class TestIndexCommand:
    def test_source_is_required(self):
        from album_conceptualizer.cli import main

        with patch.object(sys, "argv", ["album-conceptualizer", "index"]):
            with pytest.raises(SystemExit) as exc_info:
                main()
            assert exc_info.value.code != 0

    def test_parses_source(self):
        args = parse_args(["index", "chordonomicon", "--path", "/data/chords.csv"])
        assert args.source == "chordonomicon"

    def test_invalid_source_rejected(self):
        from album_conceptualizer.cli import main

        with patch.object(sys, "argv", ["album-conceptualizer", "index", "invalid_source"]):
            with pytest.raises(SystemExit):
                main()

    def test_parses_limit(self):
        args = parse_args(["index", "lyrics", "--limit", "100"])
        assert args.limit == 100

    def test_cmd_index_chordonomicon_requires_path(self):
        from album_conceptualizer.cli import cmd_index

        mock_args = argparse.Namespace(source="chordonomicon", path=None, limit=None)
        with pytest.raises(SystemExit) as exc_info:
            cmd_index(mock_args)
        assert exc_info.value.code == 1


# ===================================================================
# show_welcome
# ===================================================================


class TestShowWelcome:
    def test_show_welcome_does_not_raise(self):
        from album_conceptualizer.cli import show_welcome

        show_welcome()
