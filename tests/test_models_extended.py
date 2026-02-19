"""Extended model tests covering uncovered paths in album, album_bible, and music_theory."""

from album_conceptualizer.config import configure, reset_settings
from album_conceptualizer.models.album import Album, Song
from album_conceptualizer.models.album_bible import AlbumBible, Character, Motif, StyleProfile, Theme
from album_conceptualizer.models.music_theory import (
    Chord,
    ChordProgression,
    ChordQuality,
    Key,
    Scale,
    ScaleType,
    TimeSignature,
)


# ---------------------------------------------------------------------------
# Chord.to_symbol with extensions
# ---------------------------------------------------------------------------


class TestChordToSymbolExtensions:
    def test_chord_to_symbol_with_extension(self):
        """Covers line 80: symbol += ''.join(self.extensions)"""
        chord = Chord(root="C", quality=ChordQuality.MAJOR, extensions=["9"])
        assert chord.to_symbol() == "C9"

    def test_chord_to_symbol_multiple_extensions(self):
        chord = Chord(root="F", quality=ChordQuality.MAJOR_7, extensions=["9", "#11"])
        assert chord.to_symbol() == "Fmaj79#11"

    def test_chord_to_symbol_extension_with_bass(self):
        chord = Chord(root="G", quality=ChordQuality.DOMINANT_7, extensions=["9"], bass_note="B")
        assert chord.to_symbol() == "G79/B"


# ---------------------------------------------------------------------------
# Chord.from_symbol — less common qualities
# ---------------------------------------------------------------------------


class TestChordFromSymbolEdgeCases:
    def test_from_symbol_half_diminished(self):
        """Covers line 110: quality = ChordQuality.HALF_DIMINISHED"""
        chord = Chord.from_symbol("Bm7b5")
        assert chord.root == "B"
        assert chord.quality == ChordQuality.HALF_DIMINISHED

    def test_from_symbol_diminished_7(self):
        """Covers line 114: quality = ChordQuality.DIMINISHED_7"""
        chord = Chord.from_symbol("Cdim7")
        assert chord.root == "C"
        assert chord.quality == ChordQuality.DIMINISHED_7

    def test_from_symbol_augmented(self):
        """Covers line 118: quality = ChordQuality.AUGMENTED"""
        chord = Chord.from_symbol("Eaug")
        assert chord.root == "E"
        assert chord.quality == ChordQuality.AUGMENTED

    def test_from_symbol_sus2(self):
        """Covers line 126: quality = ChordQuality.SUS2"""
        chord = Chord.from_symbol("Dsus2")
        assert chord.root == "D"
        assert chord.quality == ChordQuality.SUS2

    def test_from_symbol_sus4(self):
        """Covers line 128: quality = ChordQuality.SUS4"""
        chord = Chord.from_symbol("Asus4")
        assert chord.root == "A"
        assert chord.quality == ChordQuality.SUS4

    def test_from_symbol_add9(self):
        """Covers line 130: quality = ChordQuality.ADD9"""
        chord = Chord.from_symbol("Gadd9")
        assert chord.root == "G"
        assert chord.quality == ChordQuality.ADD9

    def test_from_symbol_power(self):
        """Covers line 132: quality = ChordQuality.POWER"""
        chord = Chord.from_symbol("E5")
        assert chord.root == "E"
        assert chord.quality == ChordQuality.POWER

    def test_from_symbol_with_sharp_root(self):
        chord = Chord.from_symbol("F#m")
        assert chord.root == "F#"
        assert chord.quality == ChordQuality.MINOR


# ---------------------------------------------------------------------------
# Scale.get_notes — special root note paths
# ---------------------------------------------------------------------------


class TestScaleGetNotesSpecialRoots:
    def test_scale_double_flat_root(self):
        """Covers lines 151-152: double-sharp handling after b→# substitution.

        'Cbb'.replace('b','#') = 'C##', which ends with '##'.
        """
        scale = Scale(root="Cbb", scale_type=ScaleType.MAJOR)
        notes = scale.get_notes()
        # C## ≡ D, so the major scale starting on D
        assert notes[0] in ("D", "C##")  # normalised to D
        assert len(notes) == 7

    def test_scale_flat_root_uses_enharmonic(self):
        """Covers lines 155-156: flat root mapped via enharmonics dict.

        'Eb'.replace('b','#') = 'E#' (not in chromatic) → elif → enharmonics['Eb'] = 'D#'.
        """
        scale = Scale(root="Eb", scale_type=ScaleType.MAJOR)
        notes = scale.get_notes()
        assert len(notes) == 7

    def test_scale_sharp_root_not_in_chromatic_triggers_value_error_path(self):
        """Covers lines 155-156 and 160-161: 'E#' is not in enharmonics dict,
        so chromatic.index('E#') raises ValueError → fallback to index(root[0]).
        """
        scale = Scale(root="E#", scale_type=ScaleType.MAJOR)
        notes = scale.get_notes()
        assert len(notes) == 7

    def test_scale_dorian_mode(self):
        scale = Scale(root="D", scale_type=ScaleType.DORIAN)
        notes = scale.get_notes()
        assert len(notes) == 7

    def test_scale_blues(self):
        scale = Scale(root="A", scale_type=ScaleType.BLUES)
        notes = scale.get_notes()
        assert len(notes) == 6


# ---------------------------------------------------------------------------
# Key.get_common_progressions and relative_key
# ---------------------------------------------------------------------------


class TestKeyExtended:
    def test_minor_key_common_progressions(self):
        """Covers line 206: minor branch of get_common_progressions."""
        key = Key(tonic="A", mode="minor")
        progressions = key.get_common_progressions()
        assert isinstance(progressions, list)
        assert len(progressions) > 0
        # Minor progressions use lowercase roman numerals
        first = progressions[0]
        assert any(r.startswith("i") for r in first)

    def test_major_key_common_progressions(self):
        key = Key(tonic="C", mode="major")
        progressions = key.get_common_progressions()
        assert len(progressions) > 0
        assert ["I", "V", "vi", "IV"] in progressions

    def test_relative_key_with_flat_tonic(self):
        """Covers lines 219-222: ValueError in relative_key when tonic is 'Bb'."""
        key = Key(tonic="Bb", mode="minor")
        relative = key.relative_key()
        # Bb minor's relative major should be Db (C# enharmonically)
        assert relative.mode == "major"
        assert relative.tonic in ("C#", "Db")

    def test_relative_key_with_sharp_tonic(self):
        key = Key(tonic="F#", mode="major")
        relative = key.relative_key()
        assert relative.mode == "minor"


# ---------------------------------------------------------------------------
# TimeSignature
# ---------------------------------------------------------------------------


class TestTimeSignature:
    def test_str_representation(self):
        """Covers line 241: TimeSignature.__str__"""
        ts = TimeSignature(numerator=4, denominator=4)
        assert str(ts) == "4/4"

    def test_str_three_four(self):
        ts = TimeSignature(numerator=3, denominator=4)
        assert str(ts) == "3/4"

    def test_from_string(self):
        """Covers lines 246-247: TimeSignature.from_string"""
        ts = TimeSignature.from_string("6/8")
        assert ts.numerator == 6
        assert ts.denominator == 8

    def test_from_string_common_time(self):
        ts = TimeSignature.from_string("4/4")
        assert ts.numerator == 4
        assert ts.denominator == 4


# ---------------------------------------------------------------------------
# ChordProgression.to_roman_numerals
# ---------------------------------------------------------------------------


class TestChordProgressionToRomanNumerals:
    def test_to_roman_numerals_with_preset(self):
        """Covers lines 279-280: returns self.roman_numerals when set."""
        prog = ChordProgression(roman_numerals=["I", "IV", "V", "I"])
        result = prog.to_roman_numerals()
        assert result == ["I", "IV", "V", "I"]

    def test_to_roman_numerals_from_chords(self):
        """Covers line 281: builds from chords when roman_numerals is empty."""
        chords = [
            Chord(root="C", quality=ChordQuality.MAJOR, roman_numeral="I"),
            Chord(root="F", quality=ChordQuality.MAJOR, roman_numeral="IV"),
            Chord(root="G", quality=ChordQuality.MAJOR),  # No roman_numeral
        ]
        prog = ChordProgression(chords=chords)
        result = prog.to_roman_numerals()
        assert "I" in result
        assert "IV" in result
        assert len(result) == 2  # G has no roman_numeral, filtered out

    def test_to_roman_numerals_empty_when_no_chords(self):
        prog = ChordProgression()
        result = prog.to_roman_numerals()
        assert result == []


# ---------------------------------------------------------------------------
# Album model methods
# ---------------------------------------------------------------------------


class TestAlbumModelMethods:
    def _make_album_with_songs(self) -> Album:
        album = Album(title="Test Album", artist="Test Artist")
        s1 = Song(title="Song A", track_number=1, chronological_order=3, themes=["love"])
        s2 = Song(title="Song B", track_number=2, chronological_order=1, themes=["hope"])
        s3 = Song(
            title="Song C",
            track_number=3,
            themes=["love"],
            motifs=["rain", "fire"],
        )
        album.add_song(s1)
        album.add_song(s2)
        album.add_song(s3)
        return album

    def test_get_song_by_track_number_found(self):
        """Covers lines 164-167: get_song_by_track_number returns matching song."""
        album = self._make_album_with_songs()
        song = album.get_song_by_track_number(2)
        assert song is not None
        assert song.title == "Song B"

    def test_get_song_by_track_number_not_found(self):
        """Covers the return None path of get_song_by_track_number."""
        album = self._make_album_with_songs()
        song = album.get_song_by_track_number(99)
        assert song is None

    def test_get_chronological_order(self):
        """Covers lines 171-174: sorts songs with chronological_order and appends the rest."""
        album = self._make_album_with_songs()
        ordered = album.get_chronological_order()
        # Song B has order=1, Song A has order=3, Song C has None
        assert ordered[0].title == "Song B"
        assert ordered[1].title == "Song A"
        assert ordered[2].title == "Song C"  # No order → appended last

    def test_get_theme_connections(self):
        """Covers line 178: filters songs by theme."""
        album = self._make_album_with_songs()
        songs = album.get_theme_connections("love")
        titles = [s.title for s in songs]
        assert "Song A" in titles
        assert "Song C" in titles
        assert "Song B" not in titles

    def test_get_motif_usage(self):
        """Covers lines 182-186: returns songs and their sections for motif."""
        album = self._make_album_with_songs()
        results = album.get_motif_usage("rain")
        assert len(results) == 1
        song, sections = results[0]
        assert song.title == "Song C"

    def test_get_motif_usage_not_found(self):
        album = self._make_album_with_songs()
        results = album.get_motif_usage("nostalgia")
        assert results == []

    def test_to_tracklist_with_duration(self):
        """Covers the duration branch in to_tracklist."""
        album = Album(title="Album", artist="Artist")
        song = Song(title="Song", track_number=1, duration_estimate="3:45")
        album.add_song(song)
        tracklist = album.to_tracklist()
        assert "3:45" in tracklist


# ---------------------------------------------------------------------------
# AlbumBible model methods
# ---------------------------------------------------------------------------


class TestAlbumBibleModelMethods:
    def _make_bible(self) -> AlbumBible:
        bible = AlbumBible(
            album_title="Test Album",
            logline="A story about duality.",
            synopsis="An album about light and dark.",
        )
        bible.add_theme(Theme(name="Redemption", description="Finding redemption"))
        bible.add_theme(Theme(name="Loss", description="Dealing with loss"))
        bible.add_character(
            Character(name="The Wanderer", role="protagonist", description="A lost soul")
        )
        motif = Motif(
            name="Rain",
            motif_type="musical",
            description="Rain represents grief",
            appearances=[{"track_number": 2, "section": "verse"}],
        )
        bible.motifs.append(motif)
        return bible

    def test_get_theme_by_name_found(self):
        """Covers lines 210-212: returns matching theme."""
        bible = self._make_bible()
        theme = bible.get_theme_by_name("redemption")
        assert theme is not None
        assert theme.name == "Redemption"

    def test_get_theme_by_name_not_found(self):
        """Covers line 213: returns None when not found."""
        bible = self._make_bible()
        theme = bible.get_theme_by_name("nonexistent")
        assert theme is None

    def test_get_character_by_name_found(self):
        """Covers lines 217-219: returns matching character."""
        bible = self._make_bible()
        char = bible.get_character_by_name("the wanderer")
        assert char is not None
        assert char.name == "The Wanderer"

    def test_get_character_by_name_not_found(self):
        """Covers line 220: returns None when not found."""
        bible = self._make_bible()
        char = bible.get_character_by_name("nobody")
        assert char is None

    def test_get_motifs_for_track(self):
        """Covers line 224: filters motifs by track number."""
        bible = self._make_bible()
        motifs = bible.get_motifs_for_track(2)
        assert len(motifs) == 1
        assert motifs[0].name == "Rain"

    def test_get_motifs_for_track_none_found(self):
        bible = self._make_bible()
        motifs = bible.get_motifs_for_track(99)
        assert motifs == []

    def test_to_summary_with_style_profile(self):
        """Covers lines 261-269: style_profile section in to_summary."""
        bible = self._make_bible()
        bible.style_profile = StyleProfile(
            primary_genre="Rock",
            reference_artists=["Led Zeppelin", "Pink Floyd"],
        )
        summary = bible.to_summary()
        assert "Rock" in summary
        assert "Led Zeppelin" in summary

    def test_to_summary_with_style_profile_no_reference_artists(self):
        """Covers line 260-266 without reference_artists."""
        bible = self._make_bible()
        bible.style_profile = StyleProfile(primary_genre="Jazz")
        summary = bible.to_summary()
        assert "Jazz" in summary

    def test_to_summary_with_motifs(self):
        """Covers lines 254-258: motifs section in to_summary."""
        bible = self._make_bible()
        summary = bible.to_summary()
        assert "Rain" in summary
        assert "musical" in summary


# ---------------------------------------------------------------------------
# configure() function coverage
# ---------------------------------------------------------------------------


class TestConfigureFn:
    def test_configure_returns_settings(self):
        """Covers lines 339-341: configure() creates and returns Settings."""
        result = configure()
        assert result is not None
        reset_settings()

    def test_configure_creates_new_settings(self):
        from album_conceptualizer.config import get_settings

        reset_settings()
        s1 = get_settings()
        configure()
        # configure() replaces the singleton
        reset_settings()
        s2 = get_settings()
        assert s2 is not s1
        reset_settings()
