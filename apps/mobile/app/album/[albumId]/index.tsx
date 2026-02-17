import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Globe,
  Hash,
  Music,
  Share2,
  Sparkles,
  Upload,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactNode } from "react";

import {
  Badge,
  Button,
  Card,
  Chip,
  Loading,
  SectionHeader,
} from "../../../src/components/ui";
import { albumsApi } from "../../../src/api/albums";
import { useAlbum, useUpdateAlbum } from "../../../src/hooks/use-albums";
import type { Song } from "../../../src/api/types";
import {
  borderRadius,
  colors,
  fontSize,
  spacing,
} from "../../../src/theme";

// ── Editable field ───────────────────────────────────────────────────

interface EditableFieldProps {
  value: string;
  onSave: (value: string) => void;
  isEditing: boolean;
  onStartEdit: () => void;
  placeholder: string;
  multiline?: boolean;
  style?: object;
}

function EditableField({
  value,
  onSave,
  isEditing,
  onStartEdit,
  placeholder,
  multiline = false,
  style,
}: EditableFieldProps): ReactNode {
  const [draft, setDraft] = useState(value);

  if (isEditing) {
    return (
      <TextInput
        style={[styles.editInput, multiline && styles.editMultiline, style]}
        value={draft}
        onChangeText={setDraft}
        onBlur={() => onSave(draft)}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        autoFocus
      />
    );
  }

  return (
    <Pressable onPress={onStartEdit}>
      <Text style={[styles.fieldText, style]} numberOfLines={multiline ? 5 : 1}>
        {value || placeholder}
      </Text>
    </Pressable>
  );
}

// ── Song row ─────────────────────────────────────────────────────────

interface SongRowProps {
  song: Song;
  onPress: () => void;
}

function SongRow({ song, onPress }: SongRowProps): ReactNode {
  return (
    <Card style={styles.songCard} onPress={onPress}>
      <View style={styles.songRow}>
        <View style={styles.trackNumberContainer}>
          <Text style={styles.trackNumber}>{song.trackNumber}</Text>
        </View>
        <View style={styles.songInfo}>
          <Text style={styles.songTitle} numberOfLines={1}>
            {song.title}
          </Text>
          <View style={styles.songMeta}>
            {song.key && (
              <Text style={styles.songMetaText}>Key: {song.key}</Text>
            )}
            {song.tempo && (
              <Text style={styles.songMetaText}>{song.tempo} BPM</Text>
            )}
          </View>
        </View>
        <Music size={18} color={colors.textMuted} />
      </View>
    </Card>
  );
}

// ── Main screen ──────────────────────────────────────────────────────

export default function AlbumOverviewScreen(): ReactNode {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const router = useRouter();
  const { data: album, isLoading, refetch, isRefetching } = useAlbum(albumId);
  const updateAlbum = useUpdateAlbum();

  const [editingField, setEditingField] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleSaveField = useCallback(
    (field: string, value: string) => {
      setEditingField(null);
      if (!album) return;

      const current = album[field as keyof typeof album];
      if (current === value) return;

      updateAlbum.mutate({ id: albumId, data: { [field]: value } as never });
    },
    [album, albumId, updateAlbum],
  );

  const handlePublish = useCallback(async () => {
    setActionLoading("publish");
    try {
      await albumsApi.publish(albumId);
      refetch();
    } catch {
      Alert.alert("Error", "Failed to publish album");
    } finally {
      setActionLoading(null);
    }
  }, [albumId, refetch]);

  const handleShare = useCallback(async () => {
    setActionLoading("share");
    try {
      const result = await albumsApi.share(albumId);
      Alert.alert("Share Link", `Share token: ${result.token}`);
    } catch {
      Alert.alert("Error", "Failed to generate share link");
    } finally {
      setActionLoading(null);
    }
  }, [albumId]);

  const handleExport = useCallback(() => {
    router.push(`/album/${albumId}/export` as never);
  }, [albumId, router]);

  const handleAutotag = useCallback(async () => {
    setActionLoading("autotag");
    try {
      await albumsApi.autotag(albumId);
      refetch();
      Alert.alert("Success", "Album auto-tagged successfully");
    } catch {
      Alert.alert("Error", "Failed to auto-tag album");
    } finally {
      setActionLoading(null);
    }
  }, [albumId, refetch]);

  const handleSongPress = useCallback(
    (trackNumber: number) => {
      router.push(`/album/${albumId}/studio?track=${trackNumber}` as never);
    },
    [albumId, router],
  );

  if (isLoading || !album) {
    return <Loading />;
  }

  const songs = album.songs ?? [];
  const sectionCount = songs.reduce((acc, s) => acc + s.sections.length, 0);
  const isPublished = album.status === "published";

  return (
    <SafeAreaView style={styles.safeArea} edges={[]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={colors.primary}
          />
        }
      >
        {/* Title */}
        <View style={styles.headerSection}>
          <EditableField
            value={album.title}
            onSave={(v) => handleSaveField("title", v)}
            isEditing={editingField === "title"}
            onStartEdit={() => setEditingField("title")}
            placeholder="Album Title"
            style={styles.albumTitle}
          />
          <EditableField
            value={album.artist}
            onSave={(v) => handleSaveField("artist", v)}
            isEditing={editingField === "artist"}
            onStartEdit={() => setEditingField("artist")}
            placeholder="Artist Name"
            style={styles.albumArtist}
          />
        </View>

        {/* Status badge */}
        <View style={styles.statusRow}>
          <Badge
            text={isPublished ? "Published" : "Draft"}
            variant={isPublished ? "success" : "warning"}
          />
        </View>

        {/* Concept summary */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Concept</Text>
          <EditableField
            value={album.conceptSummary ?? ""}
            onSave={(v) => handleSaveField("conceptSummary", v)}
            isEditing={editingField === "conceptSummary"}
            onStartEdit={() => setEditingField("conceptSummary")}
            placeholder="Describe the album concept..."
            multiline
            style={styles.conceptText}
          />
        </View>

        {/* Genre & theme tags */}
        {album.primaryGenre && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Genre</Text>
            <View style={styles.chipRow}>
              <Chip label={album.primaryGenre} selected />
            </View>
          </View>
        )}

        {album.centralThemes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Themes</Text>
            <View style={styles.chipRow}>
              {album.centralThemes.map((theme) => (
                <Chip key={theme} label={theme} />
              ))}
            </View>
          </View>
        )}

        {/* Quick stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Hash size={16} color={colors.primary} />
            <Text style={styles.statValue}>{songs.length}</Text>
            <Text style={styles.statLabel}>Songs</Text>
          </View>
          <View style={styles.statBox}>
            <Music size={16} color={colors.primary} />
            <Text style={styles.statValue}>{sectionCount}</Text>
            <Text style={styles.statLabel}>Sections</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          <Button
            title={isPublished ? "Unpublish" : "Publish"}
            onPress={handlePublish}
            variant={isPublished ? "secondary" : "primary"}
            size="sm"
            loading={actionLoading === "publish"}
            icon={<Globe size={16} color={isPublished ? colors.text : colors.white} />}
          />
          <Button
            title="Share"
            onPress={handleShare}
            variant="secondary"
            size="sm"
            loading={actionLoading === "share"}
            icon={<Share2 size={16} color={colors.text} />}
          />
          <Button
            title="Export"
            onPress={handleExport}
            variant="secondary"
            size="sm"
            icon={<Upload size={16} color={colors.text} />}
          />
          <Button
            title="Autotag"
            onPress={handleAutotag}
            variant="ghost"
            size="sm"
            loading={actionLoading === "autotag"}
            icon={<Sparkles size={16} color={colors.textSecondary} />}
          />
        </View>

        {/* Songs list */}
        <SectionHeader title="Tracks" />
        <View style={styles.songsList}>
          {songs.length === 0 ? (
            <Text style={styles.emptyText}>
              No songs yet. Head to Studio to add tracks.
            </Text>
          ) : (
            songs
              .sort((a, b) => a.trackNumber - b.trackNumber)
              .map((song) => (
                <SongRow
                  key={song.id}
                  song={song}
                  onPress={() => handleSongPress(song.trackNumber)}
                />
              ))
          )}
        </View>
      </ScrollView>
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
  content: {
    paddingBottom: spacing["3xl"],
  },
  headerSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.xs,
  },
  albumTitle: {
    color: colors.text,
    fontSize: fontSize["3xl"],
    fontWeight: "700",
  },
  albumArtist: {
    color: colors.textSecondary,
    fontSize: fontSize.lg,
  },
  statusRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    flexDirection: "row",
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  conceptText: {
    color: colors.textSecondary,
    fontSize: fontSize.base,
    lineHeight: 22,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  statBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  statValue: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: "700",
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  songsList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  songCard: {
    padding: spacing.md,
  },
  songRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  trackNumberContainer: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  trackNumber: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
  songInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  songTitle: {
    color: colors.text,
    fontSize: fontSize.base,
    fontWeight: "600",
  },
  songMeta: {
    flexDirection: "row",
    gap: spacing.md,
  },
  songMetaText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: "center",
    paddingVertical: spacing.xl,
  },
  fieldText: {
    color: colors.text,
    fontSize: fontSize.base,
  },
  editInput: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: fontSize.base,
  },
  editMultiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
});
