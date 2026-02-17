import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Disc3,
  GitFork,
  Hash,
  Music,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
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
} from "../../src/components/ui";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/hooks/use-auth";
import type { Album, Song } from "../../src/api/types";
import {
  borderRadius,
  colors,
  fontSize,
  spacing,
} from "../../src/theme";

// ── Song card ────────────────────────────────────────────────────────

interface SharedSongCardProps {
  song: Song;
}

function SharedSongCard({ song }: SharedSongCardProps): ReactNode {
  return (
    <Card style={styles.songCard}>
      <View style={styles.songHeader}>
        <View style={styles.trackBadge}>
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
      </View>

      {/* Sections with lyrics */}
      {(song.sections?.length ?? 0) > 0 && (
        <View style={styles.sectionsContainer}>
          {song.sections
            .sort((a, b) => a.order - b.order)
            .map((section) => (
              <View key={section.id} style={styles.sectionBlock}>
                <Text style={styles.sectionType}>
                  {section.sectionType}
                </Text>
                {section.lyrics && (
                  <Text style={styles.sectionLyrics}>
                    {section.lyrics}
                  </Text>
                )}
              </View>
            ))}
        </View>
      )}
    </Card>
  );
}

// ── Main screen ──────────────────────────────────────────────────────

export default function SharedAlbumScreen(): ReactNode {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [forking, setForking] = useState(false);

  // NOTE: The backend has no GET /api/share/:token endpoint yet (only POST /api/share/:token/fork).
  // We attempt to fetch but gracefully handle 404 by showing a fork-only UI.
  const { data: album, isLoading, error } = useQuery({
    queryKey: ["shared-album", token],
    queryFn: () => api.get<Album>(`/api/share/${token}`),
    retry: false,
  });

  const handleFork = useCallback(async () => {
    if (!isAuthenticated) {
      Alert.alert(
        "Sign In Required",
        "You need to sign in to fork this album to your library.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Sign In",
            onPress: () => router.push("/(auth)/sign-in" as never),
          },
        ],
      );
      return;
    }

    setForking(true);
    try {
      // Use the share-token fork endpoint (POST /api/share/:token/fork)
      const forked = await api.post<{ id: string }>(`/api/share/${token}/fork`);
      Alert.alert("Success", "Album forked to your library!", [
        {
          text: "View Album",
          onPress: () =>
            router.replace(`/album/${forked.id}` as never),
        },
      ]);
    } catch {
      Alert.alert("Error", "Failed to fork album. Please try again.");
    } finally {
      setForking(false);
    }
  }, [isAuthenticated, token, router]);

  if (isLoading) {
    return <Loading />;
  }

  if (error && !album) {
    // The GET endpoint may not exist yet -- show fork-only UI
    return (
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <View style={styles.errorContainer}>
          <Disc3 size={48} color={colors.primary} strokeWidth={1.5} />
          <Text style={styles.errorTitle}>Shared Album</Text>
          <Text style={styles.errorDescription}>
            Someone shared an album with you. Fork it to your library to
            start editing.
          </Text>
          <View style={styles.forkSection}>
            <Button
              title="Fork to My Library"
              onPress={handleFork}
              variant="primary"
              size="lg"
              loading={forking}
              icon={<GitFork size={20} color={colors.white} />}
            />
            {!isAuthenticated && (
              <Text style={styles.forkHint}>
                Sign in required to fork albums
              </Text>
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!album) {
    return (
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <View style={styles.errorContainer}>
          <Disc3 size={48} color={colors.textMuted} strokeWidth={1.5} />
          <Text style={styles.errorTitle}>Album Not Found</Text>
          <Text style={styles.errorDescription}>
            This shared link may have expired or the album is no longer
            available.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const songs = album.songs ?? [];

  return (
    <SafeAreaView style={styles.safeArea} edges={[]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Album header */}
        <View style={styles.albumHeader}>
          <Badge text="Shared Album" variant="info" />
          <Text style={styles.albumTitle}>{album.title}</Text>
          <Text style={styles.albumArtist}>{album.artist}</Text>
        </View>

        {/* Concept summary */}
        {album.conceptSummary && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Concept</Text>
            <Text style={styles.conceptText}>{album.conceptSummary}</Text>
          </View>
        )}

        {/* Genre */}
        {album.primaryGenre && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Genre</Text>
            <View style={styles.chipRow}>
              <Chip label={album.primaryGenre} selected />
            </View>
          </View>
        )}

        {/* Themes */}
        {(album.centralThemes?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Themes</Text>
            <View style={styles.chipRow}>
              {album.centralThemes?.map((theme) => (
                <Chip key={theme} label={theme} />
              ))}
            </View>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Hash size={16} color={colors.primary} />
            <Text style={styles.statValue}>{songs.length}</Text>
            <Text style={styles.statLabel}>Songs</Text>
          </View>
          <View style={styles.statBox}>
            <Music size={16} color={colors.primary} />
            <Text style={styles.statValue}>
              {songs.reduce((acc, s) => acc + (s.sections?.length ?? 0), 0)}
            </Text>
            <Text style={styles.statLabel}>Sections</Text>
          </View>
        </View>

        {/* Songs list */}
        {songs.length > 0 && (
          <View style={styles.songsSection}>
            <SectionHeader title="Tracks" />
            <View style={styles.songsList}>
              {songs
                .sort((a, b) => a.trackNumber - b.trackNumber)
                .map((song) => (
                  <SharedSongCard key={song.id} song={song} />
                ))}
            </View>
          </View>
        )}

        {/* Fork button */}
        <View style={styles.forkSection}>
          <Button
            title="Fork to My Library"
            onPress={handleFork}
            variant="primary"
            size="lg"
            loading={forking}
            icon={<GitFork size={20} color={colors.white} />}
          />
          {!isAuthenticated && (
            <Text style={styles.forkHint}>
              Sign in required to fork albums
            </Text>
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

  // Error state
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing["2xl"],
    gap: spacing.md,
  },
  errorTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: "600",
    marginTop: spacing.sm,
  },
  errorDescription: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: "center",
    lineHeight: 20,
  },

  // Album header
  albumHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.sm,
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

  // Sections
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

  // Stats
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

  // Songs
  songsSection: {
    paddingTop: spacing.xl,
  },
  songsList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  songCard: {
    gap: spacing.md,
  },
  songHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  trackBadge: {
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

  // Sections within a song
  sectionsContainer: {
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
  sectionBlock: {
    gap: spacing.xs,
  },
  sectionType: {
    color: colors.primaryLight,
    fontSize: fontSize.xs,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionLyrics: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 20,
    fontStyle: "italic",
  },

  // Fork
  forkSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing["2xl"],
    gap: spacing.sm,
    alignItems: "center",
  },
  forkHint: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    textAlign: "center",
  },
});
