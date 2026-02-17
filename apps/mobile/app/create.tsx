import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactNode } from "react";

import { Button, Input } from "../src/components/ui";
import { useCreateAlbum } from "../src/hooks/use-albums";
import { colors, fontSize, spacing } from "../src/theme";

export default function CreateAlbumScreen(): ReactNode {
  const router = useRouter();
  const createAlbum = useCreateAlbum();

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [conceptSummary, setConceptSummary] = useState("");
  const [primaryGenre, setPrimaryGenre] = useState("");
  const [themesInput, setThemesInput] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const next: Record<string, string> = {};

    if (!title.trim()) {
      next.title = "Title is required";
    }
    if (!artist.trim()) {
      next.artist = "Artist is required";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(): void {
    if (!validate()) return;

    const centralThemes = themesInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    createAlbum.mutate(
      {
        title: title.trim(),
        artist: artist.trim(),
        conceptSummary: conceptSummary.trim() || undefined,
        primaryGenre: primaryGenre.trim() || undefined,
        centralThemes: centralThemes.length > 0 ? centralThemes : undefined,
      },
      {
        onSuccess: (album) => {
          router.replace(`/album/${album.id}`);
        },
      },
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.heading}>New Album</Text>
          <Text style={styles.subheading}>
            Start by defining the core concept for your album.
          </Text>

          <View style={styles.form}>
            <Input
              label="Title"
              placeholder="Album title"
              value={title}
              onChangeText={setTitle}
              error={errors.title}
            />

            <Input
              label="Artist"
              placeholder="Artist or band name"
              value={artist}
              onChangeText={setArtist}
              error={errors.artist}
            />

            <Input
              label="Concept Summary"
              placeholder="What is this album about?"
              value={conceptSummary}
              onChangeText={setConceptSummary}
              multiline
              numberOfLines={4}
            />

            <Input
              label="Primary Genre"
              placeholder="e.g. Indie Rock, Hip Hop, Jazz"
              value={primaryGenre}
              onChangeText={setPrimaryGenre}
            />

            <Input
              label="Central Themes"
              placeholder="Comma-separated, e.g. love, loss, redemption"
              value={themesInput}
              onChangeText={setThemesInput}
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title="Create Album"
            onPress={handleSubmit}
            loading={createAlbum.isPending}
            disabled={createAlbum.isPending}
            size="lg"
          />

          {createAlbum.isError && (
            <Text style={styles.errorText}>
              Failed to create album. Please try again.
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing["2xl"],
  },
  heading: {
    color: colors.text,
    fontSize: fontSize["2xl"],
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  subheading: {
    color: colors.textSecondary,
    fontSize: fontSize.base,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  form: {
    gap: spacing.lg,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    gap: spacing.md,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.sm,
    textAlign: "center",
  },
});
