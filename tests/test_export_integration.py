from pathlib import Path

import pytest

pytest.importorskip("pretty_midi")

from album_conceptualizer.export.formats import AlbumExporter, ExportFormat
from album_conceptualizer.models.album import Album, Section, SectionType, Song


def test_export_album_generates_files(tmp_path: Path) -> None:
    song = Song(
        title="Test Song",
        track_number=1,
        key="C major",
        tempo=120,
        sections=[
            Section(
                section_type=SectionType.VERSE,
                order=1,
                lyrics="Hello world",
                chord_progression=["C", "G", "Am", "F"],
            )
        ],
    )
    album = Album(title="Test Album", artist="Tester", songs=[song])

    exporter = AlbumExporter(output_dir=tmp_path, artist_name=album.artist)
    results = exporter.export_album(
        album,
        [ExportFormat.JSON, ExportFormat.TEXT, ExportFormat.CHORDPRO],
    )

    assert results[ExportFormat.JSON.value]
    assert results[ExportFormat.TEXT.value]
    assert results[ExportFormat.CHORDPRO.value]

    album_dir = tmp_path / "Test Album"
    assert (album_dir / "album.json").exists()
    assert (album_dir / "tracklist.txt").exists()
    assert (album_dir / "json" / "Test Song.json").exists()
    assert (album_dir / "lyrics" / "Test Song.txt").exists()
    assert (album_dir / "chordpro" / "Test Song.cho").exists()

    assert (album_dir / "tracklist.txt").read_text().strip()
    assert (album_dir / "json" / "Test Song.json").read_text().strip()
    assert (album_dir / "chordpro" / "Test Song.cho").read_text().strip()
