import { useRouter } from "expo-router";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Compass, GitFork, Heart, Search } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
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

import { AnimatedScreen, Badge, Card, EmptyState, ErrorState, Loading, LoadingInline } from "../../src/components/ui";
import { hapticLight } from "../../src/utils/haptics";
import { api } from "../../src/api/client";
import { albumsApi } from "../../src/api/albums";
import type { Album, AlbumListResponse } from "../../src/api/types";
import {
  borderRadius,
  colors,
  fontSize,
  spacing,
} from "../../src/theme";

// ── Data hooks ──────────────────────────────────────────────────────

function usePublicAlbums() {
  return useInfiniteQuery({
    queryKey: ["albums", "public"],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      params.set("public", "true");
      if (pageParam) params.set("cursor", pageParam as string);
      return api.get<AlbumListResponse>(`/api/albums?${params.toString()}`);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: AlbumListResponse) => lastPage.nextCursor,
  });
}

function useLikeAlbum() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => albumsApi.like(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["albums", "public"] });
    },
  });
}

function useForkAlbum() {
  const qc = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (id: string) => albumsApi.fork(id),
    onSuccess: (forkedAlbum) => {
      qc.invalidateQueries({ queryKey: ["albums"] });
      router.push(`/album/${forkedAlbum.id}`);
    },
  });
}

// ── Album Card ──────────────────────────────────────────────────────

interface DiscoverCardProps {
  album: Album;
  onPress: () => void;
  onLike: () => void;
  onFork: () => void;
}

function DiscoverCard({
  album,
  onPress,
  onLike,
  onFork,
}: DiscoverCardProps): ReactNode {
  const themes = album.centralThemes ?? [];

  return (
    <Card style={styles.discoverCard} onPress={onPress}>
      <Text style={styles.albumTitle} numberOfLines={1}>
        {album.title}
      </Text>
      <Text style={styles.albumArtist} numberOfLines={1}>
        {album.artist}
      </Text>

      {themes.length > 0 && (
        <View style={styles.tagsRow}>
          {themes.slice(0, 3).map((theme) => (
            <Badge key={theme} text={theme} variant="info" />
          ))}
        </View>
      )}

      {album.primaryGenre && (
        <Badge text={album.primaryGenre} />
      )}

      <View style={styles.actionsRow}>
        <Pressable
          onPress={() => {
            hapticLight();
            onLike();
          }}
          hitSlop={8}
          style={({ pressed }) => [
            styles.actionButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Heart size={18} color={colors.error} />
          <Text style={styles.actionText}>Like</Text>
        </Pressable>

        <Pressable
          onPress={onFork}
          hitSlop={8}
          style={({ pressed }) => [
            styles.actionButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <GitFork size={18} color={colors.primary} />
          <Text style={styles.actionText}>Fork</Text>
        </Pressable>
      </View>
    </Card>
  );
}

// ── Main screen ─────────────────────────────────────────────────────

export default function DiscoverScreen(): ReactNode {
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
  } = usePublicAlbums();
  const likeAlbum = useLikeAlbum();
  const forkAlbum = useForkAlbum();
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
      <DiscoverCard
        album={item}
        onPress={() => router.push(`/album/${item.id}`)}
        onLike={() => likeAlbum.mutate(item.id)}
        onFork={() => forkAlbum.mutate(item.id)}
      />
    ),
    [router, likeAlbum, forkAlbum],
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
        <Text style={styles.screenTitle}>Discover</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Search size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search public albums..."
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
        ListHeaderComponent={
          filteredAlbums.length > 0 ? (
            <View style={styles.trendingHeader}>
              <Text style={styles.trendingTitle}>Trending</Text>
            </View>
          ) : null
        }
        ListFooterComponent={isFetchingNextPage ? <LoadingInline /> : null}
        ListEmptyComponent={
          <EmptyState
            icon={Compass}
            title="Nothing here yet"
            description="Public albums will appear here once they are published."
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
  trendingHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  trendingTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: "700",
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing["3xl"],
    gap: spacing.md,
  },
  emptyContainer: {
    flex: 1,
  },
  discoverCard: {
    gap: spacing.sm,
  },
  albumTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  albumArtist: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.xl,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  actionText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: "500",
  },
});
