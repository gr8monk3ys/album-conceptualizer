import { useRouter } from "expo-router";
import { Library, Search, Trash2 } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ListRenderItem } from "react-native";
import type { ReactNode } from "react";

import { AnimatedScreen, Badge, EmptyState, ErrorState, Loading, LoadingInline } from "../../src/components/ui";
import { useAlbums, useDeleteAlbum } from "../../src/hooks/use-albums";
import type { Album } from "../../src/api/types";
import {
  borderRadius,
  colors,
  fontSize,
  spacing,
} from "../../src/theme";

// ── Helpers ─────────────────────────────────────────────────────────

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusBadgeVariant(status: Album["status"]): "success" | "warning" {
  if (status === "published") {
    return "success";
  }
  return "warning";
}

// ── Album Row ───────────────────────────────────────────────────────

interface AlbumRowProps {
  album: Album;
  onPress: () => void;
  onDelete: () => void;
}

function AlbumRow({ album, onPress, onDelete }: AlbumRowProps): ReactNode {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onDelete}
      style={({ pressed }) => [
        styles.albumRow,
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.albumRowContent}>
        <View style={styles.albumRowMain}>
          <Text style={styles.albumTitle} numberOfLines={1}>
            {album.title}
          </Text>
          <Text style={styles.albumArtist} numberOfLines={1}>
            {album.artist}
          </Text>
          <View style={styles.albumRowMeta}>
            {album.primaryGenre && <Badge text={album.primaryGenre} />}
            <Badge
              text={album.status}
              variant={statusBadgeVariant(album.status)}
            />
          </View>
        </View>

        <View style={styles.albumRowRight}>
          <Text style={styles.trackCountText}>
            {album.trackCount} {album.trackCount === 1 ? "track" : "tracks"}
          </Text>
          <Text style={styles.dateText}>{formatDate(album.updatedAt)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ── Main screen ─────────────────────────────────────────────────────

export default function LibraryScreen(): ReactNode {
  const router = useRouter();
  const {
    data,
    isLoading,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAlbums();
  const deleteAlbum = useDeleteAlbum();
  const [searchQuery, setSearchQuery] = useState("");

  const albums = data?.pages.flatMap((page) => page.albums) ?? [];

  const filteredAlbums = useMemo(() => {
    if (albums.length === 0) return [];

    const query = searchQuery.toLowerCase().trim();
    if (!query) return albums;

    return albums.filter(
      (album) =>
        album.title.toLowerCase().includes(query) ||
        album.artist.toLowerCase().includes(query),
    );
  }, [albums, searchQuery]);

  const handleDelete = useCallback(
    (album: Album) => {
      Alert.alert(
        "Delete Album",
        `Are you sure you want to delete "${album.title}"? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deleteAlbum.mutate(album.id),
          },
        ],
      );
    },
    [deleteAlbum],
  );

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem: ListRenderItem<Album> = useCallback(
    ({ item }) => (
      <AlbumRow
        album={item}
        onPress={() => router.push(`/album/${item.id}`)}
        onDelete={() => handleDelete(item)}
      />
    ),
    [router, handleDelete],
  );

  const keyExtractor = useCallback((item: Album) => item.id, []);

  if (isLoading) {
    return <Loading />;
  }

  if (error) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  return (
    <AnimatedScreen>
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Library</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Search size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search albums..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery("")}>
            <Text style={styles.clearButton}>Clear</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={filteredAlbums}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={
          filteredAlbums.length === 0 ? styles.emptyContainer : styles.listContent
        }
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={isFetchingNextPage ? <LoadingInline /> : null}
        ListEmptyComponent={
          <EmptyState
            icon={Library}
            title="No albums yet"
            description="Create your first concept album to get started."
            action={{
              title: "Create Album",
              onPress: () => router.push("/create"),
            }}
          />
        }
      />
    </SafeAreaView>
    </AnimatedScreen>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  screenTitle: {
    color: colors.text,
    fontSize: fontSize["2xl"],
    fontWeight: "700",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.base,
  },
  clearButton: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  listContent: {
    paddingBottom: spacing["3xl"],
  },
  emptyContainer: {
    flex: 1,
  },
  albumRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  albumRowContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  albumRowMain: {
    flex: 1,
    gap: spacing.xs,
  },
  albumTitle: {
    color: colors.text,
    fontSize: fontSize.base,
    fontWeight: "600",
  },
  albumArtist: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  albumRowMeta: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  albumRowRight: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  trackCountText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  dateText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
});
