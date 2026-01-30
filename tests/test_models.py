"""Tests for data models."""

import pytest

from album_conceptualizer.models.album import Album, Song, Section, SectionType
from album_conceptualizer.models.album_bible import (
    AlbumBible,
    Theme,
    Motif,
    Character,
    NarrativeArc,
    StyleProfile,
)
from album_conceptualizer.models.music_theory import (
    Chord,
    ChordProgression,
    Key,
    Scale,
    ChordQuality,
    ScaleType,
)


class TestChord:
    """Tests for the Chord model."""

    def test_chord_from_symbol_major(self):
        """Test parsing major chord."""
        chord = Chord.from_symbol("C")
        assert chord.root == "C"
        assert chord.quality == ChordQuality.MAJOR

    def test_chord_from_symbol_minor(self):
        """Test parsing minor chord."""
        chord = Chord.from_symbol("Am")
        assert chord.root == "A"
        assert chord.quality == ChordQuality.MINOR

    def test_chord_from_symbol_seventh(self):
        """Test parsing seventh chord."""
        chord = Chord.from_symbol("G7")
        assert chord.root == "G"
        assert chord.quality == ChordQuality.DOMINANT_7

    def test_chord_from_symbol_slash(self):
        """Test parsing slash chord."""
        chord = Chord.from_symbol("C/G")
        assert chord.root == "C"
        assert chord.bass_note == "G"

    def test_chord_to_symbol(self):
        """Test chord to symbol conversion."""
        chord = Chord(root="D", quality=ChordQuality.MINOR_7)
        assert chord.to_symbol() == "Dm7"

    def test_chord_to_symbol_slash(self):
        """Test slash chord to symbol."""
        chord = Chord(root="F", quality=ChordQuality.MAJOR, bass_note="C")
        assert chord.to_symbol() == "F/C"


class TestScale:
    """Tests for the Scale model."""

    def test_major_scale_notes(self):
        """Test C major scale notes."""
        scale = Scale(root="C", scale_type=ScaleType.MAJOR)
        notes = scale.get_notes()
        assert notes == ["C", "D", "E", "F", "G", "A", "B"]

    def test_minor_scale_notes(self):
        """Test A natural minor scale notes."""
        scale = Scale(root="A", scale_type=ScaleType.NATURAL_MINOR)
        notes = scale.get_notes()
        assert notes == ["A", "B", "C", "D", "E", "F", "G"]

    def test_pentatonic_scale_notes(self):
        """Test pentatonic scale has 5 notes."""
        scale = Scale(root="G", scale_type=ScaleType.PENTATONIC_MAJOR)
        notes = scale.get_notes()
        assert len(notes) == 5


class TestKey:
    """Tests for the Key model."""

    def test_major_diatonic_chords(self):
        """Test diatonic chords in major key."""
        key = Key(tonic="C", mode="major")
        chords = key.get_diatonic_chords()
        assert chords == ["I", "ii", "iii", "IV", "V", "vi", "vii°"]

    def test_minor_diatonic_chords(self):
        """Test diatonic chords in minor key."""
        key = Key(tonic="A", mode="minor")
        chords = key.get_diatonic_chords()
        assert chords == ["i", "ii°", "III", "iv", "v", "VI", "VII"]

    def test_relative_key_major_to_minor(self):
        """Test relative minor of C major is A minor."""
        key = Key(tonic="C", mode="major")
        relative = key.relative_key()
        assert relative.tonic == "A"
        assert relative.mode == "minor"

    def test_relative_key_minor_to_major(self):
        """Test relative major of A minor is C major."""
        key = Key(tonic="A", mode="minor")
        relative = key.relative_key()
        assert relative.tonic == "C"
        assert relative.mode == "major"


class TestSong:
    """Tests for the Song model."""

    def test_song_creation(self):
        """Test basic song creation."""
        song = Song(title="Test Song", track_number=1)
        assert song.title == "Test Song"
        assert song.track_number == 1
        assert song.sections == []

    def test_add_section(self):
        """Test adding sections to a song."""
        song = Song(title="Test Song", track_number=1)
        section = Section(
            section_type=SectionType.VERSE,
            order=1,
            lyrics="Test lyrics",
        )
        song.add_section(section)
        assert len(song.sections) == 1
        assert song.sections[0].lyrics == "Test lyrics"

    def test_get_full_lyrics(self):
        """Test getting concatenated lyrics."""
        song = Song(title="Test Song", track_number=1)
        song.add_section(Section(
            section_type=SectionType.VERSE,
            order=1,
            lyrics="Verse lyrics",
        ))
        song.add_section(Section(
            section_type=SectionType.CHORUS,
            order=2,
            lyrics="Chorus lyrics",
        ))

        full_lyrics = song.get_full_lyrics()
        assert "Verse lyrics" in full_lyrics
        assert "Chorus lyrics" in full_lyrics


class TestAlbum:
    """Tests for the Album model."""

    def test_album_creation(self):
        """Test basic album creation."""
        album = Album(title="Test Album", artist="Test Artist")
        assert album.title == "Test Album"
        assert album.artist == "Test Artist"
        assert album.songs == []

    def test_add_song(self):
        """Test adding songs to album."""
        album = Album(title="Test Album")
        song = Song(title="Song 1", track_number=1)
        album.add_song(song)
        assert len(album.songs) == 1

    def test_get_song_by_title(self):
        """Test finding song by title."""
        album = Album(title="Test Album")
        song = Song(title="Find Me", track_number=1)
        album.add_song(song)

        found = album.get_song_by_title("Find Me")
        assert found is not None
        assert found.title == "Find Me"

    def test_to_tracklist(self):
        """Test tracklist generation."""
        album = Album(title="Test Album", artist="Artist")
        album.add_song(Song(title="Song 1", track_number=1))
        album.add_song(Song(title="Song 2", track_number=2))

        tracklist = album.to_tracklist()
        assert "Test Album" in tracklist
        assert "Song 1" in tracklist
        assert "Song 2" in tracklist


class TestAlbumBible:
    """Tests for the AlbumBible model."""

    def test_album_bible_creation(self):
        """Test creating an album bible."""
        bible = AlbumBible(
            album_title="Concept Album",
            logline="A story about transformation",
            synopsis="Extended description of the story...",
        )
        assert bible.album_title == "Concept Album"
        assert bible.logline == "A story about transformation"

    def test_add_theme(self):
        """Test adding themes."""
        bible = AlbumBible(
            album_title="Test",
            logline="Test",
            synopsis="Test",
        )
        theme = Theme(
            name="Identity",
            description="Exploring who we are",
        )
        bible.add_theme(theme)
        assert len(bible.themes) == 1
        assert bible.themes[0].name == "Identity"

    def test_add_character(self):
        """Test adding characters."""
        bible = AlbumBible(
            album_title="Test",
            logline="Test",
            synopsis="Test",
        )
        character = Character(
            name="The Protagonist",
            role="protagonist",
            description="Main character of the story",
        )
        bible.add_character(character)
        assert len(bible.characters) == 1

    def test_to_summary(self):
        """Test generating summary."""
        bible = AlbumBible(
            album_title="Test Album",
            logline="A one-sentence summary",
            synopsis="The extended story...",
        )
        bible.add_theme(Theme(name="Loss", description="Dealing with loss"))

        summary = bible.to_summary()
        assert "Test Album" in summary
        assert "Loss" in summary


class TestChordProgression:
    """Tests for the ChordProgression model."""

    def test_progression_creation(self):
        """Test creating a chord progression."""
        chords = [
            Chord.from_symbol("C"),
            Chord.from_symbol("Am"),
            Chord.from_symbol("F"),
            Chord.from_symbol("G"),
        ]
        progression = ChordProgression(chords=chords)
        assert len(progression.chords) == 4

    def test_to_symbols(self):
        """Test converting progression to symbols."""
        chords = [
            Chord.from_symbol("C"),
            Chord.from_symbol("G"),
        ]
        progression = ChordProgression(chords=chords)
        symbols = progression.to_symbols()
        assert symbols == ["C", "G"]
