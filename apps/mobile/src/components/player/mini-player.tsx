import { useCallback, useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Audio, type AVPlaybackStatus } from "expo-av";
import { Pause, Play, X } from "lucide-react-native";
import type { ReactNode } from "react";

import { usePlayerStore } from "../../stores/player-store";
import { borderRadius, colors, fontSize, spacing } from "../../theme";

interface MiniPlayerProps {
  onExpand: () => void;
}

export function MiniPlayer({ onExpand }: MiniPlayerProps): ReactNode {
  const {
    audioUrl,
    title,
    subtitle,
    isPlaying,
    positionMs,
    durationMs,
    togglePlay,
    setPosition,
    setDuration,
    setIsPlaying,
    clear,
  } = usePlayerStore();

  const soundRef = useRef<Audio.Sound | null>(null);
  const currentUrlRef = useRef<string | null>(null);

  const onPlaybackStatusUpdate = useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded) return;
      setPosition(status.positionMillis);
      setDuration(status.durationMillis ?? 0);
      setIsPlaying(status.isPlaying);
    },
    [setPosition, setDuration, setIsPlaying],
  );

  // Load / unload sound when audioUrl changes
  useEffect(() => {
    if (!audioUrl) {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
        currentUrlRef.current = null;
      }
      return;
    }

    // Skip if already loaded for this URL
    if (currentUrlRef.current === audioUrl) return;

    let cancelled = false;

    async function loadSound() {
      // Unload previous sound
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl! },
        { shouldPlay: false },
        onPlaybackStatusUpdate,
      );

      if (cancelled) {
        await sound.unloadAsync();
        return;
      }

      soundRef.current = sound;
      currentUrlRef.current = audioUrl;
    }

    loadSound();

    return () => {
      cancelled = true;
    };
  }, [audioUrl, onPlaybackStatusUpdate]);

  // Sync play/pause state with the sound object
  useEffect(() => {
    const sound = soundRef.current;
    if (!sound) return;

    if (isPlaying) {
      sound.playAsync();
    } else {
      sound.pauseAsync();
    }
  }, [isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  function handleClear(): void {
    if (soundRef.current) {
      soundRef.current.stopAsync();
      soundRef.current.unloadAsync();
      soundRef.current = null;
      currentUrlRef.current = null;
    }
    clear();
  }

  if (!audioUrl || !title) return null;

  const progress = durationMs > 0 ? positionMs / durationMs : 0;

  return (
    <Pressable onPress={onExpand} style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View
          style={[styles.progressFill, { width: `${progress * 100}%` }]}
        />
      </View>

      <View style={styles.content}>
        {/* Track info */}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <Pressable
            onPress={togglePlay}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            {isPlaying ? (
              <Pause size={22} color={colors.text} fill={colors.text} />
            ) : (
              <Play size={22} color={colors.text} fill={colors.text} />
            )}
          </Pressable>

          <Pressable
            onPress={handleClear}
            hitSlop={8}
            style={({ pressed }) => [
              styles.closeButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <X size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const MINI_PLAYER_HEIGHT = 64;

const styles = StyleSheet.create({
  container: {
    height: MINI_PLAYER_HEIGHT,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
  progressTrack: {
    height: 2,
    backgroundColor: colors.surfaceBorder,
  },
  progressFill: {
    height: 2,
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  closeButton: {
    padding: spacing.xs,
  },
});
