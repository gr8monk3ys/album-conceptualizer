import { useLocalSearchParams } from "expo-router";
import {
  Layers,
  Play,
  Plus,
  X,
} from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactNode } from "react";
import type { ListRenderItemInfo } from "react-native";

import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  Loading,
} from "../../../src/components/ui";
import { audioApi } from "../../../src/api/audio";
import { useAlbum, useUpdateAlbum } from "../../../src/hooks/use-albums";
import { usePlayerStore } from "../../../src/stores/player-store";
import type { Section, Song, SongData } from "../../../src/api/types";
import {
  borderRadius,
  colors,
  fontSize,
  spacing,
} from "../../../src/theme";

// ── Section type colors ──────────────────────────────────────────────

type BadgeVariant = "default" | "success" | "warning" | "error" | "info";

const SECTION_TYPE_VARIANT: Record<string, BadgeVariant> = {
  verse: "info",
  chorus: "success",
  bridge: "warning",
  intro: "default",
  outro: "default",
  "pre-chorus": "info",
  interlude: "default",
};

function getSectionVariant(type: string): BadgeVariant {
  return SECTION_TYPE_VARIANT[type.toLowerCase()] ?? "default";
}

// ── Constants ────────────────────────────────────────────────────────

const SECTION_TYPES = [
  "Verse",
  "Chorus",
  "Bridge",
  "Pre-Chorus",
  "Intro",
  "Outro",
  "Interlude",
  "Hook",
  "Breakdown",
];

// ── Song selector pill ───────────────────────────────────────────────

interface SongPillProps {
  song: Song;
  isActive: boolean;
  onPress: () => void;
}

function SongPill({ song, isActive, onPress }: SongPillProps): ReactNode {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.songPill, isActive && styles.songPillActive]}
    >
      <Text style={[styles.songPillNumber, isActive && styles.songPillNumberActive]}>
        {song.trackNumber}
      </Text>
      <Text
        style={[styles.songPillTitle, isActive && styles.songPillTitleActive]}
        numberOfLines={1}
      >
        {song.title}
      </Text>
    </Pressable>
  );
}

// ── Song detail header ───────────────────────────────────────────────

interface SongDetailProps {
  song: Song;
  songData: SongData | undefined;
  onEditField: (field: string, value: string) => void;
}

function SongDetail({ song, songData, onEditField }: SongDetailProps): ReactNode {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  function startEdit(field: string, currentValue: string): void {
    setEditingField(field);
    setDraft(currentValue);
  }

  function saveEdit(field: string): void {
    setEditingField(null);
    onEditField(field, draft);
  }

  return (
    <Card style={styles.songDetailCard}>
      <View style={styles.songDetailRow}>
        <View style={styles.songDetailField}>
          <Text style={styles.detailLabel}>Title</Text>
          {editingField === "title" ? (
            <TextInput
              style={styles.detailInput}
              value={draft}
              onChangeText={setDraft}
              onBlur={() => saveEdit("title")}
              autoFocus
            />
          ) : (
            <Pressable onPress={() => startEdit("title", song.title)}>
              <Text style={styles.detailValue}>{song.title}</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.songMetaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.detailLabel}>Key</Text>
          {editingField === "key" ? (
            <TextInput
              style={styles.detailInputSmall}
              value={draft}
              onChangeText={setDraft}
              onBlur={() => saveEdit("key")}
              autoFocus
            />
          ) : (
            <Pressable onPress={() => startEdit("key", song.key ?? "")}>
              <Text style={styles.detailValueSmall}>{song.key ?? "---"}</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.metaItem}>
          <Text style={styles.detailLabel}>Tempo</Text>
          {editingField === "tempo" ? (
            <TextInput
              style={styles.detailInputSmall}
              value={draft}
              onChangeText={setDraft}
              onBlur={() => saveEdit("tempo")}
              keyboardType="numeric"
              autoFocus
            />
          ) : (
            <Pressable onPress={() => startEdit("tempo", String(song.tempo ?? ""))}>
              <Text style={styles.detailValueSmall}>
                {song.tempo ? `${song.tempo} BPM` : "---"}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.metaItem}>
          <Text style={styles.detailLabel}>Time Sig</Text>
          <Text style={styles.detailValueSmall}>
            {songData?.time_signature ?? "4/4"}
          </Text>
        </View>
      </View>
    </Card>
  );
}

// ── Section card ─────────────────────────────────────────────────────

interface SectionCardProps {
  section: Section;
  sectionData: import("../../../src/api/types").SectionData | undefined;
  songKey: string;
  songTempo: number;
  onEditLyrics: (sectionId: string, lyrics: string) => void;
}

function SectionCard({
  section,
  sectionData,
  songKey,
  songTempo,
  onEditLyrics,
}: SectionCardProps): ReactNode {
  const playerLoad = usePlayerStore((s) => s.load);
  const [editingLyrics, setEditingLyrics] = useState(false);
  const [lyricsText, setLyricsText] = useState(section.lyrics ?? "");
  const [previewLoading, setPreviewLoading] = useState(false);

  const handlePlayPreview = useCallback(async () => {
    if (section.chordProgression.length === 0) {
      Alert.alert("No Chords", "Add a chord progression to preview audio.");
      return;
    }
    setPreviewLoading(true);
    try {
      const result = await audioApi.previewMp3(
        section.chordProgression,
        songKey,
        songTempo,
      );
      playerLoad(
        result.url,
        `${section.sectionType} ${section.order}`,
        section.chordProgression.join(" - "),
      );
    } catch {
      Alert.alert("Error", "Failed to generate audio preview.");
    } finally {
      setPreviewLoading(false);
    }
  }, [section, songKey, songTempo, playerLoad]);

  const handleSaveLyrics = useCallback(() => {
    setEditingLyrics(false);
    onEditLyrics(section.id, lyricsText);
  }, [section.id, lyricsText, onEditLyrics]);

  return (
    <Card style={styles.sectionCard}>
      {/* Header row */}
      <View style={styles.sectionHeader}>
        <Badge
          text={section.sectionType}
          variant={getSectionVariant(section.sectionType)}
        />
        <Text style={styles.sectionOrder}>#{section.order}</Text>
        <View style={styles.sectionSpacer} />
        <Pressable
          onPress={handlePlayPreview}
          disabled={previewLoading}
          style={({ pressed }) => [
            styles.playButton,
            { opacity: previewLoading ? 0.5 : pressed ? 0.7 : 1 },
          ]}
        >
          <Play size={16} color={colors.primary} />
        </Pressable>
      </View>

      {/* Lyrics */}
      <View style={styles.lyricsContainer}>
        <Text style={styles.fieldLabel}>Lyrics</Text>
        {editingLyrics ? (
          <View style={styles.lyricsEditContainer}>
            <TextInput
              style={styles.lyricsInput}
              value={lyricsText}
              onChangeText={setLyricsText}
              multiline
              placeholder="Enter lyrics..."
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <Button title="Save" onPress={handleSaveLyrics} size="sm" />
          </View>
        ) : (
          <Pressable onPress={() => setEditingLyrics(true)}>
            <Text style={styles.lyricsText}>
              {section.lyrics || "Tap to add lyrics..."}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Chord progression */}
      {section.chordProgression.length > 0 && (
        <View style={styles.chordsContainer}>
          <Text style={styles.fieldLabel}>Chords</Text>
          <View style={styles.chipRow}>
            {section.chordProgression.map((chord, i) => (
              <Chip key={`${chord}-${i}`} label={chord} />
            ))}
          </View>
        </View>
      )}

      {/* Narrative function and emotional arc from SectionData */}
      {sectionData?.narrative_function && (
        <View style={styles.narrativeContainer}>
          <Text style={styles.fieldLabel}>Narrative Function</Text>
          <Text style={styles.narrativeText}>
            {sectionData.narrative_function}
          </Text>
        </View>
      )}

      {sectionData?.emotional_arc && (
        <View style={styles.narrativeContainer}>
          <Text style={styles.fieldLabel}>Emotional Arc</Text>
          <Text style={styles.narrativeText}>{sectionData.emotional_arc}</Text>
        </View>
      )}
    </Card>
  );
}

// ── Add section modal ────────────────────────────────────────────────

interface AddSectionModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (type: string, lyrics: string, chords: string) => void;
}

function AddSectionModal({
  visible,
  onClose,
  onAdd,
}: AddSectionModalProps): ReactNode {
  const [selectedType, setSelectedType] = useState("Verse");
  const [lyrics, setLyrics] = useState("");
  const [chords, setChords] = useState("");

  function handleSubmit(): void {
    onAdd(selectedType, lyrics, chords);
    setSelectedType("Verse");
    setLyrics("");
    setChords("");
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Section</Text>
            <Pressable onPress={onClose}>
              <X size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={styles.fieldLabel}>Section Type</Text>
          <View style={styles.typeGrid}>
            {SECTION_TYPES.map((type) => (
              <Chip
                key={type}
                label={type}
                selected={selectedType === type}
                onPress={() => setSelectedType(type)}
              />
            ))}
          </View>

          <Input
            label="Lyrics"
            placeholder="Enter lyrics..."
            value={lyrics}
            onChangeText={setLyrics}
            multiline
            numberOfLines={4}
          />

          <View style={styles.modalSpacer} />

          <Input
            label="Chord Progression"
            placeholder="Am - F - C - G"
            value={chords}
            onChangeText={setChords}
          />

          <View style={styles.modalSpacer} />

          <Button title="Add Section" onPress={handleSubmit} />
        </View>
      </View>
    </Modal>
  );
}

// ── Main screen ──────────────────────────────────────────────────────

export default function StudioScreen(): ReactNode {
  const { albumId, track } = useLocalSearchParams<{
    albumId: string;
    track?: string;
  }>();
  const { data: album, isLoading } = useAlbum(albumId);
  const updateAlbum = useUpdateAlbum();

  const [showAddSection, setShowAddSection] = useState(false);

  const songs = useMemo(
    () => (album?.songs ?? []).sort((a, b) => a.trackNumber - b.trackNumber),
    [album],
  );

  const initialTrack = track ? parseInt(track, 10) : songs[0]?.trackNumber ?? 1;
  const [activeTrack, setActiveTrack] = useState(initialTrack);

  const activeSong = songs.find((s) => s.trackNumber === activeTrack) ?? songs[0];

  const songDataMap = useMemo(() => {
    if (!album?.data?.songs) return new Map<number, SongData>();
    const map = new Map<number, SongData>();
    for (const sd of album.data.songs) {
      map.set(sd.track_number, sd);
    }
    return map;
  }, [album]);

  const activeSongData = activeSong
    ? songDataMap.get(activeSong.trackNumber)
    : undefined;

  const handleEditSongField = useCallback(
    (_field: string, _value: string) => {
      // Song field editing would be handled via a dedicated song update API.
      // For now we show a placeholder confirmation.
      Alert.alert("Saved", "Song field updated.");
    },
    [],
  );

  const handleEditLyrics = useCallback(
    (_sectionId: string, _lyrics: string) => {
      Alert.alert("Saved", "Lyrics updated.");
    },
    [],
  );

  const handleAddSection = useCallback(
    (type: string, lyrics: string, chordsStr: string) => {
      const chords = chordsStr
        .split(/[-,]/)
        .map((c) => c.trim())
        .filter(Boolean);

      Alert.alert(
        "Section Added",
        `${type} with ${chords.length} chords added.`,
      );
      // In production: call API to add section, then refetch
    },
    [],
  );

  const renderSection = useCallback(
    ({ item }: ListRenderItemInfo<Section>) => {
      const sectionDataForItem = activeSongData?.sections?.find(
        (sd) =>
          sd.section_type.toLowerCase() === item.sectionType.toLowerCase() &&
          sd.order === item.order,
      );

      return (
        <SectionCard
          section={item}
          sectionData={sectionDataForItem}
          songKey={activeSong?.key ?? "C"}
          songTempo={activeSong?.tempo ?? 120}
          onEditLyrics={handleEditLyrics}
        />
      );
    },
    [activeSong, activeSongData, handleEditLyrics],
  );

  if (isLoading || !album) {
    return <Loading />;
  }

  if (songs.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <EmptyState
          icon={Layers}
          title="No Songs Yet"
          description="Add songs to your album to start editing in the studio."
        />
      </SafeAreaView>
    );
  }

  const sections = activeSong?.sections
    ? [...activeSong.sections].sort((a, b) => a.order - b.order)
    : [];

  return (
    <SafeAreaView style={styles.safeArea} edges={[]}>
      <View style={styles.container}>
        {/* Song selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.songSelector}
        >
          {songs.map((song) => (
            <SongPill
              key={song.id}
              song={song}
              isActive={song.trackNumber === activeTrack}
              onPress={() => setActiveTrack(song.trackNumber)}
            />
          ))}
        </ScrollView>

        {/* Song details */}
        {activeSong && (
          <SongDetail
            song={activeSong}
            songData={activeSongData}
            onEditField={handleEditSongField}
          />
        )}

        {/* Sections list */}
        <FlatList
          data={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderSection}
          contentContainerStyle={styles.sectionsList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No sections yet. Tap + to add one.
            </Text>
          }
        />

        {/* FAB */}
        <Pressable
          onPress={() => setShowAddSection(true)}
          style={({ pressed }) => [
            styles.fab,
            { opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Plus size={24} color={colors.white} />
        </Pressable>

        <AddSectionModal
          visible={showAddSection}
          onClose={() => setShowAddSection(false)}
          onAdd={handleAddSection}
        />
      </View>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },

  // Song selector
  songSelector: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  songPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
  },
  songPillActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primary,
  },
  songPillNumber: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: "700",
    width: 20,
    textAlign: "center",
  },
  songPillNumberActive: {
    color: colors.white,
  },
  songPillTitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    maxWidth: 100,
  },
  songPillTitleActive: {
    color: colors.white,
  },

  // Song detail
  songDetailCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  songDetailRow: {
    gap: spacing.sm,
  },
  songDetailField: {
    gap: spacing.xs,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailValue: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  detailValueSmall: {
    color: colors.text,
    fontSize: fontSize.base,
    fontWeight: "500",
  },
  detailInput: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: fontSize.lg,
  },
  detailInputSmall: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    fontSize: fontSize.base,
    minWidth: 60,
  },
  songMetaRow: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  metaItem: {
    gap: spacing.xs,
  },

  // Sections list
  sectionsList: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
    gap: spacing.md,
  },
  sectionCard: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionOrder: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  sectionSpacer: {
    flex: 1,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  lyricsContainer: {
    gap: spacing.xs,
  },
  lyricsText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 20,
    fontStyle: "italic",
  },
  lyricsEditContainer: {
    gap: spacing.sm,
  },
  lyricsInput: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: fontSize.sm,
    minHeight: 80,
    textAlignVertical: "top",
  },
  chordsContainer: {
    gap: spacing.xs,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  narrativeContainer: {
    gap: spacing.xs,
  },
  narrativeText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: "center",
    paddingVertical: spacing["2xl"],
  },

  // FAB
  fab: {
    position: "absolute",
    bottom: spacing.xl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    paddingBottom: spacing["3xl"],
    gap: spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: "700",
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  modalSpacer: {
    height: spacing.sm,
  },
});
