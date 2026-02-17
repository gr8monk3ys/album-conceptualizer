import { useCallback, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Audio } from "expo-av";
import { Pause, Play, Trash2 } from "lucide-react-native";
import type { ReactNode } from "react";

import { Card } from "../ui/card";
import type { VoiceMemo } from "../../api/types";
import { config } from "../../config/env";
import { borderRadius, colors, fontSize, spacing } from "../../theme";

// ── Types ────────────────────────────────────────────────────────────

interface VoiceMemoListProps {
  memos: VoiceMemo[];
  onDelete: (memoId: string) => void;
}

interface MemoRowProps {
  memo: VoiceMemo;
  onDelete: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// ── MemoRow ──────────────────────────────────────────────────────────

function MemoRow({ memo, onDelete }: MemoRowProps): ReactNode {
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  const togglePlayback = useCallback(async () => {
    if (isPlaying && soundRef.current) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
      return;
    }

    if (soundRef.current) {
      await soundRef.current.playAsync();
      setIsPlaying(true);
      return;
    }

    const { sound } = await Audio.Sound.createAsync({
      uri: `${config.apiUrl}${memo.audioUrl}`,
    });
    soundRef.current = sound;
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        setIsPlaying(false);
        sound.setPositionAsync(0);
      }
    });
    await sound.playAsync();
    setIsPlaying(true);
  }, [isPlaying, memo.audioUrl]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      "Delete Voice Memo",
      "Are you sure you want to delete this recording?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: onDelete },
      ],
    );
  }, [onDelete]);

  const date = new Date(memo.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <Card style={styles.memoCard}>
      <View style={styles.memoRow}>
        <Pressable onPress={togglePlayback} style={styles.playButton}>
          {isPlaying ? (
            <Pause size={16} color={colors.white} />
          ) : (
            <Play size={16} color={colors.white} />
          )}
        </Pressable>

        <View style={styles.memoInfo}>
          <Text style={styles.memoTitle} numberOfLines={1}>
            {memo.title ?? "Voice Memo"}
          </Text>
          <View style={styles.memoMeta}>
            <Text style={styles.metaText}>{formatDuration(memo.durationMs)}</Text>
            <Text style={styles.metaText}>{date}</Text>
            <Text style={styles.metaText}>{memo.author.name ?? "Unknown"}</Text>
          </View>
        </View>

        <Pressable
          onPress={handleDelete}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          hitSlop={8}
        >
          <Trash2 size={16} color={colors.error} />
        </Pressable>
      </View>
    </Card>
  );
}

// ── VoiceMemoList ────────────────────────────────────────────────────

export function VoiceMemoList({ memos, onDelete }: VoiceMemoListProps): ReactNode {
  if (memos.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Voice Memos</Text>
      {memos.map((memo) => (
        <MemoRow key={memo.id} memo={memo} onDelete={() => onDelete(memo.id)} />
      ))}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  memoCard: {
    padding: spacing.md,
  },
  memoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  memoInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  memoTitle: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  memoMeta: {
    flexDirection: "row",
    gap: spacing.md,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
});
