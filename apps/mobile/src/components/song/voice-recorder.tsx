import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Audio } from "expo-av";
import { Mic, Pause, Play, Square, Upload } from "lucide-react-native";
import type { ReactNode } from "react";

import { Button } from "../ui/button";
import { borderRadius, colors, fontSize, spacing } from "../../theme";

type RecorderState = "idle" | "recording" | "recorded" | "uploading";

interface VoiceRecorderProps {
  onUpload: (audioUri: string, durationMs: number) => Promise<void>;
}

export function VoiceRecorder({ onUpload }: VoiceRecorderProps): ReactNode {
  const [state, setState] = useState<RecorderState>("idle");
  const [durationMs, setDurationMs] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [isPlayingBack, setIsPlayingBack] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const startRecording = useCallback(async () => {
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission Required", "Microphone access is needed to record voice memos.");
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY,
    );
    recordingRef.current = recording;
    startTimeRef.current = Date.now();
    setState("recording");

    timerRef.current = setInterval(() => {
      setDurationMs(Date.now() - startTimeRef.current);
    }, 100);
  }, []);

  const stopRecording = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const recording = recordingRef.current;
    if (!recording) return;

    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    const finalDuration = Date.now() - startTimeRef.current;
    setDurationMs(finalDuration);
    setRecordingUri(uri);
    recordingRef.current = null;
    setState("recorded");

    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  }, []);

  const togglePlayback = useCallback(async () => {
    if (!recordingUri) return;

    if (isPlayingBack && soundRef.current) {
      await soundRef.current.pauseAsync();
      setIsPlayingBack(false);
      return;
    }

    if (soundRef.current) {
      await soundRef.current.playAsync();
      setIsPlayingBack(true);
      return;
    }

    const { sound } = await Audio.Sound.createAsync({ uri: recordingUri });
    soundRef.current = sound;
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        setIsPlayingBack(false);
        sound.setPositionAsync(0);
      }
    });
    await sound.playAsync();
    setIsPlayingBack(true);
  }, [recordingUri, isPlayingBack]);

  const handleUpload = useCallback(async () => {
    if (!recordingUri) return;
    setState("uploading");

    try {
      await onUpload(recordingUri, durationMs);

      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      setRecordingUri(null);
      setDurationMs(0);
      setIsPlayingBack(false);
      setState("idle");
    } catch {
      Alert.alert("Error", "Failed to upload voice memo.");
      setState("recorded");
    }
  }, [recordingUri, durationMs, onUpload]);

  const handleDiscard = useCallback(() => {
    if (soundRef.current) {
      soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setRecordingUri(null);
    setDurationMs(0);
    setIsPlayingBack(false);
    setState("idle");
  }, []);

  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <View style={styles.container}>
      <View style={styles.timerRow}>
        <View
          style={[
            styles.recordIndicator,
            { backgroundColor: state === "recording" ? colors.error : colors.textMuted },
          ]}
        />
        <Text style={styles.timer}>{formattedTime}</Text>
      </View>

      <View style={styles.controls}>
        {state === "idle" && (
          <Pressable onPress={startRecording} style={styles.recordButton}>
            <Mic size={24} color={colors.white} />
          </Pressable>
        )}

        {state === "recording" && (
          <Pressable onPress={stopRecording} style={styles.stopButton}>
            <Square size={20} color={colors.white} fill={colors.white} />
          </Pressable>
        )}

        {state === "recorded" && (
          <>
            <Pressable onPress={togglePlayback} style={styles.playButton}>
              {isPlayingBack ? (
                <Pause size={20} color={colors.white} />
              ) : (
                <Play size={20} color={colors.white} />
              )}
            </Pressable>
            <Button
              title="Upload"
              onPress={handleUpload}
              size="sm"
              icon={<Upload size={14} color={colors.white} />}
            />
            <Button
              title="Discard"
              onPress={handleDiscard}
              variant="ghost"
              size="sm"
            />
          </>
        )}

        {state === "uploading" && (
          <Button title="Uploading..." loading onPress={() => {}} size="sm" />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  recordIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timer: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  recordButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  stopButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
