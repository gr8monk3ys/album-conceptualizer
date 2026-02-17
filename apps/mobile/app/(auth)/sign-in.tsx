/** Sign-in screen — GitHub OAuth entry point. */
import { router } from "expo-router";
import { Github, Music } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { signInWithGitHub } from "../../src/api/auth";
import { useAuthStore } from "../../src/stores/auth-store";
import { borderRadius, colors, fontSize, spacing } from "../../src/theme";

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setLoading(true);
    setError(null);

    try {
      const session = await signInWithGitHub();
      await signIn(session.jwt, session.user);
      router.replace("/(tabs)");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing["3xl"] }]}>
      {/* Logo / branding */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Music size={48} color={colors.primary} strokeWidth={1.5} />
        </View>
        <Text style={styles.title}>Album Conceptualizer</Text>
        <Text style={styles.subtitle}>
          Design, compose, and collaborate on album concepts
        </Text>
      </View>

      {/* Sign in */}
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            loading && styles.buttonDisabled,
          ]}
          onPress={handleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Github size={20} color={colors.white} strokeWidth={2} />
          )}
          <Text style={styles.buttonText}>
            {loading ? "Signing in..." : "Sign in with GitHub"}
          </Text>
        </Pressable>

        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      {/* Footer */}
      <Text style={styles.footer}>
        By signing in you agree to our Terms of Service and Privacy Policy.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    justifyContent: "space-between",
  },
  header: {
    alignItems: "center",
    marginTop: spacing["3xl"],
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize["3xl"],
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 280,
  },
  actions: {
    alignItems: "center",
    gap: spacing.md,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    width: "100%",
  },
  buttonPressed: {
    backgroundColor: colors.surfaceBorder,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.text,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.error,
    textAlign: "center",
  },
  footer: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: "center",
    paddingBottom: spacing["2xl"],
    lineHeight: 18,
  },
});
