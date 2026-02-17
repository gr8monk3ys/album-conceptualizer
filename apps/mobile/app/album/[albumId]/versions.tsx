import { useLocalSearchParams } from "expo-router";
import { GitBranch, Plus, RotateCcw } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactNode } from "react";
import type { ListRenderItemInfo } from "react-native";

import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Input,
  Loading,
} from "../../../src/components/ui";
import { albumsApi } from "../../../src/api/albums";
import { useAlbumVersions } from "../../../src/hooks/use-albums";
import type { AlbumVersion } from "../../../src/api/types";
import {
  borderRadius,
  colors,
  fontSize,
  spacing,
} from "../../../src/theme";

// ── Helpers ──────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ── Version row ──────────────────────────────────────────────────────

interface VersionRowProps {
  version: AlbumVersion;
  onRestore: () => void;
}

function VersionRow({ version, onRestore }: VersionRowProps): ReactNode {
  const authorName = version.createdBy?.name ?? "Unknown";

  return (
    <Card style={styles.versionCard}>
      <View style={styles.versionRow}>
        <Avatar
          name={authorName}
          uri={version.createdBy?.image ?? undefined}
          size="sm"
        />
        <View style={styles.versionInfo}>
          <Text style={styles.versionMessage} numberOfLines={2}>
            {version.message ?? "No message"}
          </Text>
          <View style={styles.versionMeta}>
            <Text style={styles.versionAuthor}>{authorName}</Text>
            <Text style={styles.versionDot}>-</Text>
            <Text style={styles.versionTime}>
              {formatRelativeTime(version.createdAt)}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={onRestore}
          style={({ pressed }) => [
            styles.restoreButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <RotateCcw size={16} color={colors.primary} />
        </Pressable>
      </View>
    </Card>
  );
}

// ── Create snapshot modal ────────────────────────────────────────────

interface CreateSnapshotModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (message: string) => void;
  loading: boolean;
}

function CreateSnapshotModal({
  visible,
  onClose,
  onSubmit,
  loading,
}: CreateSnapshotModalProps): ReactNode {
  const [message, setMessage] = useState("");

  function handleSubmit(): void {
    onSubmit(message);
    setMessage("");
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create Snapshot</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.modalClose}>Cancel</Text>
            </Pressable>
          </View>

          <Input
            label="Message"
            placeholder="Describe this version..."
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={3}
          />

          <View style={styles.modalSpacer} />

          <Button
            title="Create Snapshot"
            onPress={handleSubmit}
            loading={loading}
            disabled={!message.trim()}
          />
        </View>
      </View>
    </Modal>
  );
}

// ── Main screen ──────────────────────────────────────────────────────

export default function VersionsScreen(): ReactNode {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const {
    data: versions,
    isLoading,
    refetch,
    isRefetching,
  } = useAlbumVersions(albumId);

  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const handleRestore = useCallback(
    (version: AlbumVersion) => {
      Alert.alert(
        "Restore Version",
        `Are you sure you want to restore to "${version.message ?? "this version"}"? Current changes will be overwritten.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Restore",
            style: "destructive",
            onPress: async () => {
              try {
                await albumsApi.restoreVersion(albumId, version.id);
                refetch();
                Alert.alert("Restored", "Version has been restored.");
              } catch {
                Alert.alert("Error", "Failed to restore version.");
              }
            },
          },
        ],
      );
    },
    [albumId, refetch],
  );

  const handleCreateSnapshot = useCallback(
    async (message: string) => {
      setCreateLoading(true);
      try {
        await albumsApi.createVersion(albumId, message);
        setShowCreate(false);
        refetch();
      } catch {
        Alert.alert("Error", "Failed to create snapshot.");
      } finally {
        setCreateLoading(false);
      }
    },
    [albumId, refetch],
  );

  const renderVersion = useCallback(
    ({ item }: ListRenderItemInfo<AlbumVersion>) => (
      <VersionRow version={item} onRestore={() => handleRestore(item)} />
    ),
    [handleRestore],
  );

  if (isLoading) {
    return <Loading />;
  }

  const versionsList = versions ?? [];

  return (
    <SafeAreaView style={styles.safeArea} edges={[]}>
      {/* Header action */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>
          {versionsList.length} {versionsList.length === 1 ? "version" : "versions"}
        </Text>
        <Button
          title="Snapshot"
          onPress={() => setShowCreate(true)}
          size="sm"
          icon={<Plus size={14} color={colors.white} />}
        />
      </View>

      <FlatList
        data={versionsList}
        keyExtractor={(item) => item.id}
        renderItem={renderVersion}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon={GitBranch}
            title="No Versions Yet"
            description="Create a snapshot to save a point-in-time copy of your album."
            action={{
              title: "Create Snapshot",
              onPress: () => setShowCreate(true),
            }}
          />
        }
      />

      <CreateSnapshotModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreateSnapshot}
        loading={createLoading}
      />
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing["3xl"],
    gap: spacing.sm,
    flexGrow: 1,
  },

  // Version card
  versionCard: {
    padding: spacing.md,
  },
  versionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  versionInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  versionMessage: {
    color: colors.text,
    fontSize: fontSize.base,
    fontWeight: "500",
    lineHeight: 20,
  },
  versionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  versionAuthor: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: "500",
  },
  versionDot: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
  versionTime: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
  restoreButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
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
  modalClose: {
    color: colors.primary,
    fontSize: fontSize.base,
    fontWeight: "600",
  },
  modalSpacer: {
    height: spacing.sm,
  },
});
