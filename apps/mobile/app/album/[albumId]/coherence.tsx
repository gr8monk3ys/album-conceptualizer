import { useLocalSearchParams } from "expo-router";
import {
  AlertTriangle,
  CheckCircle,
  Network,
  RefreshCw,
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
  EmptyState,
  Loading,
} from "../../../src/components/ui";
import { albumsApi } from "../../../src/api/albums";
import { useAlbum } from "../../../src/hooks/use-albums";
import type { Song } from "../../../src/api/types";
import {
  borderRadius,
  colors,
  fontSize,
  spacing,
} from "../../../src/theme";

// ── Warning item ─────────────────────────────────────────────────────

interface NarrativeWarning {
  id: string;
  type: "warning" | "suggestion";
  message: string;
  tracks: number[];
}

interface WarningCardProps {
  warning: NarrativeWarning;
}

function WarningCard({ warning }: WarningCardProps): ReactNode {
  const isWarning = warning.type === "warning";

  return (
    <Card style={styles.warningCard}>
      <View style={styles.warningRow}>
        {isWarning ? (
          <AlertTriangle size={18} color={colors.warning} />
        ) : (
          <CheckCircle size={18} color={colors.info} />
        )}
        <View style={styles.warningContent}>
          <Badge
            text={isWarning ? "Warning" : "Suggestion"}
            variant={isWarning ? "warning" : "info"}
          />
          <Text style={styles.warningText}>{warning.message}</Text>
          {warning.tracks.length > 0 && (
            <Text style={styles.warningTracks}>
              Tracks: {warning.tracks.join(", ")}
            </Text>
          )}
        </View>
      </View>
    </Card>
  );
}

// ── Timeline song item ───────────────────────────────────────────────

interface TimelineSongProps {
  song: Song;
  narrativePosition: string | undefined;
  isLast: boolean;
}

function TimelineSong({ song, narrativePosition, isLast }: TimelineSongProps): ReactNode {
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineLeft}>
        <View style={styles.timelineDot} />
        {!isLast && <View style={styles.timelineLine} />}
      </View>
      <Card style={styles.timelineCard}>
        <View style={styles.timelineCardHeader}>
          <Text style={styles.timelineTrackNumber}>
            Track {song.trackNumber}
          </Text>
          <Text style={styles.timelineSongTitle} numberOfLines={1}>
            {song.title}
          </Text>
        </View>
        {narrativePosition && (
          <Text style={styles.timelineNarrative}>{narrativePosition}</Text>
        )}
        {song.narrativeSummary && (
          <Text style={styles.timelineSummary} numberOfLines={2}>
            {song.narrativeSummary}
          </Text>
        )}
      </Card>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────

export default function CoherenceScreen(): ReactNode {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const { data: album, isLoading, refetch } = useAlbum(albumId);
  const [checking, setChecking] = useState(false);

  // Placeholder warnings (would come from API in production)
  const [warnings] = useState<NarrativeWarning[]>([]);

  const handleRunCheck = useCallback(async () => {
    setChecking(true);
    try {
      await albumsApi.autotag(albumId);
      refetch();
      Alert.alert("Complete", "Coherence check finished.");
    } catch {
      Alert.alert("Error", "Failed to run coherence check.");
    } finally {
      setChecking(false);
    }
  }, [albumId, refetch]);

  if (isLoading || !album) {
    return <Loading />;
  }

  const songs = [...(album.songs ?? [])].sort(
    (a, b) => a.trackNumber - b.trackNumber,
  );

  const songDataMap = new Map(
    (album.data?.songs ?? []).map((sd) => [sd.track_number, sd]),
  );

  // Placeholder coherence score
  const hasData = songs.length > 0;
  const score = hasData ? 72 : 0;

  function getScoreColor(): string {
    if (score >= 80) return colors.success;
    if (score >= 50) return colors.warning;
    return colors.error;
  }

  function getScoreLabel(): string {
    if (score >= 80) return "Strong";
    if (score >= 50) return "Moderate";
    return "Weak";
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={[]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Score card */}
        <Card style={styles.scoreCard}>
          <Text style={styles.scoreTitle}>Narrative Coherence</Text>
          <View style={styles.scoreRow}>
            <View style={styles.scoreCircle}>
              <Text style={[styles.scoreNumber, { color: getScoreColor() }]}>
                {hasData ? score : "--"}
              </Text>
            </View>
            <View style={styles.scoreInfo}>
              {hasData ? (
                <>
                  <Badge
                    text={getScoreLabel()}
                    variant={score >= 80 ? "success" : score >= 50 ? "warning" : "error"}
                  />
                  <Text style={styles.scoreDescription}>
                    Your album's narrative threads are {getScoreLabel().toLowerCase()}ly
                    connected across {songs.length} tracks.
                  </Text>
                </>
              ) : (
                <Text style={styles.scoreDescription}>
                  Add songs and run a coherence check to see how your narrative
                  connects.
                </Text>
              )}
            </View>
          </View>
          <Button
            title="Run Coherence Check"
            onPress={handleRunCheck}
            loading={checking}
            icon={<RefreshCw size={16} color={colors.white} />}
          />
        </Card>

        {/* Warnings */}
        {warnings.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Issues & Suggestions
            </Text>
            <View style={styles.warningsList}>
              {warnings.map((w) => (
                <WarningCard key={w.id} warning={w} />
              ))}
            </View>
          </View>
        ) : hasData ? (
          <Card style={styles.noIssuesCard}>
            <CheckCircle size={24} color={colors.success} />
            <Text style={styles.noIssuesText}>
              No narrative issues detected. Run a check to verify.
            </Text>
          </Card>
        ) : null}

        {/* Timeline */}
        {songs.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Narrative Timeline</Text>
            <View style={styles.timeline}>
              {songs.map((song, index) => {
                const sd = songDataMap.get(song.trackNumber);
                return (
                  <TimelineSong
                    key={song.id}
                    song={song}
                    narrativePosition={sd?.narrative_position}
                    isLast={index === songs.length - 1}
                  />
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <EmptyState
              icon={Network}
              title="No Tracks to Analyze"
              description="Add songs to your album to visualize narrative coherence."
            />
          </View>
        )}
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

  // Score card
  scoreCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.lg,
  },
  scoreTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: "700",
  },
  scoreRow: {
    flexDirection: "row",
    gap: spacing.lg,
    alignItems: "center",
  },
  scoreCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surfaceBorder,
  },
  scoreNumber: {
    fontSize: fontSize["2xl"],
    fontWeight: "800",
  },
  scoreInfo: {
    flex: 1,
    gap: spacing.sm,
  },
  scoreDescription: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },

  // Sections
  section: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: "700",
  },

  // Warnings
  warningsList: {
    gap: spacing.sm,
  },
  warningCard: {
    padding: spacing.md,
  },
  warningRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  warningContent: {
    flex: 1,
    gap: spacing.xs,
  },
  warningText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  warningTracks: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },

  // No issues
  noIssuesCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  noIssuesText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },

  // Timeline
  timeline: {
    gap: 0,
  },
  timelineItem: {
    flexDirection: "row",
  },
  timelineLeft: {
    width: 32,
    alignItems: "center",
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    marginTop: spacing.lg,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.surfaceBorder,
  },
  timelineCard: {
    flex: 1,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  timelineCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  timelineTrackNumber: {
    color: colors.primary,
    fontSize: fontSize.xs,
    fontWeight: "700",
  },
  timelineSongTitle: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.base,
    fontWeight: "600",
  },
  timelineNarrative: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontStyle: "italic",
  },
  timelineSummary: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },

  // Empty
  emptyContainer: {
    flex: 1,
    paddingTop: spacing["3xl"],
  },
});
