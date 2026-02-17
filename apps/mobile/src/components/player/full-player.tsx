import { useRef } from "react";
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { ChevronDown, Download, Music, Pause, Play } from "lucide-react-native";
import type { ReactNode } from "react";

import { usePlayerStore } from "../../stores/player-store";
import { borderRadius, colors, fontSize, spacing } from "../../theme";

interface FullPlayerProps {
  visible: boolean;
  onClose: () => void;
}

/** Format milliseconds as m:ss. */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function FullPlayer({ visible, onClose }: FullPlayerProps): ReactNode {
  const {
    audioUrl,
    title,
    subtitle,
    isPlaying,
    positionMs,
    durationMs,
    togglePlay,
  } = usePlayerStore();

  const downloadingRef = useRef(false);

  async function handleDownload(): Promise<void> {
    if (!audioUrl || downloadingRef.current) return;

    downloadingRef.current = true;

    try {
      const filename = title?.replace(/[^a-zA-Z0-9]/g, "_") ?? "audio";
      const destination = new File(Paths.cache, `${filename}.mp3`);

      await File.downloadFileAsync(audioUrl, destination);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(destination.uri, {
          mimeType: "audio/mpeg",
          dialogTitle: `Share ${title}`,
        });
      } else {
        Alert.alert("Downloaded", `File saved to ${destination.uri}`);
      }
    } catch {
      Alert.alert("Error", "Failed to download audio file.");
    } finally {
      downloadingRef.current = false;
    }
  }

  const progress = durationMs > 0 ? positionMs / durationMs : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <ChevronDown size={28} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Now Playing</Text>
          <Pressable
            onPress={handleDownload}
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Download size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Album art placeholder */}
        <View style={styles.artContainer}>
          <View style={styles.artPlaceholder}>
            <Music size={64} color={colors.textMuted} strokeWidth={1} />
          </View>
        </View>

        {/* Track info */}
        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle} numberOfLines={2}>
            {title ?? "Unknown"}
          </Text>
          {subtitle && (
            <Text style={styles.trackSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        {/* Progress bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress * 100}%` },
              ]}
            />
            <View
              style={[
                styles.progressThumb,
                { left: `${progress * 100}%` },
              ]}
            />
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(positionMs)}</Text>
            <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <Pressable
            onPress={togglePlay}
            style={({ pressed }) => [
              styles.playButton,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            {isPlaying ? (
              <Pause size={32} color={colors.white} fill={colors.white} />
            ) : (
              <Play size={32} color={colors.white} fill={colors.white} />
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing["3xl"],
    paddingBottom: spacing.lg,
  },
  headerTitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  artContainer: {
    alignItems: "center",
    paddingVertical: spacing["2xl"],
  },
  artPlaceholder: {
    width: 280,
    height: 280,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  trackInfo: {
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  trackTitle: {
    color: colors.text,
    fontSize: fontSize["2xl"],
    fontWeight: "700",
    textAlign: "center",
  },
  trackSubtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.base,
    textAlign: "center",
  },
  progressSection: {
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  progressTrack: {
    height: 4,
    backgroundColor: colors.surfaceBorder,
    borderRadius: borderRadius.full,
    position: "relative",
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  progressThumb: {
    position: "absolute",
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    marginLeft: -6,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
  controls: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
