import { useRouter } from "expo-router";
import { Disc3, Music, Sparkles, Compass } from "lucide-react-native";
import { useCallback } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactNode } from "react";

import {
  AnimatedScreen,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  GradientHeader,
  Loading,
  SectionHeader,
} from "../../src/components/ui";
import { AlbumCover } from "../../src/components/album/album-cover";
import { useAlbums } from "../../src/hooks/use-albums";
import { useAuth } from "../../src/hooks/use-auth";
import type { Album } from "../../src/api/types";
import {
  borderRadius,
  colors,
  fontSize,
  spacing,
} from "../../src/theme";

// ── Sub-components ──────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  icon: ReactNode;
}

function StatCard({ label, value, icon }: StatCardProps): ReactNode {
  return (
    <Card style={styles.statCard}>
      <View style={styles.statIcon}>{icon}</View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

interface AlbumCardProps {
  album: Album;
  onPress: () => void;
}

function AlbumCard({ album, onPress }: AlbumCardProps): ReactNode {
  return (
    <Card style={styles.albumCard} onPress={onPress}>
      <AlbumCover coverUrl={album.coverUrl} size={48} />
      <Text style={styles.albumTitle} numberOfLines={1}>
        {album.title}
      </Text>
      <Text style={styles.albumArtist} numberOfLines={1}>
        {album.artist}
      </Text>
      <View style={styles.albumMeta}>
        {album.primaryGenre && (
          <Badge text={album.primaryGenre} />
        )}
        <Text style={styles.trackCount}>
          {album.trackCount} {album.trackCount === 1 ? "track" : "tracks"}
        </Text>
      </View>
    </Card>
  );
}

interface QuickActionProps {
  title: string;
  description: string;
  icon: ReactNode;
  onPress: () => void;
}

function QuickAction({
  title,
  description,
  icon,
  onPress,
}: QuickActionProps): ReactNode {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickAction,
        { opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <View style={styles.quickActionIcon}>{icon}</View>
      <View style={styles.quickActionText}>
        <Text style={styles.quickActionTitle}>{title}</Text>
        <Text style={styles.quickActionDesc}>{description}</Text>
      </View>
    </Pressable>
  );
}

// ── Main screen ─────────────────────────────────────────────────────

export default function HomeScreen(): ReactNode {
  const router = useRouter();
  const { user } = useAuth();
  const { data, isLoading, error, refetch, isRefetching } = useAlbums();
  const albums = data?.pages.flatMap((page) => page.albums) ?? [];

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  if (isLoading) {
    return <Loading />;
  }

  if (error) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  const allAlbums = albums;
  const draftCount = allAlbums.filter((a) => a.status === "draft").length;
  const recentAlbums = allAlbums.slice(0, 5);

  const displayName = user?.name ?? "there";

  return (
    <AnimatedScreen>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {/* Welcome */}
          <GradientHeader
            title={`Welcome back,`}
            subtitle={displayName}
          />

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <StatCard
            label="Albums"
            value={allAlbums.length}
            icon={<Disc3 size={20} color={colors.primary} />}
          />
          <StatCard
            label="Drafts"
            value={draftCount}
            icon={<Music size={20} color={colors.warning} />}
          />
        </View>

        {/* Recent Albums */}
        {recentAlbums.length > 0 ? (
          <View>
            <SectionHeader
              title="Recent Albums"
              action={{
                title: "See All",
                onPress: () => router.push("/(tabs)/library"),
              }}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.albumsScroll}
            >
              {recentAlbums.map((album) => (
                <AlbumCard
                  key={album.id}
                  album={album}
                  onPress={() => router.push(`/album/${album.id}`)}
                />
              ))}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.emptyAlbumsContainer}>
            <EmptyState
              icon={Disc3}
              title="No albums yet"
              description="Create your first concept album to get started."
              action={{
                title: "Create Album",
                onPress: () => router.push("/create"),
              }}
            />
          </View>
        )}

        {/* Quick Actions */}
        <SectionHeader title="Quick Actions" />
        <View style={styles.actionsContainer}>
          <QuickAction
            title="Create Album"
            description="Start a new concept album"
            icon={<Sparkles size={20} color={colors.primary} />}
            onPress={() => router.push("/create")}
          />
          <QuickAction
            title="Discover"
            description="Explore public albums"
            icon={<Compass size={20} color={colors.info} />}
            onPress={() => router.push("/(tabs)/discover")}
          />
          <QuickAction
            title="Challenges"
            description="Coming soon"
            icon={<Music size={20} color={colors.warning} />}
            onPress={() => {}}
          />
        </View>
        </ScrollView>
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
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: spacing["3xl"],
  },
  // Stats
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    gap: spacing.sm,
  },
  statIcon: {
    marginBottom: spacing.xs,
  },
  statValue: {
    color: colors.text,
    fontSize: fontSize["2xl"],
    fontWeight: "700",
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },

  // Empty albums
  emptyAlbumsContainer: {
    paddingVertical: spacing.xl,
    minHeight: 200,
  },

  // Album cards
  albumsScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  albumCard: {
    width: 160,
    gap: spacing.sm,
  },
  albumTitle: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  albumArtist: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
  },
  albumMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  trackCount: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },

  // Quick actions
  actionsContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  quickAction: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionText: {
    flex: 1,
    gap: spacing.xs,
  },
  quickActionTitle: {
    color: colors.text,
    fontSize: fontSize.base,
    fontWeight: "600",
  },
  quickActionDesc: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
});
